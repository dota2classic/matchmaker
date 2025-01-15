import { Injectable } from "@nestjs/common";
import { Party } from "@/matchmaker/entity/party";
import { InjectRepository } from "@nestjs/typeorm";
import { Any, DataSource, In, Repository } from "typeorm";
import { QueueMeta } from "@/matchmaker/entity/queue-meta";
import { Dota2Version } from "@/gateway/shared-types/dota2version";
import { EventBus } from "@nestjs/cqrs";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { QueueUpdatedEvent } from "@/gateway/events/queue-updated.event";
import { PartyUpdatedEvent } from "@/gateway/events/party/party-updated.event";

/**
 * Contracts:
 * 1) Party can't have modes != [] if in room
 * 2) Can't mutate queue if it is locked
 */
@Injectable()
export class DbMatchmakingQueue {
  constructor(
    @InjectRepository(Party)
    private readonly pr: Repository<Party>,
    @InjectRepository(QueueMeta)
    private readonly queueMetaRepository: Repository<QueueMeta>,
    @InjectRepository(PlayerInRoom)
    private readonly playerInRoomRepository: Repository<PlayerInRoom>,
    private readonly ebus: EventBus,
    private readonly ds: DataSource,
  ) {}

  async enterQueue(entry: Party, modes: MatchmakingMode[]): Promise<void> {
    if (await this.isLocked()) return;
    // Contract #1
    const isInRoom = await this.playerInRoomRepository.exists({
      where: {
        steamId: Any(entry.players.map((plr) => plr.steamId)),
      },
    });
    if (isInRoom) return;

    await this.ds.transaction((em) => {
      entry.queueModes = modes;
      return em.save(entry);
    });
    await this.partyUpdated(entry);
    await this.queueUpdated();
  }

  async entries(): Promise<Party[]> {
    return this.pr.find();
  }

  async isLocked(): Promise<boolean> {
    const isQueueUnlocked = await this.queueMetaRepository.exists({
      where: { version: Dota2Version.Dota_684, isLocked: false },
    });

    return !isQueueUnlocked;
  }

  async leaveQueue(_entries: Party[]): Promise<void> {
    if (await this.isLocked()) return;

    let entries = _entries.filter((entry) => entry.queueModes.length > 0);
    entries.forEach((entry) => (entry.queueModes = []));
    if (entries.length === 0) return;

    const updatedParties = await this.ds.transaction(async (em) => {
      await em
        .createQueryBuilder<Party>(Party, "p")
        .update<Party>(Party)
        .set({
          queueModes: [],
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
        this.pr
          .createQueryBuilder("p")
          .select("p.id", "id")
          .addSelect("unnest(p.queue_modes)", "lobby_type"),
        "modes",
      )
      .select("modes.lobby_type::party_queue_modes_enum", "lobby")
      .addSelect("count(modes.id)::int", "count")
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
      .map(
        (party) =>
          new PartyUpdatedEvent(
            party.id,
            party.players.find((t) => t.isLeader)!.steamId,
            party.players.map((plr) => plr.steamId),
            party.queueModes,
          ),
      )
      .map((evt) => this.ebus.publish(evt));
  }
}
