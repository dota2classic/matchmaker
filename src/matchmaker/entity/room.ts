import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";

@Entity()
export class Room {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id: string;

  @Column({ name: "lobby_type" })
  lobbyType: MatchmakingMode;

  @OneToMany(() => PlayerInRoom, (p) => p.room, {
    eager: true,
    onDelete: "CASCADE",
  })
  players: Relation<PlayerInRoom>[];

  constructor(lobbyType: MatchmakingMode) {
    this.lobbyType = lobbyType;
  }
}
