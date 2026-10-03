package agentcard

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/koliance/backend/internal/platform/database"
)

type Transaction struct {
	TxID            string    `json:"txId"`
	CardID          string    `json:"cardId"`
	AmountUSD       float64   `json:"amountUSD"`
	MerchantName    string    `json:"merchantName"`
	MCC             string    `json:"mcc"` // Merchant Category Code
	AuthCode        string    `json:"authCode"`
	ResponseCode    string    `json:"responseCode"` // "00" = Approved, "51" = Insufficient Funds, "57" = Not Permitted
	SessionKey      string    `json:"sessionKey,omitempty"`
	Status          string    `json:"status"`       // APPROVED, DECLINED, SETTLED
	MonadBatchHash  string    `json:"monadBatchHash,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
}

type Service struct {
	mu           sync.RWMutex
	cards        map[string]*VisaCard
	transactions []*Transaction
	guard        *PermissionGuard
	db           *database.DB
}

func NewService(guard *PermissionGuard, db *database.DB) *Service {
	return &Service{
		cards:        make(map[string]*VisaCard),
		transactions: make([]*Transaction, 0),
		guard:        guard,
		db:           db,
	}
}

func (s *Service) CreateCard(walletAddress, holderName string, deposit float64) *VisaCard {
	card := GenerateVisaCard(walletAddress, holderName, deposit)

	s.mu.Lock()
	s.cards[card.CardID] = card
	s.mu.Unlock()

	if s.db != nil && s.db.MemoryStore != nil {
		s.db.MemoryStore.SaveCard(card.CardID, map[string]interface{}{
			"cardId":     card.CardID,
			"number":     card.CardNumber,
			"wallet":     card.WalletAddress,
			"balanceUSD": card.BalanceUSD,
			"status":     card.Status,
		})
	}

	return card
}

func (s *Service) GetCard(cardID string) (*VisaCard, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	c, ok := s.cards[cardID]
	if !ok {
		return nil, errors.New("card not found")
	}
	return c, nil
}

type AuthorizeRequest struct {
	CardID       string  `json:"cardId"`
	SessionKey   string  `json:"sessionKey"`
	AmountUSD    float64 `json:"amountUSD"`
	MerchantName string  `json:"merchantName"`
	MCC          string  `json:"mcc"`
}

type AuthorizeResponse struct {
	Success      bool         `json:"success"`
	AuthCode     string       `json:"authCode"`
	ResponseCode string       `json:"responseCode"`
	Message      string       `json:"message"`
	RemainingUSD float64      `json:"remainingUSD"`
	Transaction  *Transaction `json:"transaction"`
}

// AuthorizeMicropayment executes zero-delay micro-payment checking session bounds & card balance
func (s *Service) AuthorizeMicropayment(req AuthorizeRequest) (*AuthorizeResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	card, ok := s.cards[req.CardID]
	if !ok {
		return &AuthorizeResponse{
			Success:      false,
			ResponseCode: "14", // Invalid card number
			Message:      "Card does not exist",
		}, nil
	}

	if card.Status != "ACTIVE" {
		return &AuthorizeResponse{
			Success:      false,
			ResponseCode: "54", // Expired/Frozen card
			Message:      "Card is not active",
		}, nil
	}

	// 1. Verify session key permissions
	if req.SessionKey != "" {
		if err := s.guard.VerifyAndDeduct(req.SessionKey, req.AmountUSD, req.MCC); err != nil {
			return &AuthorizeResponse{
				Success:      false,
				ResponseCode: "57", // Transaction not permitted
				Message:      err.Error(),
			}, nil
		}
	}

	// 2. Check balance
	if card.BalanceUSD < req.AmountUSD {
		return &AuthorizeResponse{
			Success:      false,
			ResponseCode: "51", // Insufficient funds
			Message:      fmt.Sprintf("Insufficient balance: $%.2f available, $%.2f requested", card.BalanceUSD, req.AmountUSD),
		}, nil
	}

	// 3. Deduct balance
	card.BalanceUSD -= req.AmountUSD

	authCode := fmt.Sprintf("AUTH_%d", time.Now().UnixNano()%1000000)
	txID := fmt.Sprintf("tx_%d", time.Now().UnixNano())

	tx := &Transaction{
		TxID:         txID,
		CardID:       card.CardID,
		AmountUSD:    req.AmountUSD,
		MerchantName: req.MerchantName,
		MCC:          req.MCC,
		AuthCode:     authCode,
		ResponseCode: "00", // Approved
		SessionKey:   req.SessionKey,
		Status:       "APPROVED",
		CreatedAt:    time.Now().UTC(),
	}

	s.transactions = append(s.transactions, tx)

	if s.db != nil && s.db.MemoryStore != nil {
		s.db.MemoryStore.AppendTransaction(map[string]interface{}{
			"txId":      tx.TxID,
			"cardId":    tx.CardID,
			"amountUSD": tx.AmountUSD,
			"merchant":  tx.MerchantName,
			"authCode":  tx.AuthCode,
		})
	}

	return &AuthorizeResponse{
		Success:      true,
		AuthCode:     authCode,
		ResponseCode: "00",
		Message:      "Approved",
		RemainingUSD: card.BalanceUSD,
		Transaction:  tx,
	}, nil
}

// IssueSessionKey proxies guard call
func (s *Service) IssueSessionKey(cardID, agentID string, maxPerTx, dailyLimit float64, allowedMCCs []string, ttlHours int) (*SessionKey, error) {
	s.mu.RLock()
	_, ok := s.cards[cardID]
	s.mu.RUnlock()
	if !ok {
		return nil, errors.New("card does not exist")
	}
	return s.guard.IssueSessionKey(cardID, agentID, maxPerTx, dailyLimit, allowedMCCs, ttlHours), nil
}

// BatchSettle generates a cryptographic proof of settled micropayments for Monad
func (s *Service) BatchSettle() (string, int, float64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var unsettledCount int
	var totalVolume float64

	for _, tx := range s.transactions {
		if tx.Status == "APPROVED" && tx.MonadBatchHash == "" {
			unsettledCount++
			totalVolume += tx.AmountUSD
		}
	}

	if unsettledCount == 0 {
		return "", 0, 0
	}

	raw := fmt.Sprintf("MONAD_BATCH_SETTLE:%d:%f:%d", unsettledCount, totalVolume, time.Now().Unix())
	h := sha256.Sum256([]byte(raw))
	batchHash := "0x" + hex.EncodeToString(h[:])

	for _, tx := range s.transactions {
		if tx.Status == "APPROVED" && tx.MonadBatchHash == "" {
			tx.Status = "SETTLED"
			tx.MonadBatchHash = batchHash
		}
	}

	return batchHash, unsettledCount, totalVolume
}
