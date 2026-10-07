import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("google_accounts")
@Index("idx_google_accounts_email_wallet", ["email", "walletAddress"])
export class GoogleAccount {
  @PrimaryColumn({ type: "varchar", length: 128, name: "google_id" })
  googleId!: string;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "boolean", default: false, name: "email_verified" })
  emailVerified!: boolean;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 512, nullable: true })
  picture?: string | null;

  @Column({ type: "varchar", length: 42, nullable: true, name: "wallet_address" })
  walletAddress?: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
