package agentcard

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"time"
)

type VisaCard struct {
	CardID         string    `json:"cardId"`
	CardNumber     string    `json:"cardNumber"`     // 16-digit Visa
	FormattedNumber string   `json:"formattedNumber"` // 4xxx **** **** xxxx
	Expiry         string    `json:"expiry"`         // MM/YY
	CVV            string    `json:"cvv"`            // 3-digit CVV
	CardholderName string    `json:"cardholderName"`
	WalletAddress  string    `json:"walletAddress"`
	BalanceUSD     float64   `json:"balanceUSD"`
	Status         string    `json:"status"`         // ACTIVE, FROZEN, SUSPENDED
	CreatedAt      time.Time `json:"createdAt"`
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
	cardID := fmt.Sprintf("card_%s", fullNumber[10:])

	return &VisaCard{
		CardID:          cardID,
		CardNumber:      fullNumber,
		FormattedNumber: formatted,
		Expiry:          expiry,
		CVV:             cvv,
		CardholderName:  holderName,
		WalletAddress:   walletAddress,
		BalanceUSD:      initialBalance,
		Status:          "ACTIVE",
		CreatedAt:       time.Now().UTC(),
	}
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
