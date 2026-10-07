import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("game_proofs")
@Index("idx_game_proofs_steam_app", ["steamId", "appId"])
export class GameProof {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 32, name: "steam_id" })
  steamId!: string;

  @Column({ type: "integer", name: "app_id" })
  appId!: number;

  @Column({ type: "integer", name: "playtime_forever" })
  playtimeForever!: number;

  @Column({ type: "integer", name: "achievements_count" })
  achievementsCount!: number;

  @Column({ type: "varchar", length: 128, name: "proof_hash" })
  proofHash!: string;

  @Column({ type: "varchar", length: 42, nullable: true, name: "wallet_address" })
  walletAddress?: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
