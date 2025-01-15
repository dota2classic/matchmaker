import { GameBalance } from "./game-balance";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { Party } from "@/matchmaker/entity/party";

export interface BalanceConfig {
  mode: MatchmakingMode;
  priority: number;
  findGames: (entries: Party[]) => Promise<GameBalance | undefined>;
}
