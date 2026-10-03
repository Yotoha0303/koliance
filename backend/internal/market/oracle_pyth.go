package market

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type PriceOracle struct {
	alpacaDataURL string
	keyID         string
	secretKey     string
	httpClient    *http.Client
}

func NewPriceOracle(keyID, secretKey string) *PriceOracle {
	return &PriceOracle{
		alpacaDataURL: "https://data.alpaca.markets/v2/stocks/bars/latest",
		keyID:         keyID,
		secretKey:     secretKey,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

type PythPriceData struct {
	Symbol     string    `json:"symbol"`
	FeedID     string    `json:"feedId"`
	Price      float64   `json:"price"`
	Confidence float64   `json:"confidence"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type alpacaBarsResponse struct {
	Bars map[string]struct {
		Close  float64   `json:"c"`
		High   float64   `json:"h"`
		Low    float64   `json:"l"`
		Open   float64   `json:"o"`
		Volume int64     `json:"v"`
		Time   time.Time `json:"t"`
	} `json:"bars"`
}

// GetLatestPrice returns real-time market price for a symbol
func (p *PriceOracle) GetLatestPrice(symbol string) (*PythPriceData, error) {
	all, err := p.GetAllPrices()
	if err != nil {
		return nil, err
	}
	for _, item := range all {
		if item.Symbol == symbol {
			return &item, nil
		}
	}
	return nil, fmt.Errorf("symbol not found: %s", symbol)
}

// GetAllPrices returns batch of real-time quotes using Alpaca Data API
func (p *PriceOracle) GetAllPrices() ([]PythPriceData, error) {
	symbols := "NVDA,AAPL,TSLA,SPY"
	url := fmt.Sprintf("%s?symbols=%s", p.alpacaDataURL, symbols)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("APCA-API-KEY-ID", p.keyID)
	req.Header.Set("APCA-API-SECRET-KEY", p.secretKey)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data alpacaBarsResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	results := make([]PythPriceData, 0, len(data.Bars))
	for sym, bar := range data.Bars {
		results = append(results, PythPriceData{
			Symbol:     sym,
			FeedID:     "alpaca_us_equity",
			Price:      bar.Close,
			Confidence: 0.01,
			UpdatedAt:  bar.Time,
		})
	}

	return results, nil
}
