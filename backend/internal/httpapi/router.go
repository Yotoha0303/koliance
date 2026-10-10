package httpapi

import (
	"errors"
	"fmt"
	"net/http"
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

// Deps are the services the router dispatches to.
type Deps struct {
	Cfg         *config.Config
	DB          *database.DB
	Game        *game.Service
	Cards       *agentcard.Service
	Market      *market.Service
	PriceOracle *market.PriceOracle
	Stripe      *stripeclient.Client
	Dev         *developer.Service
}

// Access model (see docs in backend/README.md):
//
//	public      read-only data, plus demo actions that only create *new*
//	            objects for the caller (card issue, proofs, Stripe test checkout)
//	card owner  `Authorization: Bearer <cardToken>` returned once by
//	            /agentcard/generate: card lookup, session-key issue, owner charge
//	agent       the session key (sk_sess_...) issued for that card: charge only
//	operator    `Authorization: Bearer $KOLIANCE_API_TOKEN`; fail closed (503)
//	            if unset: batch settle, Stripe customer, and Alpaca trade/close
//	            unless DEMO_PUBLIC_TRADING=true
func NewRouter(d Deps) http.Handler {
	cfg := d.Cfg
	mux := http.NewServeMux()
	h := func(path string, fn http.HandlerFunc) {
		mux.HandleFunc(path, cors(cfg.CORSAllowedOrigins, fn))
	}
	operator := func(fn http.HandlerFunc) http.HandlerFunc { return requireOperator(cfg.APIToken, fn) }
	// Alpaca paper trading acts on ONE shared account, so it is an operator
	// action unless the deployment explicitly opts into public demo trading.
	trading := func(fn http.HandlerFunc) http.HandlerFunc {
		if cfg.DemoPublicTrading {
			return fn
		}
		return operator(fn)
	}

	h("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		connected := d.DB != nil && d.DB.IsConnected
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
				"database":  connected,
			},
		})
	})

	h("/api/v1/stats", func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusOK, model.NetworkStats{
			ChainID:         10143,
			NetworkName:     "Monad Testnet",
			TotalIdentities: 128,
			TotalTrusts:     542,
			LiveTPS:         9840,
			Status:          "optimal",
		})
	})

	// ==================== GAME ====================

	h("/api/v1/game/steam/profile", methodOnly(http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
		identifier := r.URL.Query().Get("id")
		if identifier == "" {
			identifier = "76561198000000000" // Default fallback demo ID
		}
		stats, err := d.Game.GetUserGameStats(identifier)
		if err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, stats)
	}))

	h("/api/v1/game/proof", methodOnly(http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			SteamID       string `json:"steamId"`
			WalletAddress string `json:"walletAddress"`
			AppID         int    `json:"appId"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		proof, err := d.Game.GenerateGameplayProof(strings.TrimSpace(req.SteamID), strings.TrimSpace(req.WalletAddress), req.AppID)
		if err != nil {
			if errors.Is(err, game.ErrInvalidSteamID) || errors.Is(err, game.ErrInvalidWallet) {
				jsonError(w, http.StatusBadRequest, err.Error())
				return
			}
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, proof)
	}))

	// ==================== DEVELOPER (GITHUB) ====================

	h("/api/v1/developer/github/profile", methodOnly(http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
		username := strings.TrimSpace(r.URL.Query().Get("username"))
		if username == "" {
			username = "moonhotline"
		}
		if !validGitHubUser(username) {
			jsonError(w, http.StatusBadRequest, "invalid GitHub username")
			return
		}
		stats, err := d.Dev.GetDeveloperStats(username)
		if err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, stats)
	}))

	h("/api/v1/developer/github/proof", methodOnly(http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username      string `json:"username"`
			WalletAddress string `json:"walletAddress"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		req.Username = strings.TrimSpace(req.Username)
		if req.Username == "" {
			req.Username = "moonhotline"
		}
		if !validGitHubUser(req.Username) {
			jsonError(w, http.StatusBadRequest, "invalid GitHub username")
			return
		}
		if err := game.ValidateWallet(strings.TrimSpace(req.WalletAddress)); err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		proof, err := d.Dev.GenerateBUIDLProof(req.Username, strings.TrimSpace(req.WalletAddress))
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, proof)
	}))

	// ==================== AGENTCARD ====================

	h("/api/v1/agentcard/generate", methodOnly(http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			WalletAddress  string   `json:"walletAddress"`
			CardholderName string   `json:"cardholderName"`
			InitialDeposit *float64 `json:"initialDeposit"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		name := strings.TrimSpace(req.CardholderName)
		if name == "" {
			name = "KOLIANCE AGENT"
		}
		if len(name) > 64 {
			jsonError(w, http.StatusBadRequest, "cardholderName too long")
			return
		}
		deposit := agentcard.DefaultDepositUSD
		if req.InitialDeposit != nil {
			deposit = *req.InitialDeposit // explicit 0 / negative is rejected below
		}
		card, err := d.Cards.CreateCard(strings.TrimSpace(req.WalletAddress), name, deposit)
		if err != nil {
			jsonError(w, http.StatusBadRequest, "initialDeposit: "+err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, card)
	}))

	h("/api/v1/agentcard/cards/", methodOnly(http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
		cardID := strings.TrimPrefix(r.URL.Path, "/api/v1/agentcard/cards/")
		token := bearer(r)
		asOp := isOperator(cfg.APIToken, r)
		if token == "" {
			w.Header().Set("WWW-Authenticate", `Bearer realm="koliance"`)
			jsonError(w, http.StatusUnauthorized, "card token required")
			return
		}
		card, err := d.Cards.GetCard(cardID, token, asOp)
		if err != nil {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, card)
	}))

	h("/api/v1/agentcard/session-key", methodOnly(http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			CardID        string   `json:"cardId"`
			AgentID       string   `json:"agentId"`
			MaxPerTxUSD   float64  `json:"maxPerTxUSD"`
			DailyLimitUSD float64  `json:"dailyLimitUSD"`
			AllowedMCCs   []string `json:"allowedMCCs"`
			TTLHours      int      `json:"ttlHours"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		token := bearer(r)
		if token == "" {
			w.Header().Set("WWW-Authenticate", `Bearer realm="koliance"`)
			jsonError(w, http.StatusUnauthorized, "card token required")
			return
		}
		sk, err := d.Cards.IssueSessionKey(req.CardID, token, isOperator(cfg.APIToken, r), req.AgentID, req.MaxPerTxUSD, req.DailyLimitUSD, req.AllowedMCCs, req.TTLHours)
		if err != nil {
			status := http.StatusBadRequest
			if errors.Is(err, agentcard.ErrCardNotFound) {
				status = http.StatusNotFound
			}
			jsonError(w, status, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, sk)
	}))

	h("/api/v1/agentcard/authorize", methodOnly(http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		var req agentcard.AuthorizeRequest
		if !decodeJSON(w, r, &req) {
			return
		}
		resp, err := d.Cards.AuthorizeMicropayment(req, bearer(r))
		switch {
		case errors.Is(err, agentcard.ErrInvalidAmount):
			jsonError(w, http.StatusBadRequest, "amountUSD: "+err.Error())
		case errors.Is(err, agentcard.ErrUnauthorized):
			w.Header().Set("WWW-Authenticate", `Bearer realm="koliance"`)
			jsonError(w, http.StatusUnauthorized, err.Error())
		case err != nil:
			jsonError(w, http.StatusInternalServerError, err.Error())
		default:
			jsonResponse(w, http.StatusOK, resp)
		}
	}))

	h("/api/v1/agentcard/batch-settle", methodOnly(http.MethodPost, operator(func(w http.ResponseWriter, r *http.Request) {
		batchHash, count, volume := d.Cards.BatchSettle()
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"batchHash":    batchHash,
			"settledCount": count,
			"totalVolume":  volume,
			"timestamp":    time.Now().UTC(),
		})
	})))

	// ==================== MARKET ====================

	h("/api/v1/market/overview", methodOnly(http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
		overview, err := d.Market.GetMarketOverview()
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, overview)
	}))

	h("/api/v1/market/prices", methodOnly(http.MethodGet, func(w http.ResponseWriter, r *http.Request) {
		symbol := r.URL.Query().Get("symbol")
		if symbol != "" {
			sym, err := normalizeSymbol(symbol)
			if err != nil {
				jsonError(w, http.StatusBadRequest, err.Error())
				return
			}
			p, err := d.Market.GetPrice(sym)
			if err != nil {
				jsonError(w, http.StatusNotFound, err.Error())
				return
			}
			jsonResponse(w, http.StatusOK, p)
			return
		}
		prices, _ := d.PriceOracle.GetAllPrices()
		jsonResponse(w, http.StatusOK, prices)
	}))

	h("/api/v1/market/trade", methodOnly(http.MethodPost, trading(func(w http.ResponseWriter, r *http.Request) {
		var req market.TradeRequest
		if !decodeJSON(w, r, &req) {
			return
		}
		sym, err := normalizeSymbol(req.Symbol)
		if err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		req.Symbol = sym
		req.Side = strings.ToLower(strings.TrimSpace(req.Side))
		lev, err := validateTrade(req.Side, req.NotionalUSD, req.Leverage)
		if err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		req.Leverage = lev
		res, err := d.Market.ExecuteTrade(req)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, res)
	})))

	h("/api/v1/market/close", methodOnly(http.MethodPost, trading(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Symbol string `json:"symbol"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		sym, err := normalizeSymbol(req.Symbol)
		if err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := d.Market.ClosePosition(sym); err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, map[string]string{"message": "Position closed", "symbol": sym})
	})))

	// ==================== STRIPE ====================

	h("/api/v1/stripe/checkout-session", methodOnly(http.MethodPost, func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			AmountCents int64  `json:"amountCents"`
			Currency    string `json:"currency"`
			Description string `json:"description"`
			SuccessURL  string `json:"successUrl"`
			CancelURL   string `json:"cancelUrl"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		if err := validateStripeAmount(req.AmountCents); err != nil {
			jsonError(w, http.StatusBadRequest, err.Error())
			return
		}
		req.Currency = strings.ToLower(strings.TrimSpace(req.Currency))
		if req.Currency == "" {
			req.Currency = "usd"
		}
		if req.Currency != "usd" {
			jsonError(w, http.StatusBadRequest, `currency must be "usd"`)
			return
		}
		if len(req.Description) > 200 {
			jsonError(w, http.StatusBadRequest, "description too long")
			return
		}
		if req.SuccessURL == "" {
			req.SuccessURL = "https://" + cfg.SteamDomain + "/agentcard?status=success"
		} else if !sameOriginAllowed(req.SuccessURL, cfg.CORSAllowedOrigins) {
			jsonError(w, http.StatusBadRequest, "successUrl must be on an allowed origin")
			return
		}
		if req.CancelURL == "" {
			req.CancelURL = "https://" + cfg.SteamDomain + "/agentcard?status=cancel"
		} else if !sameOriginAllowed(req.CancelURL, cfg.CORSAllowedOrigins) {
			jsonError(w, http.StatusBadRequest, "cancelUrl must be on an allowed origin")
			return
		}
		sess, err := d.Stripe.CreateCheckoutSession(req.SuccessURL, req.CancelURL, req.AmountCents, req.Currency, req.Description)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, map[string]interface{}{"id": sess.ID, "url": sess.URL})
	}))

	h("/api/v1/stripe/customer", methodOnly(http.MethodPost, operator(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Email         string `json:"email"`
			Name          string `json:"name"`
			WalletAddress string `json:"walletAddress"`
		}
		if !decodeJSON(w, r, &req) {
			return
		}
		cust, err := d.Stripe.CreateCustomer(req.Email, req.Name, req.WalletAddress)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonResponse(w, http.StatusOK, map[string]interface{}{"customerId": cust.ID, "email": cust.Email})
	})))

	return mux
}
