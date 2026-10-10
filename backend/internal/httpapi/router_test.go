package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/koliance/backend/internal/agentcard"
	"github.com/koliance/backend/internal/config"
	"github.com/koliance/backend/internal/developer"
	"github.com/koliance/backend/internal/game"
	"github.com/koliance/backend/internal/market"
	"github.com/koliance/backend/internal/platform/stripeclient"
)

const opToken = "test-operator-token"

// newTestRouter builds the router with real services but unreachable
// upstreams. Every test below fails (or succeeds) before any network call.
func newTestRouter(t *testing.T, mutate func(*config.Config)) http.Handler {
	t.Helper()
	cfg := &config.Config{
		SteamDomain:        "koliance.oodai.space",
		MonadChainID:       "10143",
		CORSAllowedOrigins: config.ParseOrigins(config.DefaultCORSOrigins),
		APIToken:           opToken,
	}
	if mutate != nil {
		mutate(cfg)
	}
	alp := market.NewAlpacaClient("http://127.0.0.1:1", "k", "s")
	oracle := market.NewPriceOracle("k", "s")
	return NewRouter(Deps{
		Cfg:         cfg,
		Game:        game.NewService(game.NewSteamClient(""), nil),
		Cards:       agentcard.NewService(agentcard.NewPermissionGuard(), nil),
		Market:      market.NewService(alp, oracle, nil),
		PriceOracle: oracle,
		Stripe:      stripeclient.New(""),
		Dev:         developer.NewService(developer.NewGitHubClient("")),
	})
}

func do(h http.Handler, method, path, body string, hdr map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

func TestCORSAllowList(t *testing.T) {
	h := newTestRouter(t, nil)
	rr := do(h, http.MethodGet, "/api/v1/stats", "", map[string]string{"Origin": "https://koliance.oodai.space"})
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "https://koliance.oodai.space" {
		t.Errorf("allowed origin not reflected: %q", got)
	}
	rr = do(h, http.MethodGet, "/api/v1/stats", "", map[string]string{"Origin": "https://evil.vercel.app"})
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("disallowed origin got ACAO %q", got)
	}
	rr = do(h, http.MethodOptions, "/api/v1/agentcard/authorize", "", map[string]string{"Origin": "https://evil.example"})
	if rr.Code != http.StatusForbidden {
		t.Errorf("preflight from disallowed origin: %d", rr.Code)
	}
	rr = do(h, http.MethodOptions, "/api/v1/agentcard/authorize", "", map[string]string{"Origin": "http://localhost:3000"})
	if rr.Code != http.StatusNoContent || rr.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Errorf("preflight from localhost: %d %v", rr.Code, rr.Header())
	}
	if strings.Contains(rr.Header().Get("Access-Control-Allow-Origin"), "*") {
		t.Errorf("wildcard ACAO")
	}
}

func TestOperatorEndpointsFailClosed(t *testing.T) {
	noToken := newTestRouter(t, func(c *config.Config) { c.APIToken = "" })
	for _, p := range []string{"/api/v1/agentcard/batch-settle", "/api/v1/stripe/customer", "/api/v1/market/trade", "/api/v1/market/close"} {
		rr := do(noToken, http.MethodPost, p, `{}`, map[string]string{"Authorization": "Bearer anything"})
		if rr.Code != http.StatusServiceUnavailable {
			t.Errorf("%s without configured token: %d, want 503", p, rr.Code)
		}
	}
	h := newTestRouter(t, nil)
	for _, p := range []string{"/api/v1/agentcard/batch-settle", "/api/v1/stripe/customer", "/api/v1/market/trade", "/api/v1/market/close"} {
		if rr := do(h, http.MethodPost, p, `{}`, nil); rr.Code != http.StatusUnauthorized {
			t.Errorf("%s no auth: %d, want 401", p, rr.Code)
		}
		if rr := do(h, http.MethodPost, p, `{}`, map[string]string{"Authorization": "Bearer wrong"}); rr.Code != http.StatusUnauthorized {
			t.Errorf("%s wrong token: %d, want 401", p, rr.Code)
		}
	}
	rr := do(h, http.MethodPost, "/api/v1/agentcard/batch-settle", "", map[string]string{"Authorization": "Bearer " + opToken})
	if rr.Code != http.StatusOK {
		t.Errorf("batch-settle with operator token: %d", rr.Code)
	}
	if rr := do(h, http.MethodGet, "/api/v1/agentcard/batch-settle", "", map[string]string{"Authorization": "Bearer " + opToken}); rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET batch-settle: %d", rr.Code)
	}
}

