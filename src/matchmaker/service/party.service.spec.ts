import { createParty, testUser, useFullModule } from "@/test/useFullModule";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { PartyService } from "@/matchmaker/service/party.service";
import { Party } from "@/matchmaker/entity/party";
import { DeepPartial } from "typeorm";

describe("PartyService", () => {
  const te = useFullModule();

  describe("getOrCreatePartyOf", () => {
    it("should return existing party if any", async () => {
      // given
      const party = await createParty(
        te,
        [MatchmakingMode.UNRANKED],
        [testUser(), testUser()],
      );

      // when
      const ap = await te.module
        .get(PartyService)
        .getOrCreatePartyOf(party.players[0].steamId);

      // then
      expect(ap).toBeDefined();
      expect(ap).toMatchObject(party);
    });

    it("should create party if doesn't exist", async () => {
      // given
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const someParty = await createParty(
        te,
        [MatchmakingMode.UNRANKED],
        [testUser()],
      );

      const user = testUser();

      // when
      const ap = await te.module.get(PartyService).getOrCreatePartyOf(user);

      expect(ap).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          players: [
            {
              steamId: user,
              partyId: expect.any(String),
              isLeader: true,
              score: expect.any(Number),
            },
          ],
          score: expect.any(Number),
          waitingScore: 0,
          queueModes: [],
        } satisfies DeepPartial<Party>),
      );
    });
  });
});
