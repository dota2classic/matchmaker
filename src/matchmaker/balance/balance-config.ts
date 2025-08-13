import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { Party } from "@/matchmaker/entity/party";
import { QueueSettings } from "@/matchmaker/entity/queue-settings";
import { BalancePair } from "@/matchmaker/balance/perms";

export interface BalanceConfig {
  mode: MatchmakingMode;
  priority: number;
  findGames: (
    entries: Party[],
    settings: QueueSettings,
  ) => Promise<BalancePair | undefined>;
}
