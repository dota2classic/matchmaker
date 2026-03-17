import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Not, Repository } from "typeorm";
import {
  QueueEntry,
  QueueResultType,
  ReadyCheckResultType,
} from "@/matchmaker/entity/queue-entry";
import { BalanceFunctionType } from "@/matchmaker/balance/balance-function-type";
import { Party } from "@/matchmaker/entity/party";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { QueueSettings } from "@/matchmaker/entity/queue-settings";
import { GameBalance } from "@/matchmaker/balance/game-balance";
import { ReadyState } from "@/gateway/events/ready-state-received.event";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";

@Injectable()
export class QueueStatisticsService {
  private readonly logger = new Logger(QueueStatisticsService.name);

  constructor(
    @InjectRepository(QueueEntry)
    private readonly queueEntryRepository: Repository<QueueEntry>,
    @InjectRepository(Party)
    private readonly partyRepository: Repository<Party>,
    @InjectRepository(QueueSettings)
    private readonly queueSettingsRepository: Repository<QueueSettings>,
  ) {}

  /**
   * Creates one QueueEntry per mode the party is queuing for.
   * Called before the party is saved to the queue, so the snapshot
   * reflects the pool state before this party enters.
   */
  async recordQueueEntry(
    party: Party,
    modes: MatchmakingMode[],
  ): Promise<void> {
    try {
      const now = new Date();
      const playerScores = party.players.map((p) => p.score);
      const avgPlayerScore =
        playerScores.length > 0
          ? playerScores.reduce((a, b) => a + b, 0) / playerScores.length
          : 0;
      const scoreStdDev = this.computeStdDev(playerScores, avgPlayerScore);

      const [queueSnapshots, settingsSnapshots] = await Promise.all([
        this.computeQueueSnapshots(modes),
        this.computeSettingsSnapshots(modes),
      ]);

      const entries = modes.flatMap((mode) => {
        const qs = queueSnapshots.get(mode);
        const ss = settingsSnapshots.get(mode);
        if (!qs || !ss) {
          this.logger.warn(`Missing snapshot data for mode ${mode}, skipping`);
          return [];
        }
        return [
          this.queueEntryRepository.create({
            partyId: party.id,
            mode,
            partySize: party.size,
            partyScore: party.score,
            avgPlayerScore,
            scoreStdDev,
            dodgeListSize: party.dodgeList.length,
            enteredAt: now,
            utcHour: now.getUTCHours(),
            dayOfWeek: now.getUTCDay(),
            snapshotPlayerCount: qs.playerCount,
            snapshotPartyCount: qs.partyCount,
            snapshotAvgWaitTimeSeconds: qs.avgWaitTimeSeconds,
            snapshotMaxTeamScoreDifference: ss.maxTeamScoreDifference,
            snapshotMaxPlayerScoreDifference: ss.maxPlayerScoreDifference,
            snapshotBalanceFunctionType: ss.balanceFunctionType,
          }),
        ];
      });

      await this.queueEntryRepository.save(entries);
    } catch (e) {
      this.logger.error("Failed to record queue entry", e);
    }
  }

  /**
   * Marks the matched mode entry as MATCHED and all other unresolved
   * entries for the same parties as MATCHED_OTHER_MODE.
   */
  async recordMatchFound(balance: GameBalance, roomId: string): Promise<void> {
    try {
      const allParties = balance.left.concat(balance.right);

      for (const party of allParties) {
        const waitTimeSeconds = party.enterQueueAt
          ? Math.floor((Date.now() - party.enterQueueAt.getTime()) / 1000)
          : null;

        // Mark the specific mode that matched
        await this.queueEntryRepository.update(
          { partyId: party.id, mode: balance.mode, resultType: IsNull() },
          { resultType: QueueResultType.MATCHED, waitTimeSeconds, roomId },
        );

        // Mark other queued modes as resolved via a different mode
        await this.queueEntryRepository.update(
          {
            partyId: party.id,
            mode: Not(balance.mode),
            resultType: IsNull(),
          },
          {
            resultType: QueueResultType.MATCHED_OTHER_MODE,
            waitTimeSeconds,
          },
        );
      }
    } catch (e) {
      this.logger.error("Failed to record match found", e);
    }
  }

