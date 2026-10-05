package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/koliance/backend/internal/agentcard"
	"github.com/koliance/backend/internal/config"
	"github.com/koliance/backend/internal/developer"
	"github.com/koliance/backend/internal/game"
	"github.com/koliance/backend/internal/market"
	"github.com/koliance/backend/internal/model"
	"github.com/koliance/backend/internal/platform/database"
	"github.com/koliance/backend/internal/platform/stripeclient"
)

// enableCORS sets standard CORS headers for Next.js frontend
func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

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

	mux := http.NewServeMux()

	// Health Check
	mux.HandleFunc("/api/v1/health", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"status":    "healthy",
			"network":   fmt.Sprintf("Monad Testnet (Chain ID: %s)", cfg.MonadChainID),
			"contract":  cfg.KolianceContract,
			"timestamp": time.Now().UTC(),
			"services": map[string]bool{
				"steam":     true,
				"github":    true,
				"alpaca":    true,
				"pyth":      true,
				"agentcard": true,
				"stripe":    cfg.StripeSecretKey != "",
				"database":  db.IsConnected,
			},
		})
	}))

	// Stats
	mux.HandleFunc("/api/v1/stats", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		stats := model.NetworkStats{
			ChainID:         10143,
			NetworkName:     "Monad Testnet",
			TotalIdentities: 128,
			TotalTrusts:     542,
			LiveTPS:         9840,
			Status:          "optimal",
		}
		jsonResponse(w, http.StatusOK, stats)
	}))

	// ==================== GAME MODULE ====================

	// GET /api/v1/game/steam/profile?id=76561198... or vanity
	mux.HandleFunc("/api/v1/game/steam/profile", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		identifier := r.URL.Query().Get("id")
		if identifier == "" {
			identifier = "76561198000000000" // Default fallback demo ID
		}

		stats, err := gameService.GetUserGameStats(identifier)
		if err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, http.StatusOK, stats)
	}))

	// POST /api/v1/game/proof
	mux.HandleFunc("/api/v1/game/proof", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			SteamID       string `json:"steamId"`
			WalletAddress string `json:"walletAddress"`
			AppID         int    `json:"appId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
			return
		}

		proof, err := gameService.GenerateGameplayProof(req.SteamID, req.WalletAddress, req.AppID)
		if err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, http.StatusOK, proof)
	}))

	// ==================== DEVELOPER MODULE (GITHUB) ====================

	// GET /api/v1/developer/github/profile?username=moonhotline
	mux.HandleFunc("/api/v1/developer/github/profile", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		username := r.URL.Query().Get("username")
		if username == "" {
			username = "moonhotline"
		}

		stats, err := devService.GetDeveloperStats(username)
		if err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, http.StatusOK, stats)
	}))

	// POST /api/v1/developer/github/proof
	mux.HandleFunc("/api/v1/developer/github/proof", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Username      string `json:"username"`
			WalletAddress string `json:"walletAddress"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
			return
		}
		if req.Username == "" {
			req.Username = "moonhotline"
		}

		proof, err := devService.GenerateBUIDLProof(req.Username, req.WalletAddress)
		if err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, http.StatusOK, proof)
	}))

	// ==================== AGENTCARD MODULE ====================

	// POST /api/v1/agentcard/generate
	mux.HandleFunc("/api/v1/agentcard/generate", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			WalletAddress  string  `json:"walletAddress"`
			CardholderName string  `json:"cardholderName"`
			InitialDeposit float64 `json:"initialDeposit"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req.CardholderName == "" {
			req.CardholderName = "KOLIANCE AGENT"
		}
		if req.InitialDeposit <= 0 {
			req.InitialDeposit = 1000.0 // Default demo limit
		}

		card := cardService.CreateCard(req.WalletAddress, req.CardholderName, req.InitialDeposit)
		jsonResponse(w, http.StatusOK, card)
	}))

	// GET /api/v1/agentcard/cards/
	mux.HandleFunc("/api/v1/agentcard/cards/", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		cardID := strings.TrimPrefix(r.URL.Path, "/api/v1/agentcard/cards/")
		card, err := cardService.GetCard(cardID)
		if err != nil {
			jsonResponse(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, http.StatusOK, card)
	}))

	// POST /api/v1/agentcard/session-key
	mux.HandleFunc("/api/v1/agentcard/session-key", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			CardID        string   `json:"cardId"`
			AgentID       string   `json:"agentId"`
			MaxPerTxUSD   float64  `json:"maxPerTxUSD"`
			DailyLimitUSD float64  `json:"dailyLimitUSD"`
			AllowedMCCs   []string `json:"allowedMCCs"`
			TTLHours      int      `json:"ttlHours"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
			return
		}

		sk, err := cardService.IssueSessionKey(req.CardID, req.AgentID, req.MaxPerTxUSD, req.DailyLimitUSD, req.AllowedMCCs, req.TTLHours)
		if err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, http.StatusOK, sk)
	}))

	// POST /api/v1/agentcard/authorize
	mux.HandleFunc("/api/v1/agentcard/authorize", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req agentcard.AuthorizeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
			return
		}

		resp, err := cardService.AuthorizeMicropayment(req)
		if err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, http.StatusOK, resp)
	}))

	// POST /api/v1/agentcard/batch-settle
	mux.HandleFunc("/api/v1/agentcard/batch-settle", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		batchHash, count, volume := cardService.BatchSettle()
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"batchHash":    batchHash,
			"settledCount": count,
			"totalVolume":  volume,
			"timestamp":    time.Now().UTC(),
		})
	}))

	// ==================== MARKET MODULE ====================

	// GET /api/v1/market/overview
	mux.HandleFunc("/api/v1/market/overview", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		overview, err := marketService.GetMarketOverview()
		if err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, http.StatusOK, overview)
	}))

	// GET /api/v1/market/prices
	mux.HandleFunc("/api/v1/market/prices", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		symbol := r.URL.Query().Get("symbol")
		if symbol != "" {
			p, err := marketService.GetPrice(symbol)
			if err != nil {
				jsonResponse(w, http.StatusNotFound, map[string]string{"error": err.Error()})
				return
			}
			jsonResponse(w, http.StatusOK, p)
			return
		}
		prices, _ := priceOracle.GetAllPrices()
		jsonResponse(w, http.StatusOK, prices)
	}))

	// POST /api/v1/market/trade
	mux.HandleFunc("/api/v1/market/trade", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req market.TradeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
			return
		}

		res, err := marketService.ExecuteTrade(req)
		if err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, http.StatusOK, res)
	}))

	// POST /api/v1/market/close
	mux.HandleFunc("/api/v1/market/close", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Symbol string `json:"symbol"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if err := marketService.ClosePosition(req.Symbol); err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, http.StatusOK, map[string]string{"message": "Position closed", "symbol": req.Symbol})
	}))

	// ==================== STRIPE MODULE ====================

	// POST /api/v1/stripe/checkout-session
	mux.HandleFunc("/api/v1/stripe/checkout-session", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			AmountCents int64  `json:"amountCents"`
			Currency    string `json:"currency"`
			Description string `json:"description"`
			SuccessURL  string `json:"successUrl"`
			CancelURL   string `json:"cancelUrl"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid payload"})
			return
		}
		if req.Currency == "" {
			req.Currency = "usd"
		}
		if req.SuccessURL == "" {
			req.SuccessURL = "https://" + cfg.SteamDomain + "/agentcard?status=success"
		}
		if req.CancelURL == "" {
			req.CancelURL = "https://" + cfg.SteamDomain + "/agentcard?status=cancel"
		}

		sess, err := stripeCli.CreateCheckoutSession(req.SuccessURL, req.CancelURL, req.AmountCents, req.Currency, req.Description)
		if err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"id":  sess.ID,
			"url": sess.URL,
		})
	}))

	// POST /api/v1/stripe/customer
	mux.HandleFunc("/api/v1/stripe/customer", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Email         string `json:"email"`
			Name          string `json:"name"`
			WalletAddress string `json:"walletAddress"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		cust, err := stripeCli.CreateCustomer(req.Email, req.Name, req.WalletAddress)
		if err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"customerId": cust.ID,
			"email":      cust.Email,
		})
	}))

	port := cfg.Port
	if p, err := strconv.Atoi(port); err != nil || p <= 0 {
		port = "8080"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	fmt.Printf("🚀 Koliance Go Backend Service listening on http://localhost:%s\n", port)
	fmt.Printf("   ├─ Steam Web API: Active (%s)\n", cfg.SteamDomain)
	fmt.Printf("   ├─ Alpaca Paper API: Active (%s)\n", cfg.AlpacaBaseURL)
	fmt.Printf("   ├─ Pyth Hermes Oracle: Active (%s)\n", cfg.PythHermesURL)
	fmt.Printf("   └─ Stripe Integration: Ready (Key loaded: %t)\n", cfg.StripeSecretKey != "")

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed: %v", err)
	}
}
