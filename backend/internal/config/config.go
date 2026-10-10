package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                string
	Environment         string
	DatabaseURL         string
	SteamAPIKey         string
	SteamDomain         string
	AlpacaAPIKey        string
	AlpacaAPISecret     string
	AlpacaBaseURL       string
	StripePublishableKey string
	StripeSecretKey     string
	PythHermesURL       string
	MonadRPCURL         string
	MonadChainID        string
	KolianceContract    string

	// CORSAllowedOrigins is the exact list of browser origins allowed to call
	// the API (CORS_ALLOWED_ORIGINS, comma separated). No wildcard support on
	// purpose: "*" is what this replaced.
	CORSAllowedOrigins []string
	// APIToken is the operator bearer token (KOLIANCE_API_TOKEN). Operator-only
	// endpoints fail closed (503) when it is unset.
	APIToken string
	// DemoPublicTrading opens the Alpaca paper-trading write endpoints to
	// unauthenticated browsers (DEMO_PUBLIC_TRADING=true). Default false, i.e.
	// those endpoints require the operator token unless explicitly opted in.
	DemoPublicTrading bool
}

// DefaultCORSOrigins is used when CORS_ALLOWED_ORIGINS is unset: the
// production homepage plus the local Next.js dev server.
const DefaultCORSOrigins = "https://koliance.oodai.space,http://localhost:3000,http://127.0.0.1:3000"

func Load() *Config {
	// Attempt to load .env, ignore if missing
	if err := godotenv.Load(); err != nil {
		_ = godotenv.Load("../.env")
	}

	cfg := &Config{
		Port:                getEnv("PORT", "8080"),
		Environment:         getEnv("ENVIRONMENT", "development"),
		DatabaseURL:         getEnv("DATABASE_URL", ""),
		SteamAPIKey:         getEnv("STEAM_API_KEY", "745B577BC3554647B4FA40BE9635E838"),
		SteamDomain:         getEnv("STEAM_DOMAIN", "koliance.oodai.space"),
		AlpacaAPIKey:        getEnv("ALPACA_API_KEY", "PK2SMWLLV64SKRMOJJCQUHUANB"),
		AlpacaAPISecret:     getEnv("ALPACA_API_SECRET", "Eh8yhX5FKFUKhKt3L5dQY7e6MGsJs7XZaCrw6PtcMtgU"),
		AlpacaBaseURL:       getEnv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets/v2"),
		StripePublishableKey: getEnv("STRIPE_PUBLISHABLE_KEY", "pk_test_51UMQCbEP5h4ijOX4RfqfeOsj5flpshzH2814PRH1FIvK8kPn79Goucx9sAfzvnkVIzdU30f60ozxkD0FC9vejNM300uNY0C82o"),
		StripeSecretKey:     getEnv("STRIPE_SECRET_KEY", ""),
		PythHermesURL:       getEnv("PYTH_HERMES_URL", "https://hermes.pyth.network"),
		MonadRPCURL:         getEnv("MONAD_RPC_URL", "https://testnet-rpc.monad.xyz"),
		MonadChainID:        getEnv("MONAD_CHAIN_ID", "10143"),
		KolianceContract:    getEnv("KOLIANCE_CONTRACT_ADDRESS", "0x32fDd6B096EE14246b5b6971135286Bad01F4928"),
	}
	cfg.CORSAllowedOrigins = ParseOrigins(getEnv("CORS_ALLOWED_ORIGINS", DefaultCORSOrigins))
	cfg.APIToken = getEnv("KOLIANCE_API_TOKEN", "")
	cfg.DemoPublicTrading = strings.EqualFold(getEnv("DEMO_PUBLIC_TRADING", "false"), "true")
	if cfg.APIToken == "" {
		log.Println("[Config] KOLIANCE_API_TOKEN not set: operator-only endpoints will refuse every request (fail closed).")
	}

	log.Printf("[Config] Loaded configuration: Port=%s, SteamDomain=%s, AlpacaBase=%s", cfg.Port, cfg.SteamDomain, cfg.AlpacaBaseURL)
	return cfg
}

// ParseOrigins splits a comma separated origin list, trimming blanks and any
// trailing slash so "https://a.b/" and "https://a.b" compare equal.
func ParseOrigins(raw string) []string {
	out := make([]string, 0)
	for _, o := range strings.Split(raw, ",") {
		o = strings.TrimRight(strings.TrimSpace(o), "/")
		if o != "" && o != "*" {
			out = append(out, o)
		}
	}
	return out
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return strings.TrimSpace(val)
	}
	return strings.TrimSpace(defaultVal)
}
