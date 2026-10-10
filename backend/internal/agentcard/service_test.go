package agentcard

import (
	"encoding/json"
	"errors"
	"math"
	"strings"
	"testing"
)

func newSvc() *Service { return NewService(NewPermissionGuard(), nil) }

func mustCard(t *testing.T, s *Service, deposit float64) *CreatedCard {
	t.Helper()
	c, err := s.CreateCard("0x0000000000000000000000000000000000000001", "T", deposit)
	if err != nil {
		t.Fatalf("CreateCard: %v", err)
	}
	return c
}

func TestValidateAmount(t *testing.T) {
	for _, v := range []float64{0, -1, -5000, math.NaN(), math.Inf(1), math.Inf(-1), MaxAmountUSD + 1} {
		if ValidateAmount(v) == nil {
			t.Errorf("ValidateAmount(%v) accepted", v)
		}
	}
	for _, v := range []float64{0.01, 1, MaxAmountUSD} {
		if err := ValidateAmount(v); err != nil {
			t.Errorf("ValidateAmount(%v) rejected: %v", v, err)
		}
	}
}

// Regression: a -5000 charge used to raise the balance from 100 to 5100.
func TestNegativeChargeIsRejectedAndBalanceUnchanged(t *testing.T) {
	s := newSvc()
	c := mustCard(t, s, 100)
	for _, amt := range []float64{-5000, 0, math.NaN()} {
		_, err := s.AuthorizeMicropayment(AuthorizeRequest{CardID: c.CardID, AmountUSD: amt}, c.CardToken)
		if !errors.Is(err, ErrInvalidAmount) {
			t.Fatalf("amount %v: want ErrInvalidAmount, got %v", amt, err)
		}
	}
	v, _ := s.GetCard(c.CardID, c.CardToken, false)
	if v.BalanceUSD != 100 {
		t.Fatalf("balance changed: %v", v.BalanceUSD)
	}
}

func TestCreateCardRejectsBadDeposit(t *testing.T) {
	s := newSvc()
	for _, d := range []float64{0, -1, math.Inf(1)} {
		if _, err := s.CreateCard("", "T", d); !errors.Is(err, ErrInvalidAmount) {
			t.Errorf("deposit %v accepted", d)
		}
	}
}

func TestCardViewNeverContainsPANOrCVV(t *testing.T) {
	s := newSvc()
	c := mustCard(t, s, 100)
	s.mu.RLock()
	raw := s.cards[c.CardID]
	s.mu.RUnlock()

	for name, v := range map[string]interface{}{"created": c, "raw": raw} {
		b, _ := json.Marshal(v)
		out := string(b)
		if strings.Contains(out, raw.CardNumber) {
			t.Errorf("%s JSON contains full PAN", name)
		}
		if strings.Contains(strings.ToLower(out), `"cvv"`) || strings.Contains(out, `"cardNumber"`) {
			t.Errorf("%s JSON exposes cvv/cardNumber field: %s", name, out)
		}
	}
	if c.Last4 != raw.CardNumber[12:] {
		t.Errorf("last4 mismatch")
	}
	if strings.Contains(c.CardID, raw.CardNumber[10:]) {
		t.Errorf("card ID derived from PAN: %s", c.CardID)
	}
	if !ValidateLuhn(raw.CardNumber) || !strings.HasPrefix(raw.CardNumber, "492810") {
		t.Errorf("card format changed; owner chose to keep it")
	}
}

func TestGetCardRequiresToken(t *testing.T) {
	s := newSvc()
	c := mustCard(t, s, 100)
	if _, err := s.GetCard(c.CardID, "", false); !errors.Is(err, ErrCardNotFound) {
		t.Errorf("empty token accepted")
	}
	if _, err := s.GetCard(c.CardID, "ct_wrong", false); !errors.Is(err, ErrCardNotFound) {
		t.Errorf("wrong token accepted")
	}
	if _, err := s.GetCard(c.CardID, c.CardToken, false); err != nil {
		t.Errorf("owner token rejected: %v", err)
	}
	if _, err := s.GetCard(c.CardID, "", true); err != nil {
		t.Errorf("operator rejected: %v", err)
	}
}

func TestAuthorizeRequiresCredential(t *testing.T) {
	s := newSvc()
	c := mustCard(t, s, 100)
	if _, err := s.AuthorizeMicropayment(AuthorizeRequest{CardID: c.CardID, AmountUSD: 1}, ""); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("charge without credential: %v", err)
	}
	r, err := s.AuthorizeMicropayment(AuthorizeRequest{CardID: c.CardID, AmountUSD: 1}, c.CardToken)
	if err != nil || !r.Success || r.RemainingUSD != 99 {
		t.Fatalf("owner charge failed: %+v %v", r, err)
	}
}

func TestSessionKeyBoundToItsCard(t *testing.T) {
	s := newSvc()
	a := mustCard(t, s, 100)
	b := mustCard(t, s, 100)
	sk, err := s.IssueSessionKey(a.CardID, a.CardToken, false, "agent", 10, 20, nil, 1)
	if err != nil {
		t.Fatal(err)
	}
	r, _ := s.AuthorizeMicropayment(AuthorizeRequest{CardID: b.CardID, SessionKey: sk.KeyHex, AmountUSD: 5}, "")
	if r == nil || r.Success {
		t.Fatalf("session key for card A charged card B")
	}
	r, _ = s.AuthorizeMicropayment(AuthorizeRequest{CardID: a.CardID, SessionKey: sk.KeyHex, AmountUSD: 5}, "")
	if r == nil || !r.Success {
		t.Fatalf("session key rejected on its own card: %+v", r)
	}
}

func TestDeclinedChargeDoesNotConsumeAllowance(t *testing.T) {
	s := newSvc()
	c := mustCard(t, s, 5)
	sk, _ := s.IssueSessionKey(c.CardID, c.CardToken, false, "agent", 10, 10, nil, 1)
	r, _ := s.AuthorizeMicropayment(AuthorizeRequest{CardID: c.CardID, SessionKey: sk.KeyHex, AmountUSD: 8}, "")
	if r.Success || r.ResponseCode != "51" {
		t.Fatalf("want insufficient funds, got %+v", r)
	}
	if got := s.guard.sessionKeys[sk.KeyHex].SpentTodayUSD; got != 0 {
		t.Fatalf("declined charge consumed allowance: %v", got)
	}
}

func TestIssueSessionKeyValidation(t *testing.T) {
	s := newSvc()
	c := mustCard(t, s, 100)
	cases := []struct {
		name         string
		token        string
		perTx, daily float64
		ttl          int
	}{
		{"no token", "", 1, 2, 1},
		{"zero perTx", c.CardToken, 0, 2, 1},
		{"negative daily", c.CardToken, 1, -2, 1},
		{"perTx > daily", c.CardToken, 5, 2, 1},
		{"ttl too long", c.CardToken, 1, 2, MaxSessionTTLHours + 1},
		{"negative ttl", c.CardToken, 1, 2, -1},
	}
	for _, tc := range cases {
		if _, err := s.IssueSessionKey(c.CardID, tc.token, false, "agent", tc.perTx, tc.daily, nil, tc.ttl); err == nil {
			t.Errorf("%s: accepted", tc.name)
		}
	}
}
