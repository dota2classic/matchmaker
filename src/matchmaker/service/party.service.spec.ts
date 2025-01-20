import { createParty, testUser, useFullModule } from "@/test/useFullModule";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { PartyService } from "@/matchmaker/service/party.service";
import { Party } from "@/matchmaker/entity/party";
import { DeepPartial } from "typeorm";
import { PartyInviteCreatedEvent } from "@/gateway/events/party/party-invite-created.event";
import { PlayerId } from "@/gateway/shared-types/player-id";
import { PartyInvite } from "@/matchmaker/entity/party-invite";
import { PartyUpdatedEvent } from "@/gateway/events/party/party-updated.event";
import { PartyInviteExpiredEvent } from "@/gateway/events/party/party-invite-expired.event";
import { v4 } from "uuid";

describe("PartyService", () => {
  const te = useFullModule();

  let partyService: PartyService;

  beforeAll(() => {
    partyService = te.service(PartyService);
  });

  describe("getOrCreatePartyOf", () => {
    it("should return existing party if any", async () => {
      // given
      const party = await createParty(
        te,
        [MatchmakingMode.UNRANKED],
        [testUser(), testUser()],
      );

      // when
      const ap = await partyService.getOrCreatePartyOf(
        party.players[0].steamId,
      );

      // then
      expect(ap).toBeDefined();
      expect(ap).toMatchObject(party);
    });

    it("should create party if doesn't exist", async () => {
      // given
      await createParty(te, [MatchmakingMode.UNRANKED], [testUser()]);

      const user = testUser();

      // when
      const ap = await partyService.getOrCreatePartyOf(user);

      expect(ap).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          players: [
            {
              steamId: user,
              partyId: expect.any(String),
              isLeader: true,
            },
          ],
          score: expect.any(Number),
          waitingScore: 0,
          queueModes: [],
        } satisfies DeepPartial<Party>),
      );
    });
  });

  describe("inviteToParty", () => {
    it("should emit invite if player not in party", async () => {
      // given
      const u1 = testUser();
      const u2 = testUser();
      const p = await createParty(te, [], [u1]);

      // when
      await partyService.invitePlayerToParty(u1, u2);

      // then
      expect(te.ebusSpy).toReceiveCall(
        expect.objectContaining({
          id: expect.any(String),
          leaderId: new PlayerId(u1),
          invited: new PlayerId(u2),
          partyId: p.id,
        } satisfies PartyInviteCreatedEvent),
      );
    });

    it("should not emit invite if player already in party", async () => {
      // given
      const u1 = testUser();
      const u2 = testUser();
      await createParty(te, [], [u1, u2]);

      // when
      await partyService.invitePlayerToParty(u1, u2);

      // then
      expect(te.ebusSpy).toBeCalledTimes(0);
    });

    it("should not emit invite if invite is already created", async () => {
      // given
      const u1 = testUser();
      const u2 = testUser();
      const p = await createParty(te, [], [u1]);
      const partyInviteRepo = te.repo(PartyInvite);

      await partyInviteRepo.save(new PartyInvite(p.id, u1, u2));

      // when
      await partyService.invitePlayerToParty(u1, u2);

      // then
      expect(te.ebusSpy).toBeCalledTimes(0);
    });
  });

  describe("acceptInvite", () => {
    const expectPartyHasPlayer = async (
      partyId: string,
      plr: string,
      not: boolean = false,
    ) => {
      const party: Party = await te
        .repo<Party>(Party)
        .findOneOrFail({ where: { id: partyId } });

      let matcher: any = expect(party.players);
      if (not) matcher = matcher.not;
      return matcher.toPartiallyContain({ steamId: plr });
    };

    const expectPartyHasNotPlayer = (id: string, plr: string) =>
      expectPartyHasPlayer(id, plr, true);

    const expectInviteDeleted = (id: string) =>
      expect(
        te.repo(PartyInvite).exists({ where: { id: id } }),
      ).resolves.toEqual(false);

    it("should add to party if invite is valid", async () => {
      // given
      const u1 = testUser();
      const u2 = testUser();
      const p = await createParty(te, [], [u1]);
      const invite = await te
        .repo(PartyInvite)
        .save(new PartyInvite(p.id, u1, u2));

      // when
      await partyService.acceptInvite(invite.id);

      // then
      expect(te.ebusSpy).nthCalledWith(
        1,
        new PartyUpdatedEvent(p.id, u1, [u1, u2], [], false),
      );
      expect(te.ebusSpy).nthCalledWith(
        2,
        new PartyInviteExpiredEvent(invite.id, invite.invited),
      );

      await expectInviteDeleted(invite.id);

      await expectPartyHasPlayer(invite.partyId, u2);
    });

    it("should leave previous party silently if only one player there", async () => {
      // given
      const u1 = testUser();
      const u2 = testUser();
      const p1 = await createParty(te, [], [u1]);
      const p2 = await createParty(te, [], [u2]);
      const invite = await te
        .repo(PartyInvite)
        .save(new PartyInvite(p1.id, u1, u2));

      // when
      await partyService.acceptInvite(invite.id);

      // then
      expect(te.ebusSpy).nthCalledWith(
        1,
        new PartyUpdatedEvent(p1.id, u1, [u1, u2], [], false),
      );

      expect(te.ebusSpy).nthCalledWith(
        2,
        new PartyInviteExpiredEvent(invite.id, invite.invited),
      );

      await expectInviteDeleted(invite.id);
      await expectPartyHasPlayer(invite.partyId, u2);
    });

    it("should leave previous party with event if not single", async () => {
      // given
      const u1 = testUser();
      const u2 = testUser();
      const u3 = testUser();
      const p1 = await createParty(te, [], [u1]);
      const p2 = await createParty(te, [], [u2, u3]);
      const invite = await te
        .repo(PartyInvite)
        .save(new PartyInvite(p1.id, u1, u2));

      // when
      await partyService.acceptInvite(invite.id);

      // then

      // Update previous party
      expect(te.ebusSpy).nthCalledWith(
        1,
        new PartyUpdatedEvent(p2.id, u3, [u3], [], false),
      );

      // Update new party
      expect(te.ebusSpy).nthCalledWith(
        2,
        new PartyUpdatedEvent(p1.id, u1, [u1, u2], [], false),
      );

      // Delete invite
      expect(te.ebusSpy).nthCalledWith(
        3,
        new PartyInviteExpiredEvent(invite.id, invite.invited),
      );

      await expectInviteDeleted(invite.id);
      await expectPartyHasPlayer(invite.partyId, u2);
      await expectPartyHasNotPlayer(p2.id, u2);
    });

    it("should do nothing if invite doesnt exist", async () => {
      // given
      await createParty(te, [], [testUser()]);

      // when
      await partyService.acceptInvite(v4());

      // then
      expect(te.ebusSpy).toBeCalledTimes(0);
    });
  });

  describe("declineInvite", () => {
    it("should emit event if invite was actually decline", async () => {
      const u1 = testUser();
      const u2 = testUser();
      const p = await createParty(te, [], [u1]);
      const invite = await te
        .repo(PartyInvite)
        .save(new PartyInvite(p.id, u1, u2));

      // when
      await partyService.declineInvite(invite.id);

      // then
      expect(te.ebusSpy).nthCalledWith(
        1,
        new PartyInviteExpiredEvent(invite.id, invite.invited),
      );
    });

    it("should do nothing if invite doesnt exist", async () => {
      await partyService.declineInvite(v4());
      expect(te.ebusSpy).toBeCalledTimes(0);
    });
  });
});
