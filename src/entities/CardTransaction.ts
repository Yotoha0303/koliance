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

@Entity("card_transactions")
@Index("idx_card_transactions_card_created", ["cardId", "createdAt"])
@Index("idx_card_transactions_card_status", ["cardId", "status"])
export class CardTransaction {
  @PrimaryColumn({ type: "varchar", length: 64, name: "tx_id" })
  txId!: string;

  @Column({ type: "varchar", length: 64, name: "card_id" })
  cardId!: string;

  @Column({ type: "varchar", length: 255, name: "merchant_name" })
  merchantName!: string;

  @Column({ type: "varchar", length: 4, name: "merchant_mcc" })
  merchantMcc!: string;

  @Column({ type: "numeric", precision: 18, scale: 6, name: "amount_usd" })
  amountUsd!: string;

  @Column({ type: "numeric", precision: 18, scale: 6, name: "amount_mon" })
  amountMon!: string;

  @Column({ type: "varchar", length: 32, default: "SETTLED" })
  status!: string;

  @Column({ type: "varchar", length: 66, nullable: true, name: "onchain_tx_hash" })
  onchainTxHash?: string | null;

  @Column({ type: "text", nullable: true, name: "decline_reason" })
  declineReason?: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @ManyToOne(() => Card, (card) => card.transactions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "card_id" })
  card?: Card;
}
