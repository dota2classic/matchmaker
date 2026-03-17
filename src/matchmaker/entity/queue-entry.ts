import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { BalanceFunctionType } from "@/matchmaker/balance/balance-function-type";

export enum QueueResultType {
  MATCHED = "MATCHED",
  LEFT_QUEUE = "LEFT_QUEUE",
  MATCHED_OTHER_MODE = "MATCHED_OTHER_MODE",
}

export enum ReadyCheckResultType {
  ALL_READY = "ALL_READY",
  DECLINE = "DECLINE",
  TIMEOUT = "TIMEOUT",
}

/**
 * One row per party per mode per queue session.
 * This allows training a separate model per mode to estimate search time.
 */
@Entity("queue_entry")
export class QueueEntry {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // === Operational (not ML features, needed for system updates) ===

  @Index()
  @Column({ name: "party_id", type: "varchar" })
  partyId: string;

  @Index()
  @Column({ name: "room_id", type: "varchar", nullable: true, default: null })
  roomId: string | null;

  // === The mode this entry is for ===

  @Column({ name: "queue_mode", type: "int" })
  mode: MatchmakingMode;

  // === Party composition at entry time (ML input features) ===

  @Column({ name: "party_size", type: "int" })
  partySize: number;

  @Column({ name: "party_score", type: "float" })
  partyScore: number;

  @Column({ name: "avg_player_score", type: "float" })
  avgPlayerScore: number;

  @Column({ name: "score_std_dev", type: "float" })
  scoreStdDev: number;

  @Column({ name: "dodge_list_size", type: "int" })
  dodgeListSize: number;

  // === Queue context at entry time (ML input features) ===

  @Column({ name: "entered_at", type: "timestamptz" })
  enteredAt: Date;

  @Column({ name: "utc_hour", type: "int" })
  utcHour: number;

  @Column({ name: "day_of_week", type: "int" })
  dayOfWeek: number;

  // === Queue state snapshot at entry time (ML input features) ===

  @Column({ name: "snapshot_player_count", type: "int" })
  snapshotPlayerCount: number;

  @Column({ name: "snapshot_party_count", type: "int" })
  snapshotPartyCount: number;

  @Column({ name: "snapshot_avg_wait_time_seconds", type: "float" })
  snapshotAvgWaitTimeSeconds: number;

  // === Matchmaking settings snapshot at entry time (ML input features) ===

  @Column({ name: "snapshot_max_team_score_difference", type: "float" })
  snapshotMaxTeamScoreDifference: number;

  @Column({ name: "snapshot_max_player_score_difference", type: "float" })
  snapshotMaxPlayerScoreDifference: number;

  @Column({
    name: "snapshot_balance_function_type",
    type: "enum",
    enum: BalanceFunctionType,
    enumName: "balance_function_type",
  })
  snapshotBalanceFunctionType: BalanceFunctionType;

  // === Outcome labels (null until resolved) ===

  @Column({
    name: "result_type",
    type: "enum",
    enum: QueueResultType,
    enumName: "queue_result_type",
    nullable: true,
    default: null,
  })
  resultType: QueueResultType | null;

  @Column({
    name: "wait_time_seconds",
    type: "int",
    nullable: true,
    default: null,
  })
  waitTimeSeconds: number | null;

  // Ready check outcome (only populated when resultType = MATCHED)
  @Column({
    name: "ready_check_result",
    type: "enum",
    enum: ReadyCheckResultType,
    enumName: "ready_check_result_type",
    nullable: true,
    default: null,
  })
  readyCheckResult: ReadyCheckResultType | null;

  @Column({
    name: "ready_check_duration_seconds",
    type: "int",
    nullable: true,
    default: null,
  })
  readyCheckDurationSeconds: number | null;
}
