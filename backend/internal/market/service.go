package market

import (
	"fmt"
	"strconv"

	"github.com/koliance/backend/internal/platform/database"
)

type Service struct {
	alpaca *AlpacaClient
	oracle *PriceOracle
	db     *database.DB
}

func NewService(alpaca *AlpacaClient, oracle *PriceOracle, db *database.DB) *Service {
	return &Service{
		alpaca: alpaca,
		oracle: oracle,
		db:     db,
	}
}

type MarketOverview struct {
	Account   *AlpacaAccount   `json:"account"`
	Positions []AlpacaPosition `json:"positions"`
	Prices    []PythPriceData  `json:"realtimePrices"`
}

type TradeRequest struct {
	Symbol      string  `json:"symbol"`
	Side        string  `json:"side"`        // "buy" (Long) or "sell" (Short)
	NotionalUSD float64 `json:"notionalUSD"` // Target trade volume
	Leverage    float64 `json:"leverage"`    // 1x to 4x
}

type TradeResult struct {
	Success     bool         `json:"success"`
	Order       *AlpacaOrder `json:"order,omitempty"`
	Message     string       `json:"message"`
	Symbol      string       `json:"symbol"`
	Side        string       `json:"side"`
	NotionalUSD float64      `json:"notionalUSD"`
}

func (s *Service) GetMarketOverview() (*MarketOverview, error) {
	acc, err := s.alpaca.GetAccount()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch alpaca account: %w", err)
	}

	positions, _ := s.alpaca.GetPositions()
	prices, _ := s.oracle.GetAllPrices()

	return &MarketOverview{
		Account:   acc,
		Positions: positions,
		Prices:    prices,
	}, nil
}

func (s *Service) ExecuteTrade(req TradeRequest) (*TradeResult, error) {
	if req.NotionalUSD <= 0 {
		return &TradeResult{Success: false, Message: "Notional USD must be greater than zero"}, nil
	}

	// Format notional to 2 decimal places string
	notionalStr := strconv.FormatFloat(req.NotionalUSD, 'f', 2, 64)

	order, err := s.alpaca.CreateOrder(OrderRequest{
		Symbol:      req.Symbol,
		Notional:    notionalStr,
		Side:        req.Side,
		Type:        "market",
		TimeInForce: "day",
	})
	if err != nil {
		return &TradeResult{
			Success:     false,
			Message:     err.Error(),
			Symbol:      req.Symbol,
			Side:        req.Side,
			NotionalUSD: req.NotionalUSD,
		}, nil
	}

	return &TradeResult{
		Success:     true,
		Order:       order,
		Message:     fmt.Sprintf("Order placed successfully for %s (%s)", req.Symbol, req.Side),
		Symbol:      req.Symbol,
		Side:        req.Side,
		NotionalUSD: req.NotionalUSD,
	}, nil
}

func (s *Service) ClosePosition(symbol string) error {
	return s.alpaca.ClosePosition(symbol)
}

func (s *Service) GetPrice(symbol string) (*PythPriceData, error) {
	return s.oracle.GetLatestPrice(symbol)
}
