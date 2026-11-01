import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { Party } from "@/matchmaker/entity/party";

@Index("only_one_leader", ["partyId"], { unique: true, where: "leader" })
@Entity()
export class PlayerInParty {
  @PrimaryColumn({ name: "steam_id", unique: true })
  steamId: string;

  @ManyToOne(() => Party, (t) => t.players, { eager: false })
  @JoinColumn({
    referencedColumnName: "id",
    name: "party_id",
  })
  party: Party;

  @Column({ name: "party_id" })
  partyId: string;

  @Column({ name: "leader", default: false })
  isLeader: boolean;

  @Column({
    name: "score",
    default: 0,
    type: "float",
  })
  score: number;

  @Column({ name: "pvp_games", type: "int", nullable: true })
  pvpGames: number | null = null;

  @Column({ name: "season_mmr", type: "float", nullable: true })
  seasonMmr: number | null = null;

  @Column({ name: "balance_stats_at", type: "timestamptz", nullable: true })
  balanceStatsAt: Date | null = null;

  constructor(steamId: string, partyId: string, isLeader: boolean) {
    this.steamId = steamId;
    this.partyId = partyId;
    this.isLeader = isLeader;
  }
}
