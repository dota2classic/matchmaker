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
    appliedBalance: GameBalance = balance,
  ): void {
    if (
      this.config.get<boolean>("mirrorShadow.enabled") === false ||
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
      const input = this.snapshot(balance, settings);
      input.appliedAssignment = {
        leftPartyIds: appliedBalance.left.map((p) => p.id),
        rightPartyIds: appliedBalance.right.map((p) => p.id),
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

  selectLive(balance: GameBalance, settings: QueueSettings): GameBalance {
    if (
      balance.mode !== MatchmakingMode.UNRANKED ||
      this.config.get<boolean>("mirrorLive.enabled") === false
    )
      return balance;
    try {
      const result = compareMirror(this.snapshot(balance, settings));
      const variant = result.variants?.find((v) => v.budget === 500);
      if (!variant || !variant.changed) return balance;
      const parties = new Map(
        [...balance.left, ...balance.right].map((p) => [p.id, p]),
      );
      return new GameBalance(
        balance.mode,
        variant.leftPartyIds.map((id) => parties.get(id)!),
        variant.rightPartyIds.map((id) => parties.get(id)!),
      );
    } catch (error) {
      this.logger.warn("Live mirror failed; using original assignment", {
        error: String(error),
      });
      return balance;
    }
  }

  private snapshot(balance: GameBalance, settings: QueueSettings): MirrorInput {
    return {
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
