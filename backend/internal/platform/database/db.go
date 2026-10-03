package database

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool        *pgxpool.Pool
	IsConnected bool
	MemoryStore *MemoryStore
}

// MemoryStore provides instant in-memory persistence when Supabase credentials are not yet configured
type MemoryStore struct {
	mu           sync.RWMutex
	Cards        map[string]map[string]interface{}
	Transactions []map[string]interface{}
	Proofs       []map[string]interface{}
}

func New(databaseURL string) *DB {
	mem := &MemoryStore{
		Cards:        make(map[string]map[string]interface{}),
		Transactions: make([]map[string]interface{}, 0),
		Proofs:       make([]map[string]interface{}, 0),
	}

	if databaseURL == "" {
		log.Println("[Database] DATABASE_URL not set; running with high-speed in-memory store.")
		return &DB{
			Pool:        nil,
			IsConnected: false,
			MemoryStore: mem,
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		log.Printf("[Database] Failed to parse DATABASE_URL: %v. Falling back to memory store.", err)
		return &DB{Pool: nil, IsConnected: false, MemoryStore: mem}
	}

	config.MaxConns = 25
	config.MinConns = 5
	config.MaxConnLifetime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		log.Printf("[Database] Failed to connect to Supabase: %v. Falling back to memory store.", err)
		return &DB{Pool: nil, IsConnected: false, MemoryStore: mem}
	}

	if err := pool.Ping(ctx); err != nil {
		log.Printf("[Database] Supabase ping failed: %v. Falling back to memory store.", err)
		return &DB{Pool: nil, IsConnected: false, MemoryStore: mem}
	}

	log.Println("[Database] Successfully connected to Supabase PostgreSQL pool!")
	return &DB{
		Pool:        pool,
		IsConnected: true,
		MemoryStore: mem,
	}
}

func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}

func (m *MemoryStore) SaveCard(cardID string, data map[string]interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Cards[cardID] = data
}

func (m *MemoryStore) GetCard(cardID string) (map[string]interface{}, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	c, ok := m.Cards[cardID]
	return c, ok
}

func (m *MemoryStore) AppendTransaction(tx map[string]interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Transactions = append(m.Transactions, tx)
}

func (m *MemoryStore) AppendProof(proof map[string]interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Proofs = append(m.Proofs, proof)
}
