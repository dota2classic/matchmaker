import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { BalancePair, findBestMatchBy } from "../balance/perms";
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
import { QueueSettings } from "@/matchmaker/entity/queue-settings";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  DodgeListPredicate,
  FixedTeamSizePredicate,
  MakeMaxPlayerScoreDeviationPredicate,
  MakeMaxScoreDifferencePredicate,
  MaxTeamSizeDifference,
} from "@/util/predicates";
import { takeWhileNotDodged } from "@/util/take-while-not-dodged";

@Injectable()
export class QueueService implements OnApplicationBootstrap {
  private logger = new Logger(QueueService.name);
  private isCycleInProgress = false;

  private modeBalancingMap: BalanceConfig[] = [
    {
      mode: MatchmakingMode.UNRANKED,
      priority: 1,
      findGames: (entries, qs) =>
        this.findBalancedGame(
          entries,
          5,
          5000,
          qs.maxTeamScoreDifference,
          qs.maxPlayerScoreDifference,
        ),
    },
    {
      mode: MatchmakingMode.SOLOMID,
      priority: 100,
      findGames: (entries) => this.findSolomidGame(entries),
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
        this.findBalancedGame(entries, 2, 5000, 10e6, 10e6),
    },
    {
      mode: MatchmakingMode.TURBO,
      priority: 100,
      findGames: (entries) =>
        this.findFastEvenGame(MatchmakingMode.TURBO, entries),
    },
    {
      mode: MatchmakingMode.HIGHROOM,
      priority: 0,
      findGames: (entries, qs) =>
        this.findBalancedGame(
          entries,
          5,
          5000,
          qs.maxTeamScoreDifference,
          qs.maxPlayerScoreDifference,
        ),
    },
  ];

