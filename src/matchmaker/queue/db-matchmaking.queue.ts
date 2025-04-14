import { Injectable, Logger, Optional } from "@nestjs/common";
import { Party } from "@/matchmaker/entity/party";
import { InjectRepository } from "@nestjs/typeorm";
import { Any, DataSource, In, Repository } from "typeorm";
import { EventBus } from "@nestjs/cqrs";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { QueueUpdatedEvent } from "@/gateway/events/queue-updated.event";
import { PlayerService } from "@/matchmaker/service/player.service";
import { MetricsService } from "@/metrics/metrics.service";

/**
 * Contracts:
 * 1) Party can't have modes != [] if in room
 */
@Injectable()
export class DbMatchmakingQueue {
  private logger = new Logger(DbMatchmakingQueue.name);
  constructor(
    @InjectRepository(Party)
    private readonly partyRepository: Repository<Party>,
    @InjectRepository(PlayerInRoom)
    private readonly playerInRoomRepository: Repository<PlayerInRoom>,
    private readonly ebus: EventBus,
    private readonly ds: DataSource,
    private readonly playerService: PlayerService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async enterQueue(
    party: Party,
    modes: MatchmakingMode[] = party.queueModes,
    restartEnterTime: boolean = true,
  ): Promise<void> {
    try {
      await this.playerService.preparePartyForQueue(party, modes);
    } catch (e) {
      this.logger.error("Prevented bad party from entering queue", e);
      return;
    }

    // Contract #1
    const isInRoom = await this.playerInRoomRepository.exists({
      where: {
        steamId: Any(party.players.map((plr) => plr.steamId)),
      },
    });
    if (isInRoom) return;

    party = await this.ds.transaction((em) => {
      party.inQueue = true;
      party.queueModes = modes;
      if (restartEnterTime || !party.enterQueueAt) {
        party.enterQueueAt = new Date();
      }
      return em.save(party);
    });
    await this.partyUpdated(party);
    await this.queueUpdated();
  }

  async entries(): Promise<Party[]> {
    return this.partyRepository
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.players", "players")
      .where({ inQueue: true })
      .having("count(players) > 0")
      .groupBy("p.id, players.steam_id")
      .getMany();
  }

  async leaveQueue(
    _entries: Party[],
    clearEnterQueueTime: boolean
  ): Promise<void> {
    const entries = _entries.filter((entry) => entry.inQueue);
    const preparedMetrics: { mode: MatchmakingMode; duration: number }[] = [];
    entries.forEach((entry) => {
      entry.inQueue = false;
      if (clearEnterQueueTime && entry.enterQueueAt) {
        preparedMetrics.push(
          ...entry.queueModes.map((mode) => ({
            mode,
            duration: Date.now() - entry.enterQueueAt!.getTime(),
          })),
        )
        entry.enterQueueAt = null;
      }
    });
    if (entries.length === 0) return;

    const updatedParties = await this.ds.transaction(async (em) => {
      await em
        .createQueryBuilder<Party>(Party, "p")
        .update<Party>(Party)
        .set({
          inQueue: false,
          enterQueueAt: clearEnterQueueTime ? null : undefined,
        })
        .where({
          id: In(entries.map((it) => it.id)),
        })
        .execute();

      return entries;
    });
    // Nothing happened
    await this.partyUpdated(updatedParties);
    await this.queueUpdated();

    preparedMetrics.forEach(({  duration, mode }) => {
      this.metrics?.recordLeaveQueue(mode, duration)
    });
  }
  // Events

  private async queueUpdated() {
    const res: { lobby: string; count: number }[] = await this.ds
      .createQueryBuilder()
      .addCommonTableExpression(
        this.partyRepository
          .createQueryBuilder("p")
          .leftJoinAndSelect("p.players", "players")
          .select("players.steam_id", "steam_id")
          .addSelect("unnest(p.queue_modes)", "lobby_type")
          .where("p.inQueue"),
        "modes",
      )
      .select("modes.lobby_type::party_queue_modes_enum", "lobby")
      .addSelect("count(modes.steam_id)::int", "count")
      .from("modes", "modes")
      .groupBy("modes.lobby_type")
      .getRawMany();

    this.ebus.publish(
      new QueueUpdatedEvent(
        res.map((raw) => ({ count: raw.count, lobby: Number(raw.lobby) })),
      ),
    );
  }

  private async partyUpdated(party: Party | Party[]) {
    const parties = Array.isArray(party) ? party : [party];
    parties
      .map((party) => party.snapshotEvent())
      .map((evt) => this.ebus.publish(evt));
  }
}
