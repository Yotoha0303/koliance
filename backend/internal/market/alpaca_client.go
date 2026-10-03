package market

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type AlpacaClient struct {
	baseURL    string
	keyID      string
	secretKey  string
	httpClient *http.Client
}

func NewAlpacaClient(baseURL, keyID, secretKey string) *AlpacaClient {
	return &AlpacaClient{
		baseURL:   baseURL,
		keyID:     keyID,
		secretKey: secretKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type AlpacaAccount struct {
	ID                     string `json:"id"`
	AccountNumber          string `json:"account_number"`
	Status                 string `json:"status"`
	Currency               string `json:"currency"`
	BuyingPower            string `json:"buying_power"`
	Cash                   string `json:"cash"`
	PortfolioValue         string `json:"portfolio_value"`
	Equity                 string `json:"equity"`
	Multiplier             string `json:"multiplier"` // 4 for day trading leverage
	ShortingEnabled        bool   `json:"shorting_enabled"`
	LongMarketValue        string `json:"long_market_value"`
	ShortMarketValue       string `json:"short_market_value"`
	InitialMargin          string `json:"initial_margin"`
	MaintenanceMargin      string `json:"maintenance_margin"`
}

type AlpacaPosition struct {
	AssetID        string `json:"asset_id"`
	Symbol         string `json:"symbol"`
	Exchange       string `json:"exchange"`
	Qty            string `json:"qty"`
	AvgEntryPrice  string `json:"avg_entry_price"`
	Side           string `json:"side"` // "long" or "short"
	MarketValue    string `json:"market_value"`
	CostBasis      string `json:"cost_basis"`
	UnrealizedPL   string `json:"unrealized_pl"`
	UnrealizedPLPC string `json:"unrealized_plpc"`
	CurrentPrice   string `json:"current_price"`
	ChangeToday    string `json:"change_today"`
}

type OrderRequest struct {
	Symbol        string `json:"symbol"`
	Qty           string `json:"qty,omitempty"`
	Notional      string `json:"notional,omitempty"` // USD amount
	Side          string `json:"side"`               // "buy" (Long) or "sell" (Short)
	Type          string `json:"type"`               // "market" or "limit"
	TimeInForce   string `json:"time_in_force"`      // "day" or "gtc"
	LimitPrice    string `json:"limit_price,omitempty"`
}

type AlpacaOrder struct {
	ID            string    `json:"id"`
	ClientOrderID string    `json:"client_order_id"`
	CreatedAt     time.Time `json:"created_at"`
	Symbol        string    `json:"symbol"`
	Qty           string    `json:"qty"`
	FilledQty     string    `json:"filled_qty"`
	Side          string    `json:"side"`
	Type          string    `json:"type"`
	Status        string    `json:"status"` // "new", "filled", "partially_filled"
}

func (c *AlpacaClient) doRequest(method, endpoint string, body interface{}) ([]byte, error) {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, c.baseURL+endpoint, bodyReader)
	if err != nil {
		return nil, err
	}

	req.Header.Set("APCA-API-KEY-ID", c.keyID)
	req.Header.Set("APCA-API-SECRET-KEY", c.secretKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("alpaca API error [%d]: %s", resp.StatusCode, string(respBytes))
	}

	return respBytes, nil
}

// GetAccount fetches account balance, buying power, and leverage stats
func (c *AlpacaClient) GetAccount() (*AlpacaAccount, error) {
	bytes, err := c.doRequest("GET", "/account", nil)
	if err != nil {
		return nil, err
	}

	var acc AlpacaAccount
	if err := json.Unmarshal(bytes, &acc); err != nil {
		return nil, err
	}
	return &acc, nil
}

// GetPositions retrieves current open positions
func (c *AlpacaClient) GetPositions() ([]AlpacaPosition, error) {
	bytes, err := c.doRequest("GET", "/positions", nil)
	if err != nil {
		return nil, err
	}

	var positions []AlpacaPosition
	if err := json.Unmarshal(bytes, &positions); err != nil {
		return nil, err
	}
	return positions, nil
}

// CreateOrder submits a market or limit order (supporting buy/sell and margin leverage)
func (c *AlpacaClient) CreateOrder(req OrderRequest) (*AlpacaOrder, error) {
	if req.TimeInForce == "" {
		req.TimeInForce = "day"
	}
	if req.Type == "" {
		req.Type = "market"
	}

	bytes, err := c.doRequest("POST", "/orders", req)
	if err != nil {
		return nil, err
	}

	var order AlpacaOrder
	if err := json.Unmarshal(bytes, &order); err != nil {
		return nil, err
	}
	return &order, nil
}

// ClosePosition closes an existing Long or Short position
func (c *AlpacaClient) ClosePosition(symbol string) error {
	_, err := c.doRequest("DELETE", fmt.Sprintf("/positions/%s", symbol), nil)
	return err
}