  constructor(
    private readonly queue: DbMatchmakingQueue,
    private readonly roomService: RoomService,
    private readonly ebus: EventBus,
    @InjectRepository(QueueSettings)
    private readonly queueSettingsRepository: Repository<QueueSettings>,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  public async cycle(mode?: MatchmakingMode) {
    if (this.isCycleInProgress) {
      this.logger.log("Another cycle is in progress, skipping...");
      return;
    }

    const setting = (
      await this.queueSettingsRepository
        .find({ where: { inProgress: false, mode } })
        .then((it) => it.filter((qs) => qs.shouldRunMatchmaking))
    )[0];

    if (!setting) return;

    let error: Error | undefined;
    try {
      const start = Date.now();
      this.logger.log(`Cycle started at ${Date.now()}`);
      this.isCycleInProgress = true;

      // lock mode
      await this.queueSettingsRepository.update(
        { mode: setting.mode },
        { inProgress: true },
      );
      const entries = await this.queue.entries();
      this.logger.log(`Acquire entries ${entries.length}`);
      const algo = this.modeBalancingMap.find((t) => t.mode === setting.mode);
      if (!algo) {
        throw "No balance algorithm specified for mode " + setting.mode;
      }

      const balances = await this.findGamesForConfig(algo, entries, setting);
      this.logger.log(`Found balances ${balances.length}`);
      await this.submitFoundGames(balances);
      const timeTaken = Date.now() - start;
      this.logger.log(`Full cycle took ${timeTaken} millis`);
    } catch (e) {
      error = e;
    } finally {
      this.isCycleInProgress = false;
      await this.queueSettingsRepository.update(
        { mode: setting.mode },
        { inProgress: false, lastCheckTimestamp: new Date() },
      );
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

  public async findGamesForConfig(
    balanceConfig: BalanceConfig,
    _pool: Party[],
    qs: QueueSettings,
  ): Promise<GameBalance[]> {
    const totalPool = [..._pool];

    const taskPool = totalPool.filter((t) =>
      t.queueModes.includes(balanceConfig.mode),
    );
    this.logger.log(`Player to balance for mode`, {
      lobby_type: balanceConfig.mode,
      party_count: taskPool.length,
      player_count: taskPool.reduce((a, b) => a + b.players.length, 0),
    });
    return this.findAllGames(taskPool, balanceConfig, qs);
  }

  // public async iterateModes(_pool: Party[]): Promise<GameBalance[]> {
  //   const tasks = this.modeBalancingMap.sort((a, b) => a.priority - b.priority);
  //   let totalPool = [..._pool];
  //   const foundGames: GameBalance[] = [];
  //
  //   for (const balanceConfig of tasks) {
  //     const taskPool = totalPool.filter((t) =>
  //       t.queueModes.includes(balanceConfig.mode),
  //     );
  //     this.logger.log(`Player to balance for mode`, {
  //       lobby_type: balanceConfig.mode,
  //       party_count: taskPool.length,
  //       player_count: taskPool.reduce((a, b) => a + b.players.length, 0),
  //     });
  //     const balances = await this.findAllGames(taskPool, balanceConfig);
  //
  //     foundGames.push(...balances);
  //     const partiesToRemove = balances.flatMap((t) =>
  //       t.right.concat(t.left).flatMap((t) => t.id),
  //     );
  //     totalPool = totalPool.filter(
  //       (entry) => !partiesToRemove.includes(entry.id),
  //     );
  //   }
  //
  //   return foundGames;
  // }

  private async findAllGames(
    eligible: Party[],
    bc: BalanceConfig,
    qs: QueueSettings,
  ) {
    let pool = [...eligible].sort(
      createDateComparator<Party>((it) => it.enterQueueAt!),
    );

    let bp: BalancePair | undefined = undefined;

    const foundGames: GameBalance[] = [];

    while ((bp = await bc.findGames(pool, qs)) !== undefined) {
      const toRemove = bp.left.concat(bp.right).flatMap((a) => a.id);
      pool = pool.filter((entry) => !toRemove.includes(entry.id));
      const foundGame = new GameBalance(bc.mode, bp.left, bp.right);
      foundGames.push(foundGame);

      const { left, right } = foundGame;

      this.logger.log(`Found balanced game`, {
        diff: this.balanceFunction(left, right),
        mode: foundGame.mode,
        left: left.reduce((a, b) => a + b.score, 0),
        right: right.reduce((a, b) => a + b.score, 0),
      });
    }

    return foundGames;
  }

  private async findBalancedGame(
    pool: Party[],
    teamSize: number = 5,
    timeLimit: number = 5000,
    maxTeamScoreDifference: number,
    maxPlayerScoreDifference: number,
  ): Promise<BalancePair | undefined> {
    // Let's first filter off this case
    const totalPlayersInQ = pool.reduce((a, b) => a + b.players.length, 0);
    if (totalPlayersInQ < teamSize * 2) {
      return;
    }

    return findBestMatchBy(
      pool,
      this.balanceFunction,
      timeLimit, // Max 5 seconds to find a game
      [
        FixedTeamSizePredicate(teamSize),
        MakeMaxScoreDifferencePredicate(maxTeamScoreDifference),
        MakeMaxPlayerScoreDeviationPredicate(maxPlayerScoreDifference),
        DodgeListPredicate,
      ],
    );
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
    pool: Party[],
  ): Promise<BalancePair | undefined> {
    if (pool.flatMap((it) => it.players).length < 2) return;
    // If we have a pair party, match them
    return findBestMatchBy(
      pool,
      this.balanceFunction,
      2000, // Max 5 seconds to find a game,
      [FixedTeamSizePredicate(1)],
    );
  }

  /**
   * 1 game per party
   */
  private async findBotsGame(
    mode: MatchmakingMode,
    pool: Party[],
  ): Promise<GameBalance | undefined> {
    if (pool.length === 0) return undefined;

    const entries = takeWhileNotDodged(pool, 5);

    return new GameBalance(mode, entries, []);
  }

  private async findFastEvenGame(mode: MatchmakingMode, _pool: Party[]) {
    const pool = [..._pool]
      .sort((a, b) => b.queueTime - a.queueTime)
      .slice(0, 10);

    if (pool.length <= 1) return undefined;

    return findBestMatchBy(pool, this.balanceFunction, 2000, [
      MaxTeamSizeDifference(1),
      DodgeListPredicate,
    ]);
  }

  async onApplicationBootstrap() {
    await this.queueSettingsRepository.update(
      { inProgress: true },
      {
        inProgress: false,
      },
    );
  }
}
