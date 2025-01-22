import { Injectable, Logger } from "@nestjs/common";
import { Party } from "@/matchmaker/entity/party";
import { InjectRepository } from "@nestjs/typeorm";
import { Any, DataSource, In, Repository } from "typeorm";
import { QueueMeta } from "@/matchmaker/entity/queue-meta";
import { Dota2Version } from "@/gateway/shared-types/dota2version";
import { EventBus } from "@nestjs/cqrs";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { QueueUpdatedEvent } from "@/gateway/events/queue-updated.event";
import { PlayerService } from "@/matchmaker/service/player.service";

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
    @InjectRepository(QueueMeta)
    private readonly queueMetaRepository: Repository<QueueMeta>,
    @InjectRepository(PlayerInRoom)
    private readonly playerInRoomRepository: Repository<PlayerInRoom>,
    private readonly ebus: EventBus,
    private readonly ds: DataSource,
    private readonly playerService: PlayerService,
  ) {}

  async enterQueue(
    party: Party,
    modes: MatchmakingMode[] = party.queueModes,
    restartEnterTime: boolean = true,
  ): Promise<void> {
    try {
      await this.playerService.preparePartyForQueue(party);
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
      if (restartEnterTime) {
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

  // Queue is locked by default until is locked manually
  async isLocked(): Promise<boolean> {
    return this.queueMetaRepository.exists({
      where: { version: Dota2Version.Dota_684, isLocked: true },
    });
  }

  async leaveQueue(
    _entries: Party[],
    clearEnterQueueTime: boolean = true,
  ): Promise<void> {
    const entries = _entries.filter((entry) => entry.inQueue);
    entries.forEach((entry) => {
      entry.inQueue = false;
      if (clearEnterQueueTime) {
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
  }

  async setLocked(locked: boolean): Promise<void> {
    this.logger.log(`Set table lock to`, { locked });
    await this.queueMetaRepository.upsert(
      {
        version: Dota2Version.Dota_684,
        isLocked: locked,
      },
      ["version"],
    );
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
