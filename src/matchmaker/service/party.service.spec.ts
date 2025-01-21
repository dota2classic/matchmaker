import { createParty, testUser, useFullModule } from "@/test/useFullModule";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { PartyService } from "@/matchmaker/service/party.service";
import { Party } from "@/matchmaker/entity/party";
import { DeepPartial } from "typeorm";
import { PartyInviteCreatedEvent } from "@/gateway/events/party/party-invite-created.event";
import { PartyInvite } from "@/matchmaker/entity/party-invite";
import { PartyUpdatedEvent } from "@/gateway/events/party/party-updated.event";
import { PartyInviteExpiredEvent } from "@/gateway/events/party/party-invite-expired.event";
import { v4 } from "uuid";
import { QueueUpdatedEvent } from "@/gateway/events/queue-updated.event";
import { createTestingUtils } from "@/test/party-queue-test.utils";

describe("PartyService", () => {
  const te = useFullModule();

  let partyService: PartyService;

  const {
    expectInviteDeleted,
    expectPartyHasPlayer,
    expectPartyHasNotPlayer,
    expectPartyInQueue,
  } = createTestingUtils(te);

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
          leaderId: u1,
          invited: u2,
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

    it("should remove parties from queue when invite accepted", async () => {
      // given
      const u3 = testUser();
      const p1 = await createParty(
        te,
        [MatchmakingMode.UNRANKED],
        [testUser()],
        true,
      );
      const p2 = await createParty(
        te,
        [MatchmakingMode.UNRANKED],
        [testUser(), u3],
        true,
      );

      const invite = await te
        .repo(PartyInvite)
        .save(new PartyInvite(p1.id, p1.leader, u3));

      // when
      await partyService.acceptInvite(invite.id);

      // then
      await expectInviteDeleted(invite.id);
      await expectPartyHasPlayer(p1.id, u3);
      await expectPartyHasNotPlayer(p2.id, u3);
      await expectPartyInQueue(p1.id, false);
      await expectPartyInQueue(p2.id, false);
    });

    it("should do nothing if invite doesnt exist", async () => {
      await partyService.declineInvite(v4());
      expect(te.ebusSpy).toBeCalledTimes(0);
    });
  });

  describe("leaveParty", () => {
    it("should leave from party if party exists", async () => {
      // given
      const u1 = testUser();
      const u2 = testUser();
      const p1 = await createParty(
        te,
        [MatchmakingMode.UNRANKED],
        [u1, u2],
        true,
      );

      // when
      await partyService.leaveCurrentParty(u2);

      // then
      await expectPartyHasPlayer(p1.id, u1);
      await expectPartyHasNotPlayer(p1.id, u2);
      await expectPartyInQueue(p1.id, false);
      expect(te.ebusSpy).toHaveBeenNthCalledWith(
        1,
        new PartyUpdatedEvent(
          p1.id,
          u1,
          [u1, u2],
          [MatchmakingMode.UNRANKED],
          false,
        ),
      );
      expect(te.ebusSpy.mock.calls[1][0]).toBeInstanceOf(QueueUpdatedEvent);
      expect(te.ebusSpy).toHaveBeenNthCalledWith(
        3,
        new PartyUpdatedEvent(
          p1.id,
          u1,
          [u1],
          [MatchmakingMode.UNRANKED],
          false,
        ),
      );
    });
  });
});
// {"partyId":"61d4719a-c734-4f96-a02f-e3ae831fa76b","leaderId":"351856","players":["351856","601029"],"modes":[1],"inQueue":false}
// {"inQueue": false, "leaderId": "351856", "modes": [1], "partyId": "61d4719a-c734-4f96-a02f-e3ae831fa76b", "players": ["351856"]}
