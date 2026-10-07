import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("users")
@Index("idx_users_email", ["email"])
@Index("idx_users_wallet_address", ["walletAddress"])
@Index("idx_users_email_wallet", ["email", "walletAddress"])
export class User {
  @PrimaryColumn({ type: "varchar", length: 128, name: "id" })
  id!: string; // Koliance User DID or Google sub: did:koliance:{sub}

  @Column({ type: "varchar", length: 255, unique: true })
  email!: string;

  @Column({ type: "varchar", length: 128 })
  name!: string;

  @Column({ type: "varchar", length: 512, nullable: true })
  picture?: string | null;

  @Column({ type: "text", nullable: true })
  bio?: string | null;

  @Column({ type: "varchar", length: 42, nullable: true, name: "wallet_address" })
  walletAddress?: string | null;

  @Column({ type: "varchar", length: 64, default: "GOOGLE VERIFIED CITIZEN", name: "trust_tier" })
  trustTier!: string;

  @Column({ type: "numeric", precision: 18, scale: 2, default: 600, name: "credit_allowance_usd" })
  creditAllowanceUSD!: number;

  @Column({ type: "varchar", length: 64, nullable: true, name: "steam_id" })
  steamId?: string | null;

  @Column({ type: "varchar", length: 128, nullable: true, name: "github_username" })
  githubUsername?: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
