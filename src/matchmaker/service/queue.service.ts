import { Injectable, Logger } from "@nestjs/common";
import { findBestMatchBy } from "../balance/perms";
import { GameBalance } from "../balance/game-balance";
import { BalanceConfig } from "../balance/balance-config";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { Party } from "@/matchmaker/entity/party";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EventBus } from "@nestjs/cqrs";
import { RoomService } from "@/matchmaker/service/room.service";
import { RoomCreatedEvent } from "@/matchmaker/event/room-created.event";
import { DbMatchmakingQueue } from "@/matchmaker/queue/db-matchmaking.queue";
import { createDateComparator } from "@/util/date-comparator";
import { totalScore } from "@/util/totalScore";

@Injectable()
export class QueueService {
  private logger = new Logger(QueueService.name);
  private isCycleInProgress = false;

  private modeBalancingMap: BalanceConfig[] = [
    {
      mode: MatchmakingMode.UNRANKED,
      priority: 0,
      findGames: (entries) =>
        this.findBalancedGame(
          MatchmakingMode.UNRANKED,
          entries,
          5,
          5000,
          6_000,
        ),
    },
    {
      mode: MatchmakingMode.SOLOMID,
      priority: 100,
      findGames: (entries) =>
        this.findSolomidGame(MatchmakingMode.SOLOMID, entries),
    },
    {
      mode: MatchmakingMode.BOTS,
      priority: 10000,
      findGames: (entries) => this.findBotsGame(MatchmakingMode.BOTS, entries),
    },
    {
      mode: MatchmakingMode.BOTS_2X2,
      priority: 10,
      findGames: (entries) =>
        this.findBalancedGame(MatchmakingMode.BOTS_2X2, entries, 2, 5000, 10e6),
    },
    {
      mode: MatchmakingMode.HIGHROOM,
      priority: 5,
      findGames: (entries) =>
        this.findBalancedGame(MatchmakingMode.HIGHROOM, entries, 5, 5000, 10e6),
    },
  ];

