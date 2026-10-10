package agentcard

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"math/big"
	"time"
)

// VisaCard is the internal record. The full PAN and the CVV are tagged
// `json:"-"` so that no handler can serialise them by accident: responses use
// CardView (see service.go), which only carries the masked number and last 4.
type VisaCard struct {
	CardID          string    `json:"cardId"`
	CardNumber      string    `json:"-"`               // 16-digit Visa, never serialised
	FormattedNumber string    `json:"formattedNumber"` // 4xxx **** **** xxxx
	Last4           string    `json:"last4"`
	Expiry          string    `json:"expiry"` // MM/YY
	CVV             string    `json:"-"`      // 3-digit CVV, never serialised
	CardholderName  string    `json:"cardholderName"`
	WalletAddress   string    `json:"walletAddress"`
	BalanceUSD      float64   `json:"balanceUSD"`
	Status          string    `json:"status"` // ACTIVE, FROZEN, SUSPENDED
	CreatedAt       time.Time `json:"createdAt"`
}

// GenerateVisaCard creates a real-format Visa card compliant with ISO/IEC 7812 & Luhn algorithm
func GenerateVisaCard(walletAddress, holderName string, initialBalance float64) *VisaCard {
	// Standard Visa BIN prefix: 4928 10 (Monad / Koliance designated prefix)
	prefix := "492810"
	// Generate 9 random digits
	accountDigits := ""
	for i := 0; i < 9; i++ {
		n, _ := rand.Int(rand.Reader, big.NewInt(10))
		accountDigits += fmt.Sprintf("%d", n.Int64())
	}
	partial := prefix + accountDigits
	checkDigit := calculateLuhnCheckDigit(partial)
	fullNumber := partial + fmt.Sprintf("%d", checkDigit)

	// Expiry: 4 years from now
	now := time.Now()
	expiry := fmt.Sprintf("%02d/%02d", now.Month(), (now.Year()+4)%100)

	// CVV: 3 random digits
	cvvNum, _ := rand.Int(rand.Reader, big.NewInt(900))
	cvv := fmt.Sprintf("%03d", cvvNum.Int64()+100)

	formatted := fmt.Sprintf("%s **** **** %s", fullNumber[:4], fullNumber[12:])

	return &VisaCard{
		CardID:          newCardID(),
		CardNumber:      fullNumber,
		FormattedNumber: formatted,
		Last4:           fullNumber[12:],
		Expiry:          expiry,
		CVV:             cvv,
		CardholderName:  holderName,
		WalletAddress:   walletAddress,
		BalanceUSD:      initialBalance,
		Status:          "ACTIVE",
		CreatedAt:       time.Now().UTC(),
	}
}

// newCardID returns an opaque random identifier. It used to be
// "card_" + the last six PAN digits, which leaked part of the PAN and made the
// ID space small enough (10^6) to enumerate.
func newCardID() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("crypto/rand unavailable: %v", err))
	}
	return "card_" + hex.EncodeToString(b)
}

// calculateLuhnCheckDigit generates the MOD 10 checksum digit
func calculateLuhnCheckDigit(partial string) int {
	sum := 0
	alt := true
	for i := len(partial) - 1; i >= 0; i-- {
		n := int(partial[i] - '0')
		if alt {
			n *= 2
			if n > 9 {
				n -= 9
			}
		}
		sum += n
		alt = !alt
	}
	return (10 - (sum % 10)) % 10
}

// ValidateLuhn verifies any card number's cryptographic validity
func ValidateLuhn(number string) bool {
	sum := 0
	alt := false
	for i := len(number) - 1; i >= 0; i-- {
		n := int(number[i] - '0')
		if alt {
			n *= 2
			if n > 9 {
				n -= 9
			}
		}
		sum += n
		alt = !alt
	}
	return sum%10 == 0
}
