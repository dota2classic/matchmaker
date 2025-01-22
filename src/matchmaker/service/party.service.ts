import { Injectable, Logger } from "@nestjs/common";
import { Party } from "@/matchmaker/entity/party";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { PlayerService } from "@/matchmaker/service/player.service";
import { DbMatchmakingQueue } from "@/matchmaker/queue/db-matchmaking.queue";
import { PartyInvite } from "@/matchmaker/entity/party-invite";
import { EventBus } from "@nestjs/cqrs";
import { PartyInviteExpiredEvent } from "@/gateway/events/party/party-invite-expired.event";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class PartyService {
  private logger = new Logger(PartyService.name);

  constructor(
    @InjectRepository(Party)
    private readonly partyRepository: Repository<Party>,
    @InjectRepository(PlayerInParty)
    private readonly playerInPartyRepository: Repository<PlayerInParty>,
    @InjectRepository(PartyInvite)
    private readonly partyInviteRepository: Repository<PartyInvite>,
    private readonly datasource: DataSource,
    private readonly playerService: PlayerService,
    private readonly queue: DbMatchmakingQueue,
    private readonly ebus: EventBus,
  ) {}

  private async findPartyOf(steamId: string): Promise<Party | null> {
    return this.partyRepository
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.players", "players")
      .leftJoin("p.players", "filterplayers")
      .where("filterplayers.steam_id = :steamId", { steamId: steamId })
      .getOne();
  }

  public async getOrCreatePartyOf(steamId: string) {
    let party = await this.findPartyOf(steamId);

    if (!party) {
      party = await this.createParty(steamId);
    }
    return party;
  }

  private async createParty(
    leader: string,
    playerIds: string[] = [leader],
  ): Promise<Party> {
    return this.datasource.transaction(async (em) => {
      const p = await em.save(new Party());

      p.players = await em.save(
        playerIds.map(
          (steamId) => new PlayerInParty(steamId, p.id, steamId === leader),
        ),
      );
      return p;
    });
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  public async cleanupEmptyParties() {
    const trash = await this.partyRepository
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.players", "players")
      .where({ inQueue: true })
      .having("count(players) = 0")
      .groupBy("p.id, players.steam_id")
      .getMany();

    if (!trash.length) return;

    await this.partyRepository.remove(trash);
    this.logger.log(`Removed ${trash.length} trash parties`);
  }

  @Cron(CronExpression.EVERY_SECOND)
  public async expirePartyInvites(partyInviteDuration: string = "1m") {
    const expiredInvites = await this.partyInviteRepository
      .createQueryBuilder("r")
      .where("r.created_at + :partyInviteDuration::interval < now()", {
        partyInviteDuration,
      })
      .getMany();

    await this.partyInviteRepository.remove(expiredInvites);

    expiredInvites.map((invite) =>
      this.ebus.publish(new PartyInviteExpiredEvent(invite.id, invite.invited)),
    );
  }

  async returnToQueues(goodPartyIds: string[]) {
    const parties = await this.partyRepository.find({
      where: {
        id: In(goodPartyIds),
      },
    });

    await Promise.all(
      parties.map((party) =>
        this.queue.enterQueue(party, party.queueModes, false),
      ),
    );
  }

  public async invitePlayerToParty(inviter: string, invited: string) {
    const p = await this.getOrCreatePartyOf(inviter);

    // Already in party
    if (p.players.findIndex((t) => t.steamId === invited) !== -1) {
      return;
    }

    try {
      const invite = await this.partyInviteRepository.save(
        new PartyInvite(p.id, inviter, invited),
      );
      this.ebus.publish(invite.toEvent());
    } catch (e) {
      // Duplicate index, do nothing
    }
  }

  public async declineInvite(inviteId: string) {
    const invite = await this.partyInviteRepository.findOne({
      where: { id: inviteId },
    });

    if (!invite) return;

    await this.partyInviteRepository.remove(invite);
    this.ebus.publish(new PartyInviteExpiredEvent(inviteId, invite.invited));
  }

  public async acceptInvite(inviteId: string) {
    const invite = await this.partyInviteRepository.findOne({
      where: { id: inviteId },
    });

    if (!invite) return;

    const party = invite.party;

    // Already in party
    if (party.players.findIndex((t) => t.steamId === invite.invited) !== -1) {
      return;
    }

    // Leave current party
    await this.leaveCurrentParty(invite.invited);

    // Then, join new party
    await this.datasource.transaction(async (em) => {
      let partyMembership = new PlayerInParty(invite.invited, party.id, false);
      await em.save(PlayerInParty, partyMembership);

      const newParty = await em.findOneOrFail<Party>(Party, {
        where: { id: invite.partyId },
      });
      this.ebus.publish(newParty.snapshotEvent());

      // Delete invite
      await em
        .createQueryBuilder()
        .delete()
        .from(PartyInvite)
        .where({ id: invite.id })
        .execute();

      this.ebus.publish(new PartyInviteExpiredEvent(invite.id, invite.invited));
    });

    // And then, leave queue
    await this.queue.leaveQueue([invite.party]);
  }

  public async leaveCurrentParty(steamId: string) {
    const party = await this.findPartyOf(steamId);
    if (!party) return;

    // Leave party from queue
    await this.queue.leaveQueue([party]);

    await this.datasource.transaction(async (em) => {
      // Find existing membership
      let partyMembership: PlayerInParty | null =
        await em.findOne<PlayerInParty>(PlayerInParty, {
          where: {
            steamId: steamId,
          },
          relations: ["party"],
        });

      if (!partyMembership) return;

      // Gotta do some cleaning
      // First, delete party membership
      await em.remove(PlayerInParty, partyMembership);

      // Update old party
      partyMembership.party.players = partyMembership.party.players.filter(
        (plr) => plr.steamId !== steamId,
      );

      // If we were a leader, try to make another leader
      if (partyMembership.isLeader) {
        const newLeader = partyMembership.party.players.find(
          (plr) => plr.steamId !== steamId,
        );
        // There is another player in party, make him a leader
        if (newLeader) {
          newLeader.isLeader = true;
          await em.save(PlayerInParty, newLeader);
          // Remove invited player from entity for event
        } else {
          // Well, its dead party to be cleaned up later. We're good
        }
      }

      if (partyMembership.party.players.length > 0) {
        await this.ebus.publish(partyMembership.party.snapshotEvent());
      }
    });
  }
}
