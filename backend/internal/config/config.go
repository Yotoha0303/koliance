package config

import (
	"log"
	"os"

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
}

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

	log.Printf("[Config] Loaded configuration: Port=%s, SteamDomain=%s, AlpacaBase=%s", cfg.Port, cfg.SteamDomain, cfg.AlpacaBaseURL)
	return cfg
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
