package httpapi

import (
	"errors"
	"math"
	"net/url"
	"regexp"
	"strings"
)

var (
	githubUserRe = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$`)
	symbolRe     = regexp.MustCompile(`^[A-Z0-9]{1,10}(/[A-Z]{3,4})?$`)
)

const (
	maxTradeNotionalUSD = 100_000.0
	maxLeverage         = 4.0
	minStripeCents      = 50        // Stripe's own minimum for USD
	maxStripeCents      = 1_000_000 // $10,000 per demo top-up
)

func validGitHubUser(u string) bool { return githubUserRe.MatchString(u) }

// normalizeSymbol upper-cases and validates a ticker such as "NVDA" or "BTC/USD".
func normalizeSymbol(s string) (string, error) {
	s = strings.ToUpper(strings.TrimSpace(s))
	if !symbolRe.MatchString(s) {
		return "", errors.New("invalid symbol")
	}
	return s, nil
}

func validateTrade(side string, notional, leverage float64) (float64, error) {
	if side != "buy" && side != "sell" {
		return 0, errors.New(`side must be "buy" or "sell"`)
	}
	if math.IsNaN(notional) || math.IsInf(notional, 0) || notional <= 0 || notional > maxTradeNotionalUSD {
		return 0, errors.New("notionalUSD must be greater than 0 and at most 100000")
	}
	if leverage == 0 {
		leverage = 1
	}
	if math.IsNaN(leverage) || math.IsInf(leverage, 0) || leverage < 1 || leverage > maxLeverage {
		return 0, errors.New("leverage must be between 1 and 4")
	}
	if notional*leverage > maxTradeNotionalUSD {
		return 0, errors.New("effective notional (notionalUSD x leverage) must be at most 100000")
	}
	return leverage, nil
}

func validateStripeAmount(cents int64) error {
	if cents < minStripeCents || cents > maxStripeCents {
		return errors.New("amountCents must be between 50 and 1000000")
	}
	return nil
}

// sameOriginAllowed reports whether rawURL is an absolute http(s) URL whose
// origin is on the allow-list. Used for Stripe success/cancel redirects so the
// checkout cannot bounce users to an arbitrary site.
func sameOriginAllowed(rawURL string, allowed []string) bool {
	u, err := url.Parse(rawURL)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" || u.User != nil {
		return false
	}
	origin := u.Scheme + "://" + u.Host
	for _, a := range allowed {
		if origin == a {
			return true
		}
	}
	return false
}
