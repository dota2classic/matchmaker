import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Party } from "@/matchmaker/entity/party";
import { PartyInviteCreatedEvent } from "@/gateway/events/party/party-invite-created.event";

@Entity()
@Index("player_pair_invite", ["inviter", "invited", "partyId"], {
  unique: true,
})
export class PartyInvite {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Party, (t) => t.invites, { eager: true })
  @JoinColumn({
    referencedColumnName: "id",
    name: "party_id",
  })
  party: Party;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @Column({ name: "party_id" })
  partyId: string;

  @Column({ name: "inviter" })
  inviter: string;

  @Column({ name: "invited" })
  invited: string;

  constructor(partyId: string, inviter: string, invited: string) {
    this.partyId = partyId;
    this.inviter = inviter;
    this.invited = invited;
  }

  public toEvent(): PartyInviteCreatedEvent {
    return new PartyInviteCreatedEvent(
      this.id,
      this.partyId,
      this.inviter,
      this.invited,
    );
  }
}
