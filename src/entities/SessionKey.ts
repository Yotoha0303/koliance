import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Card } from "./Card";

@Entity("session_keys")
@Index("idx_session_keys_card_frozen_expires", ["cardId", "isFrozen", "expiresAt"])
export class SessionKey {
  @PrimaryColumn({ type: "varchar", length: 42, name: "session_key_address" })
  sessionKeyAddress!: string;

  @Column({ type: "varchar", length: 64, name: "card_id" })
  cardId!: string;

  @Column({ type: "numeric", precision: 18, scale: 6, name: "single_tx_limit_usd" })
  singleTxLimitUsd!: string;

  @Column({ type: "numeric", precision: 18, scale: 6, name: "daily_limit_usd" })
  dailyLimitUsd!: string;

  @Column({ type: "numeric", precision: 18, scale: 6, name: "spent_today_usd", default: 0 })
  spentTodayUsd!: string;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;

  @Column({ type: "boolean", default: false, name: "is_frozen" })
  isFrozen!: boolean;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @ManyToOne(() => Card, (card) => card.sessionKeys, { onDelete: "CASCADE" })
  @JoinColumn({ name: "card_id" })
  card?: Card;
}