func TestTradeValidation(t *testing.T) {
	// Public demo trading enabled: auth passes, validation must still bite.
	h := newTestRouter(t, func(c *config.Config) { c.DemoPublicTrading = true })
	bad := []string{
		`{"symbol":"NVDA","side":"buy","notionalUSD":-100,"leverage":1}`,
		`{"symbol":"NVDA","side":"buy","notionalUSD":0,"leverage":1}`,
		`{"symbol":"NVDA","side":"buy","notionalUSD":100,"leverage":10}`,
		`{"symbol":"NVDA","side":"buy","notionalUSD":50000,"leverage":4}`,
		`{"symbol":"NVDA","side":"hold","notionalUSD":100,"leverage":1}`,
		`{"symbol":"../x","side":"buy","notionalUSD":100,"leverage":1}`,
		`{"symbol":"NVDA","side":"buy","notionalUSD":"abc"}`,
	}
	for _, b := range bad {
		if rr := do(h, http.MethodPost, "/api/v1/market/trade", b, nil); rr.Code != http.StatusBadRequest {
			t.Errorf("%s: %d, want 400", b, rr.Code)
		}
	}
	if rr := do(h, http.MethodPost, "/api/v1/market/close", `{"symbol":"nv da"}`, nil); rr.Code != http.StatusBadRequest {
		t.Errorf("close bad symbol: %d", rr.Code)
	}
}

func TestStripeCheckoutValidation(t *testing.T) {
	h := newTestRouter(t, nil)
	bad := []string{
		`{"amountCents":-500}`,
		`{"amountCents":0}`,
		`{"amountCents":10}`,
		`{"amountCents":100000000}`,
		`{"amountCents":1000,"currency":"eur"}`,
		`{"amountCents":1000,"successUrl":"https://evil.example/x"}`,
		`{"amountCents":1000,"cancelUrl":"javascript:alert(1)"}`,
	}
	for _, b := range bad {
		if rr := do(h, http.MethodPost, "/api/v1/stripe/checkout-session", b, nil); rr.Code != http.StatusBadRequest {
			t.Errorf("%s: %d, want 400", b, rr.Code)
		}
	}
}

func TestSteamProfileShortIDIs400NotPanic(t *testing.T) {
	h := newTestRouter(t, nil)
	rr := do(h, http.MethodGet, "/api/v1/game/steam/profile?id=ab", "", nil)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("?id=ab: %d %s", rr.Code, rr.Body.String())
	}
}

func TestProofInputValidation(t *testing.T) {
	h := newTestRouter(t, nil)
	if rr := do(h, http.MethodPost, "/api/v1/game/proof", `{"steamId":"ab","walletAddress":"0x0000000000000000000000000000000000000001"}`, nil); rr.Code != http.StatusBadRequest {
		t.Errorf("game proof bad id: %d", rr.Code)
	}
	if rr := do(h, http.MethodPost, "/api/v1/developer/github/proof", `{"username":"../../orgs","walletAddress":"0x0000000000000000000000000000000000000001"}`, nil); rr.Code != http.StatusBadRequest {
		t.Errorf("github proof bad user: %d", rr.Code)
	}
	if rr := do(h, http.MethodGet, "/api/v1/developer/github/profile?username=a/b", "", nil); rr.Code != http.StatusBadRequest {
		t.Errorf("github profile bad user: %d", rr.Code)
	}
}

