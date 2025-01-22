import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { PartyUpdatedEvent } from "@/gateway/events/party/party-updated.event";
import { PartyInvite } from "@/matchmaker/entity/party-invite";

@Entity("party")
export class Party {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id: string;

  @OneToMany(() => PlayerInParty, (t) => t.party, {
    eager: true,
    onDelete: "CASCADE",
  })
  players: Relation<PlayerInParty>[];

  @OneToMany(() => PartyInvite, (t) => t.party, {
    eager: false,
    onDelete: "CASCADE",
  })
  invites: Relation<PartyInvite>[];

  @Column({ default: 0, type: "float" })
  score: number = 0;

  @Column({
    name: "enter_queue_time",
    nullable: true,
    default: null,
    type: "timestamptz",
  })
  enterQueueAt: Date | null;

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

  public snapshotEvent(): PartyUpdatedEvent {
    return new PartyUpdatedEvent(
      this.id,
      this.leader,
      this.players.map((plr) => plr.steamId),
      this.queueModes,
      this.inQueue,
      this.enterQueueAt ? this.enterQueueAt.toISOString() : undefined,
    );
  }

  get queueTime(): number {
    return this.enterQueueAt ? Date.now() - this.enterQueueAt.getTime() : -1;
  }
}
