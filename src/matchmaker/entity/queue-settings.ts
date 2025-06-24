import { Column, Entity, PrimaryColumn } from "typeorm";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";

@Entity("queue_settings")
export class QueueSettings {
  @PrimaryColumn({
    type: "enum",
    enum: MatchmakingMode,
    enumName: "party_queue_modes_enum",
  })
  mode: MatchmakingMode;

  @Column({
    name: "check_interval",
    default: 60,
  })
  checkInterval: number;

  @Column({
    name: "last_check_timestamp",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  lastCheckTimestamp: Date;

  @Column({
    name: "in_progress",
    default: false,
  })
  inProgress: boolean;

  @Column({
    name: "max_team_score_difference",
    default: 1000000,
  })
  maxTeamScoreDifference: number;

  @Column({
    name: "max_player_score_difference",
    default: 1000000,
  })
  maxPlayerScoreDifference: number;

  get shouldRunMatchmaking(): boolean {
    return (
      !this.inProgress &&
      this.lastCheckTimestamp.getTime() + this.checkInterval * 1000 < Date.now()
    );
  }
}
