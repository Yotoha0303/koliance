-- Koliance Database Schema & Composite Indexes Migration
-- Target: PostgreSQL / Supabase

-- 1. Cards Table
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

-- 2. Card Transactions Table
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

-- 3. Session Keys Table
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

-- 4. Game Proofs Table
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

-- 5. Market Orders Table
CREATE TABLE IF NOT EXISTS market_orders (
    order_id VARCHAR(128) PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL,
    side VARCHAR(16) NOT NULL,
    notional_usd NUMERIC(12, 2) NOT NULL,
    leverage NUMERIC(6, 2) NOT NULL DEFAULT 1.00,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Google Accounts Table
CREATE TABLE IF NOT EXISTS google_accounts (
    google_id VARCHAR(128) PRIMARY KEY,
    email VARCHAR(256) NOT NULL,
    name VARCHAR(128) NOT NULL,
    picture VARCHAR(512),
    wallet_address VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Koliance User Accounts
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(128) PRIMARY KEY,
    email VARCHAR(256) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    picture VARCHAR(512),
    bio TEXT,
    wallet_address VARCHAR(128),
    trust_tier VARCHAR(64) NOT NULL DEFAULT 'GOOGLE VERIFIED CITIZEN',
    credit_allowance_usd NUMERIC(12, 2) NOT NULL DEFAULT 600.00,
    steam_id VARCHAR(64),
    github_username VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== COMPOSITE INDEXES ====================
-- 0. User composite indexes
CREATE INDEX IF NOT EXISTS idx_users_email_wallet ON users(email, wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
-- 1. Cards lookup by wallet and status
CREATE INDEX IF NOT EXISTS idx_cards_wallet_status ON cards(wallet_address, status);

-- 2. Card transactions sorted by card and timestamp (timeline pagination)
CREATE INDEX IF NOT EXISTS idx_card_transactions_card_created ON card_transactions(card_id, created_at DESC);

-- 3. Card transactions grouped by card and approval status
CREATE INDEX IF NOT EXISTS idx_card_transactions_card_status ON card_transactions(card_id, status);

-- 4. Session key guard lookup by card, freeze state and expiry
CREATE INDEX IF NOT EXISTS idx_session_keys_card_frozen_expires ON session_keys(card_id, is_frozen, expires_at);

-- 5. Game proofs deduplication and verification by steam_id and app_id
CREATE INDEX IF NOT EXISTS idx_game_proofs_steam_app ON game_proofs(steam_id, app_id);

-- 6. Google accounts index by email and wallet
CREATE INDEX IF NOT EXISTS idx_google_accounts_email_wallet ON google_accounts(email, wallet_address);
