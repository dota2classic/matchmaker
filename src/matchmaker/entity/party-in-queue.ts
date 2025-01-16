import { Entity, JoinColumn, OneToOne, PrimaryColumn, Relation } from "typeorm";
import { Party } from "@/matchmaker/entity/party";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";

@Entity()
export class PartyInQueue {
  @OneToOne(() => Party)
  @JoinColumn({
    referencedColumnName: "id",
    name: "party_id",
  })
  party: Relation<Party>;

  @PrimaryColumn({ type: "uuid", name: "party_id" })
  partyId: string;



  queueModes: MatchmakingMode[]
}