// End-to-end card flow over HTTP: issue, masked lookup, auth on every
// sensitive step, and the -5000 regression.
func TestAgentCardFlow(t *testing.T) {
	h := newTestRouter(t, nil)

	for _, b := range []string{`{"initialDeposit":-5}`, `{"initialDeposit":0}`, `not json`} {
		if rr := do(h, http.MethodPost, "/api/v1/agentcard/generate", b, nil); rr.Code != http.StatusBadRequest {
			t.Errorf("generate %s: %d", b, rr.Code)
		}
	}

	rr := do(h, http.MethodPost, "/api/v1/agentcard/generate", `{"walletAddress":"0x0000000000000000000000000000000000000001","initialDeposit":100}`, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("generate: %d %s", rr.Code, rr.Body.String())
	}
	body := rr.Body.String()
	for _, f := range []string{`"cvv"`, `"cardNumber"`} {
		if strings.Contains(body, f) {
			t.Errorf("generate response exposes %s", f)
		}
	}
	var created struct {
		CardID    string `json:"cardId"`
		CardToken string `json:"cardToken"`
		Last4     string `json:"last4"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &created)
	if created.CardToken == "" || len(created.Last4) != 4 {
		t.Fatalf("missing token/last4: %s", body)
	}
	auth := map[string]string{"Authorization": "Bearer " + created.CardToken}
	cardPath := "/api/v1/agentcard/cards/" + created.CardID

	if rr := do(h, http.MethodGet, cardPath, "", nil); rr.Code != http.StatusUnauthorized {
		t.Errorf("card lookup without token: %d", rr.Code)
	}
	if rr := do(h, http.MethodGet, cardPath, "", map[string]string{"Authorization": "Bearer ct_wrong"}); rr.Code != http.StatusNotFound {
		t.Errorf("card lookup wrong token: %d", rr.Code)
	}
	rr = do(h, http.MethodGet, cardPath, "", auth)
	if rr.Code != http.StatusOK || strings.Contains(rr.Body.String(), "cvv") || strings.Contains(rr.Body.String(), "cardToken") {
		t.Errorf("card lookup: %d %s", rr.Code, rr.Body.String())
	}
	if rr := do(h, http.MethodGet, cardPath, "", map[string]string{"Authorization": "Bearer " + opToken}); rr.Code != http.StatusOK {
		t.Errorf("operator card lookup: %d", rr.Code)
	}

	charge := func(amount string, hdr map[string]string) *httptest.ResponseRecorder {
		return do(h, http.MethodPost, "/api/v1/agentcard/authorize", `{"cardId":"`+created.CardID+`","amountUSD":`+amount+`,"merchantName":"m","mcc":"7999"}`, hdr)
	}
	if rr := charge("1", nil); rr.Code != http.StatusUnauthorized {
		t.Errorf("charge without credential: %d", rr.Code)
	}
	if rr := charge("-5000", auth); rr.Code != http.StatusBadRequest {
		t.Errorf("negative charge: %d", rr.Code)
	}
	if rr := charge("0", auth); rr.Code != http.StatusBadRequest {
		t.Errorf("zero charge: %d", rr.Code)
	}
	rr = do(h, http.MethodGet, cardPath, "", auth)
	var view struct {
		BalanceUSD float64 `json:"balanceUSD"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &view)
	if view.BalanceUSD != 100 {
		t.Fatalf("balance after rejected charges = %v, want 100", view.BalanceUSD)
	}

	// Session key: requires the card token, then works as the agent credential.
	skBody := `{"cardId":"` + created.CardID + `","agentId":"a1","maxPerTxUSD":10,"dailyLimitUSD":20,"ttlHours":1}`
	if rr := do(h, http.MethodPost, "/api/v1/agentcard/session-key", skBody, nil); rr.Code != http.StatusUnauthorized {
		t.Errorf("session-key without token: %d", rr.Code)
	}
	rr = do(h, http.MethodPost, "/api/v1/agentcard/session-key", skBody, auth)
	if rr.Code != http.StatusOK {
		t.Fatalf("session-key: %d %s", rr.Code, rr.Body.String())
	}
	var sk struct {
		KeyHex string `json:"keyHex"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &sk)
	rr = do(h, http.MethodPost, "/api/v1/agentcard/authorize", `{"cardId":"`+created.CardID+`","sessionKey":"`+sk.KeyHex+`","amountUSD":5,"mcc":"7999"}`, nil)
	var ar struct {
		Success      bool    `json:"success"`
		RemainingUSD float64 `json:"remainingUSD"`
	}
	_ = json.Unmarshal(rr.Body.Bytes(), &ar)
	if rr.Code != http.StatusOK || !ar.Success || ar.RemainingUSD != 95 {
		t.Errorf("agent charge: %d %s", rr.Code, rr.Body.String())
	}
	if strings.Contains(rr.Body.String(), sk.KeyHex) {
		t.Errorf("authorize response echoes the session key")
	}
}
