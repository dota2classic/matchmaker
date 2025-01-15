import { Party } from "@/matchmaker/entity/party";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";

export class GameBalance {
  constructor(
    public readonly mode: MatchmakingMode,
    public readonly left: Party[],
    public readonly right: Party[],
  ) {}
}
