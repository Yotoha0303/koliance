package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

const schemaSQL = `
CREATE TABLE IF NOT EXISTS cards (
    card_id VARCHAR(64) PRIMARY KEY,
    card_number VARCHAR(32) NOT NULL,
    formatted_number VARCHAR(32) NOT NULL,
    expiry VARCHAR(10) NOT NULL,
    cvv VARCHAR(8) NOT NULL,
    cardholder_name VARCHAR(128) NOT NULL,
    wallet_address VARCHAR(128) NOT NULL,
    balance_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_transactions (
    tx_id VARCHAR(64) PRIMARY KEY,
    card_id VARCHAR(64) REFERENCES cards(card_id) ON DELETE CASCADE,
    amount_usd NUMERIC(12, 2) NOT NULL,
    merchant_name VARCHAR(128) NOT NULL,
    mcc VARCHAR(16) NOT NULL,
    auth_code VARCHAR(32) NOT NULL,
    response_code VARCHAR(8) NOT NULL,
    session_key VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'APPROVED',
    monad_batch_hash VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_keys (
    key_hex VARCHAR(128) PRIMARY KEY,
    card_id VARCHAR(64) REFERENCES cards(card_id) ON DELETE CASCADE,
    agent_id VARCHAR(64) NOT NULL,
    max_per_tx_usd NUMERIC(12, 2) NOT NULL,
    daily_limit_usd NUMERIC(12, 2) NOT NULL,
    spent_today_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    allowed_mccs TEXT[] NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_proofs (
    proof_hash VARCHAR(128) PRIMARY KEY,
    steam_id VARCHAR(64) NOT NULL,
    target_wallet VARCHAR(128) NOT NULL,
    app_id INTEGER NOT NULL,
    game_name VARCHAR(128) NOT NULL,
    playtime_hours NUMERIC(10, 2) NOT NULL,
    achievements INTEGER NOT NULL,
    trust_score_tier VARCHAR(32) NOT NULL,
    credit_unlock_usd NUMERIC(12, 2) NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_orders (
    order_id VARCHAR(128) PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL,
    side VARCHAR(16) NOT NULL,
    notional_usd NUMERIC(12, 2) NOT NULL,
    leverage NUMERIC(6, 2) NOT NULL DEFAULT 1.00,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("../.env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	fmt.Println("⏳ Connecting to Supabase PostgreSQL...")
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("❌ Failed to parse/connect to Supabase: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("❌ Supabase ping failed: %v", err)
	}
	fmt.Println("✅ Successfully connected to Supabase PostgreSQL!")

	fmt.Println("⏳ Initializing database schema...")
	if _, err := pool.Exec(ctx, schemaSQL); err != nil {
		log.Fatalf("❌ Schema initialization failed: %v", err)
	}

	fmt.Println("🎉 Database tables successfully created/verified in Supabase:")
	fmt.Println("   ├─ cards")
	fmt.Println("   ├─ card_transactions")
	fmt.Println("   ├─ session_keys")
	fmt.Println("   ├─ game_proofs")
	fmt.Println("   └─ market_orders")
}
