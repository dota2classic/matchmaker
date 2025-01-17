import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  Relation,
} from "typeorm";
import { Room } from "@/matchmaker/entity/room";
import { Party } from "@/matchmaker/entity/party";
import { ReadyState } from "@/gateway/events/ready-state-received.event";

@Entity()
@Index("max_one_room_for_player", ["steamId"], { unique: true })
export class PlayerInRoom {
  @ManyToOne(() => Room, (t) => t.players, { onDelete: "CASCADE" })
  @JoinColumn({
    referencedColumnName: "id",
    name: "room_id",
  })
  room: Relation<Room>;

  @PrimaryColumn({ type: "uuid", name: "room_id" })
  roomId: string;

  @OneToOne(() => Party)
  @JoinColumn({
    referencedColumnName: "id",
    name: "party_id",
  })
  party: Relation<Party>;

  @PrimaryColumn({ type: "uuid", name: "party_id" })
  partyId: string;

  @PrimaryColumn({ name: "steam_id" })
  steamId: string;

  @Column({
    type: "enum",
    enum: ReadyState,
    array: false,
    default: ReadyState.PENDING,
    name: "ready_state",
  })
  readyState: ReadyState;

  constructor(roomId: string, partyId: string, steamId: string) {
    this.roomId = roomId;
    this.partyId = partyId;
    this.steamId = steamId;
  }
}
