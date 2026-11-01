import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { performance } from "perf_hooks";
import { GameBalance } from "@/matchmaker/balance/game-balance";
import { compareMirror, MirrorInput } from "@/matchmaker/balance/mirror-shadow";
import { MirrorShadowEvaluation } from "@/matchmaker/entity/mirror-shadow-evaluation";
import { QueueSettings } from "@/matchmaker/entity/queue-settings";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";

@Injectable()
export class MirrorShadowService {
  private readonly logger = new Logger(MirrorShadowService.name);
  private pending = 0;
  private readonly maxPending = 8;
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(MirrorShadowEvaluation)
    private readonly repository: Repository<MirrorShadowEvaluation>,
  ) {}

  /** Bounded best effort. It never returns teams and must not be awaited by the live queue. */
  schedule(
    roomId: string,
    balance: GameBalance,
    settings: QueueSettings,
  ): void {
    if (
      this.config.get<boolean>("mirrorShadow.enabled") !== true ||
      balance.mode !== MatchmakingMode.UNRANKED
    )
      return;
    if (this.pending >= this.maxPending) {
      this.logger.warn("Mirror shadow skipped: backlog full", {
        room_id: roomId,
      });
      return;
    }
    try {
      const input: MirrorInput = {
        version: "mirror-shadow-v1",
        scope: "selected-ten",
        capturedAt: new Date().toISOString(),
        leftPartyIds: balance.left.map((p) => p.id),
        rightPartyIds: balance.right.map((p) => p.id),
        maxTeamScoreDifference: settings.maxTeamScoreDifference,
        maxPlayerScoreDifference: settings.maxPlayerScoreDifference,
        balanceFunction: settings.balanceFunctionType,
        parties: [...balance.left, ...balance.right].map((party) => ({
          id: party.id,
          score: party.score,
          enteredAt: party.enterQueueAt
            ? new Date(party.enterQueueAt).toISOString()
            : null,
          dodgeList: [...party.dodgeList],
          players: party.players.map((p) => ({
            id: p.steamId,
            score: p.score,
            mmr: p.seasonMmr ?? null,
            pvpGames: p.pvpGames ?? null,
            statsAt: p.balanceStatsAt
              ? new Date(p.balanceStatsAt).toISOString()
              : null,
          })),
        })),
      };
      this.pending++;
      setImmediate(() => {
        // Serialize writes so shadow cannot occupy the live connection pool.
        this.tail = this.tail
          .then(() => this.record(roomId, input))
          .finally(() => {
            this.pending--;
          });
      });
    } catch (error) {
      this.logger.warn("Mirror shadow snapshot failed", {
        room_id: roomId,
        error: String(error),
      });
    }
  }

  private async record(roomId: string, input: MirrorInput): Promise<void> {
    try {
      const started = performance.now();
      const result = compareMirror(input);
      const computeMillis = performance.now() - started;
      result.computeMillis = computeMillis;
      await this.repository.save(
        this.repository.create({ roomId, input, result }),
      );
      this.logger.log("Mirror shadow recorded", {
        room_id: roomId,
        version: input.version,
        status: result.status,
        compute_millis: computeMillis,
        variants: result.variants?.map((v) => ({
          budget: v.budget,
          changed: v.changed,
          ...v.metrics,
          rankDistanceByPlayer: undefined,
          worsenedPlayers: v.worsenedPlayers,
        })),
      });
    } catch (error) {
      this.logger.warn("Mirror shadow comparison or persistence failed", {
        room_id: roomId,
        error: String(error),
      });
    }
  }
}
