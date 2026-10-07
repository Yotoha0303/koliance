import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from "typeorm";
import { CardTransaction } from "./CardTransaction";
import { SessionKey } from "./SessionKey";

@Entity("cards")
@Index("idx_cards_wallet_status", ["walletAddress", "status"])
export class Card {
  @PrimaryColumn({ type: "varchar", length: 64, name: "card_id" })
  cardId!: string;

  @Column({ type: "varchar", length: 42, name: "wallet_address" })
  @Index("idx_cards_wallet_address")
  walletAddress!: string;

  @Column({ type: "varchar", length: 32, default: "ACTIVE" })
  status!: string;

  @Column({ type: "varchar", length: 4, name: "last4" })
  last4!: string;

  @Column({ type: "varchar", length: 7, name: "expiry" })
  expiry!: string;

  @Column({ type: "varchar", length: 255, name: "encrypted_pan" })
  encryptedPan!: string;

  @Column({ type: "varchar", length: 255, name: "encrypted_cvv" })
  encryptedCvv!: string;

  @Column({ type: "numeric", precision: 18, scale: 6, name: "daily_limit_usd", default: 1000 })
  dailyLimitUsd!: string;

  @Column({ type: "numeric", precision: 18, scale: 6, name: "per_tx_limit_usd", default: 500 })
  perTxLimitUsd!: string;

  @Column({ type: "numeric", precision: 18, scale: 6, name: "spent_today_usd", default: 0 })
  spentTodayUsd!: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;

  @OneToMany(() => CardTransaction, (tx) => tx.card)
  transactions?: CardTransaction[];

  @OneToMany(() => SessionKey, (sk) => sk.card)
  sessionKeys?: SessionKey[];
}
