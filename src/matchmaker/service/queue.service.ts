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

@Injectable()
export class QueueService {
  private logger = new Logger(QueueService.name);

  private modeBalancingMap: BalanceConfig[] = [
    {
      mode: MatchmakingMode.UNRANKED,
      priority: 0,
      findGames: (entries) =>
        this.findBalancedGame(MatchmakingMode.UNRANKED, entries, 5, 5000),
    },
  ];

  constructor(
    private readonly queue: DbMatchmakingQueue,
    private readonly roomService: RoomService,
    private readonly ebus: EventBus,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  public async cycle() {
    try {
      await this.queue.setLocked(true);
      const entries = await this.queue.entries();
      const balances = await this.iterateModes(entries);

      await this.submitFoundGames(balances);
    } catch (e) {
      this.logger.error("Error while matchmaking", e);
    } finally {
      await this.queue.setLocked(false);
    }
  }

  private async submitFoundGames(balances: GameBalance[]) {
    console.log(balances)
    for (const balance of balances) {
      try {
        const room = await this.roomService.createRoom(balance);
        await this.queue.leaveQueue(balance.left.concat(balance.right));
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
      const balances = await this.findAllGames(
        totalPool.filter((t) =>
          t.queueModes.includes(balanceConfig.mode),
        ),
        balanceConfig,
      );



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
    let pool = [...eligible];
    let r: GameBalance | undefined = undefined;

    const foundGames: GameBalance[] = [];

    while ((r = await bc.findGames(pool)) !== undefined) {
      const toRemove = r.left.concat(r.right).flatMap((a) => a.id);
      pool = pool.filter((entry) => !toRemove.includes(entry.id));
    }

    return foundGames;
  }

  private async findBalancedGame(
    mode: MatchmakingMode,
    pool: Party[],
    teamSize: number = 5,
    timeLimit: number = 5000,
  ) {
    // Let's first filter off this case
    const totalPlayersInQ = pool.length;
    if (totalPlayersInQ < teamSize * 2) {
      return;
    }

    const bestMatch = findBestMatchBy(
      pool,
      teamSize,
      this.balanceFunction,
      timeLimit, // Max 5 seconds to find a game
    );
    if (bestMatch === undefined) {
      return undefined;
    }

    const { left, right } = bestMatch;

    this.logger.log(`Found balanced game`, {
      diff: this.balanceFunction(left, right),
      mode,
      left: left.reduce((a, b) => a + b.score, 0) / 5,
      right: right.reduce((a, b) => a + b.score, 0) / 5,
    });

    return new GameBalance(mode, left, right);
  }

  private balanceFunction = (left: Party[], right: Party[]) => {
    const lavg = left.reduce((a, b) => a + b.score, 0) / 5;
    const ravg = right.reduce((a, b) => a + b.score, 0) / 5;
    const avgDiff = Math.abs(lavg - ravg);

    let waitingScore = 0;
    for (let i = 0; i < left.length; i++) {
      waitingScore += left[i].waitingScore;
    }
    for (let i = 0; i < right.length; i++) {
      waitingScore += right[i].waitingScore;
    }

    // We want waitingScore to be highest, so we invert it
    waitingScore = Math.log(Math.max(1, waitingScore));
    waitingScore = -waitingScore;

    const comp1 = waitingScore * 100000;

    return comp1 + avgDiff;
  };
}
