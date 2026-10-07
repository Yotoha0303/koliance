import { describe, it, expect } from "vitest";
import { getMetadataArgsStorage } from "typeorm";
import "@/entities"; // Load all entities and decorators

describe("TypeORM Entity Models & Composite Indexes", () => {
  it("should register all 5 core entities with TypeORM metadata storage", () => {
    const storage = getMetadataArgsStorage();
    const tableNames = storage.tables.map((t) => t.name);

    expect(tableNames).toContain("cards");
    expect(tableNames).toContain("card_transactions");
    expect(tableNames).toContain("session_keys");
    expect(tableNames).toContain("game_proofs");
    expect(tableNames).toContain("google_accounts");
  });

  it("should have correct SQL composite indexes configured on entities", () => {
    const storage = getMetadataArgsStorage();
    const indices = storage.indices;

    // 1. idx_cards_wallet_status on cards (wallet_address, status)
    const cardStatusIndex = indices.find((idx) => idx.name === "idx_cards_wallet_status");
    expect(cardStatusIndex).toBeDefined();
    expect(cardStatusIndex?.columns).toEqual(["walletAddress", "status"]);

    // 2. idx_card_transactions_card_created (card_id, created_at DESC)
    const txCreatedIndex = indices.find((idx) => idx.name === "idx_card_transactions_card_created");
    expect(txCreatedIndex).toBeDefined();
    expect(txCreatedIndex?.columns).toEqual(["cardId", "createdAt"]);

    // 3. idx_card_transactions_card_status (card_id, status)
    const txStatusIndex = indices.find((idx) => idx.name === "idx_card_transactions_card_status");
    expect(txStatusIndex).toBeDefined();
    expect(txStatusIndex?.columns).toEqual(["cardId", "status"]);

    // 4. idx_session_keys_card_frozen_expires (card_id, is_frozen, expires_at)
    const sessionIndex = indices.find((idx) => idx.name === "idx_session_keys_card_frozen_expires");
    expect(sessionIndex).toBeDefined();
    expect(sessionIndex?.columns).toEqual(["cardId", "isFrozen", "expiresAt"]);

    // 5. idx_game_proofs_steam_app (steam_id, app_id)
    const gameProofIndex = indices.find((idx) => idx.name === "idx_game_proofs_steam_app");
    expect(gameProofIndex).toBeDefined();
    expect(gameProofIndex?.columns).toEqual(["steamId", "appId"]);

    // 6. idx_google_accounts_email_wallet (email, wallet_address)
    const googleIndex = indices.find((idx) => idx.name === "idx_google_accounts_email_wallet");
    expect(googleIndex).toBeDefined();
    expect(googleIndex?.columns).toEqual(["email", "walletAddress"]);
  });
});
