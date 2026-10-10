package main

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/koliance/backend/internal/agentcard"
	"github.com/koliance/backend/internal/config"
	"github.com/koliance/backend/internal/developer"
	"github.com/koliance/backend/internal/game"
	"github.com/koliance/backend/internal/httpapi"
	"github.com/koliance/backend/internal/market"
	"github.com/koliance/backend/internal/platform/database"
	"github.com/koliance/backend/internal/platform/stripeclient"
)

func main() {
	cfg := config.Load()

	// 1. Initialize Database
	db := database.New(cfg.DatabaseURL)
	defer db.Close()

	// 2. Initialize Steam Client & Service
	steamCli := game.NewSteamClient(cfg.SteamAPIKey)
	gameService := game.NewService(steamCli, db)

	// 3. Initialize AgentCard Guard & Service
	guard := agentcard.NewPermissionGuard()
	cardService := agentcard.NewService(guard, db)

	// 4. Initialize Market Alpaca & Real-time Price Oracle
	alpacaCli := market.NewAlpacaClient(cfg.AlpacaBaseURL, cfg.AlpacaAPIKey, cfg.AlpacaAPISecret)
	priceOracle := market.NewPriceOracle(cfg.AlpacaAPIKey, cfg.AlpacaAPISecret)
	marketService := market.NewService(alpacaCli, priceOracle, db)

	// 5. Initialize Stripe Client
	stripeCli := stripeclient.New(cfg.StripeSecretKey)

	// 6. Initialize GitHub Developer Service
	githubCli := developer.NewGitHubClient("")
	devService := developer.NewService(githubCli)

	handler := httpapi.NewRouter(httpapi.Deps{
		Cfg:         cfg,
		DB:          db,
		Game:        gameService,
		Cards:       cardService,
		Market:      marketService,
		PriceOracle: priceOracle,
		Stripe:      stripeCli,
		Dev:         devService,
	})

	port := cfg.Port
	if p, err := strconv.Atoi(port); err != nil || p <= 0 {
		port = "8080"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	fmt.Printf("🚀 Koliance Go Backend Service listening on http://localhost:%s\n", port)
	fmt.Printf("   ├─ Steam Web API: Active (%s)\n", cfg.SteamDomain)
	fmt.Printf("   ├─ Alpaca Paper API: Active (%s)\n", cfg.AlpacaBaseURL)
	fmt.Printf("   ├─ Pyth Hermes Oracle: Active (%s)\n", cfg.PythHermesURL)
	fmt.Printf("   ├─ Stripe Integration: Ready (Key loaded: %t)\n", cfg.StripeSecretKey != "")
	fmt.Printf("   ├─ CORS origins: %v\n", cfg.CORSAllowedOrigins)
	fmt.Printf("   └─ Operator token configured: %t, public demo trading: %t\n", cfg.APIToken != "", cfg.DemoPublicTrading)

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed: %v", err)
	}
}
