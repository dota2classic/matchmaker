import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { Room } from "@/matchmaker/entity/room";

@Entity("party")
export class Party {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id: string;

  @OneToMany(() => PlayerInParty, (t) => t.party, {
    eager: true,
    cascade: true,
  })
  players: Relation<PlayerInParty>[];

  @Column({ default: 0 })
  score: number;

  @Column({ name: "waiting_score", default: 0 })
  waitingScore: number;

  @Column({
    type: "enum",
    enum: MatchmakingMode,
    array: true,
    default: [],
    name: "queue_modes",
  })
  queueModes: MatchmakingMode[];

  get size(): number {
    return this.players.length;
  }
}
