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
  @PrimaryColumn({ name: "steam_id" })
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

  @Column({ type: "float" })
  score: number;

  constructor(
    steamId: string,
    partyId: string,
    score: number,
    isLeader: boolean,
  ) {
    this.steamId = steamId;
    this.partyId = partyId;
    this.score = score;
    this.isLeader = isLeader;
  }
}