  /**
   * Marks all unresolved entries for the party as LEFT_QUEUE.
   */
  async recordQueueLeft(partyId: string): Promise<void> {
    try {
      const entries = await this.queueEntryRepository.find({
        where: { partyId, resultType: IsNull() },
      });
      if (entries.length === 0) return;

      const waitTimeSeconds = Math.floor(
        (Date.now() - entries[0].enteredAt.getTime()) / 1000,
      );

      await this.queueEntryRepository.update(
        { partyId, resultType: IsNull() },
        { resultType: QueueResultType.LEFT_QUEUE, waitTimeSeconds },
      );
    } catch (e) {
      this.logger.error("Failed to record queue left", e);
    }
  }

  /**
   * Appends ready check outcome to all entries for this room.
   */
  async recordReadyCheckResult(
    roomId: string,
    players: PlayerInRoom[],
    startedAt: Date,
  ): Promise<void> {
    try {
      const durationSeconds = Math.floor(
        (Date.now() - startedAt.getTime()) / 1000,
      );

      const hasDecline = players.some(
        (p) => p.readyState === ReadyState.DECLINE,
      );
      const hasTimeout = players.some(
        (p) => p.readyState === ReadyState.TIMEOUT,
      );

      let result: ReadyCheckResultType;
      if (!hasDecline && !hasTimeout) {
        result = ReadyCheckResultType.ALL_READY;
      } else if (hasDecline) {
        result = ReadyCheckResultType.DECLINE;
      } else {
        result = ReadyCheckResultType.TIMEOUT;
      }

      await this.queueEntryRepository.update(
        { roomId },
        {
          readyCheckResult: result,
          readyCheckDurationSeconds: durationSeconds,
        },
      );
    } catch (e) {
      this.logger.error("Failed to record ready check result", e);
    }
  }

  private computeStdDev(scores: number[], avg: number): number {
    if (scores.length <= 1) return 0;
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
    return Math.sqrt(variance);
  }

  private async computeQueueSnapshots(
    modes: MatchmakingMode[],
  ): Promise<
    Map<
      MatchmakingMode,
      { playerCount: number; partyCount: number; avgWaitTimeSeconds: number }
    >
  > {
    const allInQueue = await this.partyRepository
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.players", "players")
      .where("p.in_queue = true")
      .getMany();

    const result = new Map<
      MatchmakingMode,
      { playerCount: number; partyCount: number; avgWaitTimeSeconds: number }
    >();
    for (const mode of modes) {
      const modeEntries = allInQueue.filter((p) => p.queueModes.includes(mode));
      const playerCount = modeEntries.reduce((sum, p) => sum + p.size, 0);
      const partyCount = modeEntries.length;
      const waitTimes = modeEntries
        .filter((p) => p.enterQueueAt)
        .map((p) => (Date.now() - p.enterQueueAt!.getTime()) / 1000);
      const avgWaitTimeSeconds =
        waitTimes.length > 0
          ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
          : 0;
      result.set(mode, { playerCount, partyCount, avgWaitTimeSeconds });
    }
    return result;
  }

  private async computeSettingsSnapshots(modes: MatchmakingMode[]): Promise<
    Map<
      MatchmakingMode,
      {
        maxTeamScoreDifference: number;
        maxPlayerScoreDifference: number;
        balanceFunctionType: BalanceFunctionType;
      }
    >
  > {
    const settings = await this.queueSettingsRepository.findBy({
      mode: In(modes),
    });
    const result = new Map<
      MatchmakingMode,
      {
        maxTeamScoreDifference: number;
        maxPlayerScoreDifference: number;
        balanceFunctionType: BalanceFunctionType;
      }
    >();
    for (const s of settings) {
      result.set(s.mode, {
        maxTeamScoreDifference: s.maxTeamScoreDifference,
        maxPlayerScoreDifference: s.maxPlayerScoreDifference,
        balanceFunctionType: s.balanceFunctionType,
      });
    }
    return result;
  }
}
