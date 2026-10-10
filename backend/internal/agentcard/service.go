package agentcard

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/koliance/backend/internal/platform/database"
)

// Money bounds for the demo card. Every amount that moves a balance goes
// through ValidateAmount: a negative "charge" used to *credit* the card
// (balance 100 -> 5100 for amountUSD = -5000).
const (
	MaxAmountUSD       = 100_000.0
	DefaultDepositUSD  = 1000.0
	MaxSessionTTLHours = 24 * 30
)

var (
	ErrInvalidAmount = errors.New("amount must be a finite number greater than 0 and at most 100000")
	ErrCardNotFound  = errors.New("card not found")
	ErrUnauthorized  = errors.New("missing or invalid card credential")
)

// ValidateAmount rejects zero, negative, NaN, Inf and absurdly large amounts.
func ValidateAmount(v float64) error {
	if math.IsNaN(v) || math.IsInf(v, 0) || v <= 0 || v > MaxAmountUSD {
		return ErrInvalidAmount
	}
	return nil
}

type Transaction struct {
	TxID           string    `json:"txId"`
	CardID         string    `json:"cardId"`
	AmountUSD      float64   `json:"amountUSD"`
	MerchantName   string    `json:"merchantName"`
	MCC            string    `json:"mcc"` // Merchant Category Code
	AuthCode       string    `json:"authCode"`
	ResponseCode   string    `json:"responseCode"` // "00" = Approved, "51" = Insufficient Funds, "57" = Not Permitted
	SessionKey     string    `json:"-"`            // bearer credential, never echoed back
	Status         string    `json:"status"`       // APPROVED, DECLINED, SETTLED
	MonadBatchHash string    `json:"monadBatchHash,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
}

// CardView is the only shape a card is ever serialised in. No PAN, no CVV.
type CardView struct {
	CardID          string    `json:"cardId"`
	FormattedNumber string    `json:"formattedNumber"`
	Last4           string    `json:"last4"`
	Expiry          string    `json:"expiry"`
	CardholderName  string    `json:"cardholderName"`
	WalletAddress   string    `json:"walletAddress"`
	BalanceUSD      float64   `json:"balanceUSD"`
	Status          string    `json:"status"`
	CreatedAt       time.Time `json:"createdAt"`
}

// CreatedCard is returned once, at creation. CardToken is the card owner's
// bearer credential; only its SHA-256 is kept server side, so it cannot be
// recovered later.
type CreatedCard struct {
	CardView
	CardToken string `json:"cardToken"`
}

func viewOf(c *VisaCard) CardView {
	return CardView{
		CardID:          c.CardID,
		FormattedNumber: c.FormattedNumber,
		Last4:           c.Last4,
		Expiry:          c.Expiry,
		CardholderName:  c.CardholderName,
		WalletAddress:   c.WalletAddress,
		BalanceUSD:      c.BalanceUSD,
		Status:          c.Status,
		CreatedAt:       c.CreatedAt,
	}
}

type Service struct {
	mu           sync.RWMutex
	cards        map[string]*VisaCard
	tokenHashes  map[string][32]byte // cardID -> sha256(cardToken)
	transactions []*Transaction
	guard        *PermissionGuard
	db           *database.DB
}

func NewService(guard *PermissionGuard, db *database.DB) *Service {
	return &Service{
		cards:        make(map[string]*VisaCard),
		tokenHashes:  make(map[string][32]byte),
		transactions: make([]*Transaction, 0),
		guard:        guard,
		db:           db,
	}
}

func newCardToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("crypto/rand unavailable: %v", err))
	}
	return "ct_" + hex.EncodeToString(b)
}

// CreateCard issues a card and returns the one-time owner token with it.
func (s *Service) CreateCard(walletAddress, holderName string, deposit float64) (*CreatedCard, error) {
	if err := ValidateAmount(deposit); err != nil {
		return nil, err
	}
	card := GenerateVisaCard(walletAddress, holderName, deposit)
	token := newCardToken()

	s.mu.Lock()
	s.cards[card.CardID] = card
	s.tokenHashes[card.CardID] = sha256.Sum256([]byte(token))
	view := viewOf(card)
	s.mu.Unlock()

	if s.db != nil && s.db.MemoryStore != nil {
		// Only the last 4 digits are persisted; the PAN and CVV stay in the
		// in-process record that is never serialised.
		s.db.MemoryStore.SaveCard(card.CardID, map[string]interface{}{
			"cardId":     card.CardID,
			"last4":      card.Last4,
			"wallet":     card.WalletAddress,
			"balanceUSD": card.BalanceUSD,
			"status":     card.Status,
		})
	}

	return &CreatedCard{CardView: view, CardToken: token}, nil
}

// checkCardToken must be called with s.mu held (read or write).
func (s *Service) checkCardToken(cardID, token string) bool {
	want, ok := s.tokenHashes[cardID]
	if !ok || token == "" {
		return false
	}
	got := sha256.Sum256([]byte(token))
	return subtle.ConstantTimeCompare(want[:], got[:]) == 1
}

// GetCard returns the masked view. The caller must present the card token,
// unless it is the operator (asOperator == true). Unknown card and wrong token
// both answer ErrCardNotFound so the endpoint is not an existence oracle.
func (s *Service) GetCard(cardID, token string, asOperator bool) (*CardView, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	c, ok := s.cards[cardID]
	if !ok {
		return nil, ErrCardNotFound
	}
	if !asOperator && !s.checkCardToken(cardID, token) {
		return nil, ErrCardNotFound
	}
	v := viewOf(c)
	return &v, nil
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

// AuthorizeMicropayment charges a card. The caller must hold a credential for
// *this* card: either a session key issued for it (the agent path) or the card
// token (the owner path). Previously an empty session key skipped every check,
// so anyone who knew a card ID could charge it.
func (s *Service) AuthorizeMicropayment(req AuthorizeRequest, cardToken string) (*AuthorizeResponse, error) {
	if err := ValidateAmount(req.AmountUSD); err != nil {
		return nil, err
	}

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

	usingSessionKey := req.SessionKey != ""
	if !usingSessionKey && !s.checkCardToken(req.CardID, cardToken) {
		return nil, ErrUnauthorized
	}

	if card.Status != "ACTIVE" {
		return &AuthorizeResponse{
			Success:      false,
			ResponseCode: "54", // Expired/Frozen card
			Message:      "Card is not active",
		}, nil
	}

	// Balance is checked before the session key is debited, so a declined
	// charge does not eat into the agent's daily allowance.
	if card.BalanceUSD < req.AmountUSD {
		return &AuthorizeResponse{
			Success:      false,
			ResponseCode: "51", // Insufficient funds
			Message:      fmt.Sprintf("Insufficient balance: $%.2f available, $%.2f requested", card.BalanceUSD, req.AmountUSD),
		}, nil
	}

	if usingSessionKey {
		if err := s.guard.VerifyAndDeduct(req.SessionKey, req.CardID, req.AmountUSD, req.MCC); err != nil {
			return &AuthorizeResponse{
				Success:      false,
				ResponseCode: "57", // Transaction not permitted
				Message:      err.Error(),
			}, nil
		}
	}

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

// IssueSessionKey lets the card owner delegate a bounded allowance to an
// agent. Requires the card token (or the operator).
func (s *Service) IssueSessionKey(cardID, cardToken string, asOperator bool, agentID string, maxPerTx, dailyLimit float64, allowedMCCs []string, ttlHours int) (*SessionKey, error) {
	if err := ValidateAmount(maxPerTx); err != nil {
		return nil, fmt.Errorf("maxPerTxUSD: %w", err)
	}
	if err := ValidateAmount(dailyLimit); err != nil {
		return nil, fmt.Errorf("dailyLimitUSD: %w", err)
	}
	if maxPerTx > dailyLimit {
		return nil, errors.New("maxPerTxUSD must not exceed dailyLimitUSD")
	}
	if ttlHours < 0 || ttlHours > MaxSessionTTLHours {
		return nil, fmt.Errorf("ttlHours must be between 1 and %d", MaxSessionTTLHours)
	}
	if strings.TrimSpace(agentID) == "" {
		return nil, errors.New("agentId is required")
	}

	s.mu.RLock()
	_, ok := s.cards[cardID]
	authorized := ok && (asOperator || s.checkCardToken(cardID, cardToken))
	s.mu.RUnlock()
	if !ok || !authorized {
		return nil, ErrCardNotFound
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