  constructor(
    private readonly queue: DbMatchmakingQueue,
    private readonly roomService: RoomService,
    private readonly ebus: EventBus,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  public async cycle() {
    if (this.isCycleInProgress) {
      this.logger.log("Another cycle is in progress, skipping...");
      return;
    }
    let balances: GameBalance[] = [];
    let error: Error | undefined;
    try {
      const start = Date.now();
      this.logger.log(`Cycle started at ${Date.now()}`);
      this.isCycleInProgress = true;
      const entries = await this.queue.entries();
      this.logger.log(`Acquire entries ${entries.length}`);
      balances = await this.iterateModes(entries);
      this.logger.log(`Found balances ${balances.length}`);
      await this.submitFoundGames(balances);
      const timeTaken = Date.now() - start;
      this.logger.log(`Full cycle took ${timeTaken} millis`);
    } catch (e) {
      error = e;
    } finally {
      this.isCycleInProgress = false;
    }

    if (error) {
      this.logger.error("Error while matchmaking", error);
      return;
    }
  }

  private async submitFoundGames(balances: GameBalance[]) {
    for (const balance of balances) {
      try {
        const room = await this.roomService.createRoom(balance);
        await this.queue.leaveQueue(balance.left.concat(balance.right), false);
        // Ok we're good
        this.ebus.publish(new RoomCreatedEvent(room.id, balance));
      } catch (e) {
        this.logger.warn("There was an issue creating room", e);
      }
    }
  }

  public async iterateModes(_pool: Party[]): Promise<GameBalance[]> {
    const tasks = this.modeBalancingMap.sort((a, b) => a.priority - b.priority);
    let totalPool = [..._pool];
    const foundGames: GameBalance[] = [];

    for (const balanceConfig of tasks) {
      const taskPool = totalPool.filter((t) =>
        t.queueModes.includes(balanceConfig.mode),
      );
      this.logger.log(`Player to balance for mode`, {
        lobby_type: balanceConfig.mode,
        party_count: taskPool.length,
        player_count: taskPool.reduce((a, b) => a + b.players.length, 0),
      });
      const balances = await this.findAllGames(taskPool, balanceConfig);

      foundGames.push(...balances);
      const partiesToRemove = balances.flatMap((t) =>
        t.right.concat(t.left).flatMap((t) => t.id),
      );
      totalPool = totalPool.filter(
        (entry) => !partiesToRemove.includes(entry.id),
      );
    }

    return foundGames;
  }

  private async findAllGames(eligible: Party[], bc: BalanceConfig) {
    let pool = [...eligible].sort(
      createDateComparator<Party>((it) => it.enterQueueAt!),
    );

    let r: GameBalance | undefined = undefined;

    const foundGames: GameBalance[] = [];

    while ((r = await bc.findGames(pool)) !== undefined) {
      const toRemove = r.left.concat(r.right).flatMap((a) => a.id);
      pool = pool.filter((entry) => !toRemove.includes(entry.id));
      foundGames.push(r);
    }

    return foundGames;
  }

  private async findBalancedGame(
    mode: MatchmakingMode,
    pool: Party[],
    teamSize: number = 5,
    timeLimit: number = 5000,
    maxScoreDifference: number = 9000,
  ): Promise<GameBalance | undefined> {
    // Let's first filter off this case
    const totalPlayersInQ = pool.reduce((a, b) => a + b.players.length, 0);
    if (totalPlayersInQ < teamSize * 2) {
      return;
    }

    const bestMatch = findBestMatchBy(
      pool,
      teamSize,
      this.balanceFunction,
      timeLimit, // Max 5 seconds to find a game
      (left, right) =>
        Math.abs(totalScore(left) - totalScore(right)) <= maxScoreDifference,
    );
    if (bestMatch === undefined) {
      return undefined;
    }

    const { left, right } = bestMatch;

    this.logger.log(`Found balanced game`, {
      diff: this.balanceFunction(left, right),
      mode,
      left: left.reduce((a, b) => a + b.score, 0),
      right: right.reduce((a, b) => a + b.score, 0),
    });

    return new GameBalance(mode, left, right);
  }

  private getPartyWaitingScore(party: Party) {
    // 10 seconds = 1 waiting score
    return party.enterQueueAt
      ? (Date.now() - party.enterQueueAt.getTime()) / 1000 / 10
      : 0;
  }

  private balanceFunction = (left: Party[], right: Party[]) => {
    const lavg = left.reduce((a, b) => a + b.score, 0) / 5;
    const ravg = right.reduce((a, b) => a + b.score, 0) / 5;
    const avgDiff = Math.abs(lavg - ravg);

    let waitingScore = 0;
    for (let i = 0; i < left.length; i++) {
      waitingScore += this.getPartyWaitingScore(left[i]);
    }
    for (let i = 0; i < right.length; i++) {
      waitingScore += this.getPartyWaitingScore(right[i]);
    }

    // We want waitingScore to be highest, so we invert it
    waitingScore = Math.log(Math.max(1, waitingScore));
    waitingScore = -waitingScore;

    const comp1 = waitingScore * 100000;

    return comp1 + avgDiff;
  };

  /**
   * Party of 2 players are automatically placed against each other
   */
  private async findSolomidGame(
    mode: MatchmakingMode,
    pool: Party[],
  ): Promise<GameBalance | undefined> {
    if (pool.flatMap((it) => it.players).length < 2) return;
    // If we have a pair party, match them
    const bestMatch = findBestMatchBy(
      pool,
      1,
      this.balanceFunction,
      2000, // Max 5 seconds to find a game
    );

    if (bestMatch === undefined) {
      this.logger.warn("Can't find game: should not be possible");
      return undefined;
    }

    return new GameBalance(mode, bestMatch.left, bestMatch.right);
  }

  /**
   * 1 game per party
   */
  private async findBotsGame(
    mode: MatchmakingMode,
    pool: Party[],
  ): Promise<GameBalance | undefined> {
    if (pool.length === 0) return undefined;

    const entry = pool[0];

    return new GameBalance(mode, [entry], []);
  }
}
