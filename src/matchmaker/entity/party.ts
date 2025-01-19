import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";

@Entity("party")
export class Party {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id: string;

  @OneToMany(() => PlayerInParty, (t) => t.party, {
    eager: true,
    onDelete: "CASCADE",
  })
  players: Relation<PlayerInParty>[];

  @Column({ default: 0 })
  score: number = 0;

  @Column({ name: "waiting_score", default: 0 })
  waitingScore: number = 0;

  @Column({
    type: "enum",
    enum: MatchmakingMode,
    array: true,
    default: [],
    name: "queue_modes",
  })
  queueModes: MatchmakingMode[];

  @Column({ name: "in_queue", default: false })
  inQueue: boolean;

  get size(): number {
    return this.players.length;
  }

  get leader(): string {
    return this.players.find((t) => t.isLeader)!.steamId;
  }
}
