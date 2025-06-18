import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { ReadyState } from "@/gateway/events/ready-state-received.event";
import { ApiProperty } from "@nestjs/swagger";

export class ReadyCheckEntry {
  public readonly steamId: string;
  public readonly readyState: ReadyState;
}

export class GetUserRoomQueryResultRoomInfo {
  public readonly steamId: string;
  public readonly roomId: string;
  @ApiProperty({ enum: MatchmakingMode, enumName: "MatchmakingMode" })
  public readonly mode: MatchmakingMode;
  public readonly iAccepted: boolean;
  public readonly entries: ReadyCheckEntry[];
}

export class GetPartyQueryResultDto {
  public readonly partyId: string;
  public readonly leaderId: string;
  public readonly players: string[];
  @ApiProperty({ enum: MatchmakingMode, enumName: "MatchmakingMode" })
  public readonly modes: MatchmakingMode[];
  public readonly inQueue: boolean;
  public readonly enterQueueTime?: string;
}
