import {
  createParty,
  createRoom,
  testUser,
  useFullModule,
} from "@/test/useFullModule";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { ReadyCheckService } from "@/matchmaker/service/ready-check.service";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { DeepPartial, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ReadyState } from "@/gateway/events/ready-state-received.event";
import { Party } from "@/matchmaker/entity/party";
import { PlayerDeclinedGameEvent } from "@/gateway/events/mm/player-declined-game.event";
import { MatchPlayer, RoomReadyEvent } from "@/gateway/events/room-ready.event";
import { PlayerId } from "@/gateway/shared-types/player-id";
import { DotaTeam } from "@/gateway/shared-types/dota-team";
import { Dota2Version } from "@/gateway/shared-types/dota2version";

describe("ReadyCheckService", () => {
  let rs: ReadyCheckService;
  let pirRepository: Repository<PlayerInRoom>;
  let partyRepository: Repository<Party>;

  const te = useFullModule();

  beforeAll(() => {
    rs = te.module.get(ReadyCheckService);
    pirRepository = te.module.get(getRepositoryToken(PlayerInRoom));
    partyRepository = te.module.get(getRepositoryToken(Party));
  });

  describe("finishReadyCheck", () => {
    it("should return good parties back to queue and preserve enterQueueTime if ready check failed", async () => {
      // given
      const p1 = await createParty(
        te,
        [MatchmakingMode.BOTS_2X2],
        [testUser()],
        true,
      );
      const p2 = await createParty(
        te,
        [MatchmakingMode.BOTS_2X2],
        [testUser()],
      );

      const originalEnterQueueTime = p1.enterQueueAt;
      const room = await createRoom(te, MatchmakingMode.BOTS_2X2, [p1, p2]);

      await pirRepository.update(
        {
          steamId: p1.leader,
        },
        {
          readyState: ReadyState.READY,
        },
      );

      const some = await pirRepository.find({ where: { roomId: room.id } });

      // when
      await rs.timeoutPendingReadyChecks(room.id);
      await rs.finishReadyCheck(room.id);

      console.log(await partyRepository.findOne({ where: { id: p1.id } }));
      // then
      await expect(
        partyRepository.findOne({ where: { id: p1.id } }),
      ).resolves.toMatchObject({
        inQueue: true,
        enterQueueAt: originalEnterQueueTime,
      } satisfies DeepPartial<Party>);

      await expect(
        partyRepository.findOne({ where: { id: p2.id } }),
      ).resolves.toMatchObject({ inQueue: false } satisfies DeepPartial<Party>);
    });

    it("should not return to queue parties with multiple players if one declined", async () => {
      // given
      const u1 = testUser();
      const u2 = testUser();
      const p1 = await createParty(te, [MatchmakingMode.BOTS_2X2], [u1, u2]);
      const room = await createRoom(te, MatchmakingMode.BOTS, [p1]);
      await rs.startReadyCheck(room);

      // when
      await rs.submitReadyCheck(room.id, u2, ReadyState.DECLINE);

      // then
      await expect(
        partyRepository.findOne({ where: { id: p1.id } }),
      ).resolves.toMatchObject({ inQueue: false });
    });

    it("should report declined players", async () => {
      // given
      const p1 = await createParty(
        te,
        [MatchmakingMode.BOTS_2X2],
        [testUser()],
      );
      const room = await createRoom(te, MatchmakingMode.BOTS_2X2, [p1]);
      await rs.startReadyCheck(room);

      await pirRepository.update(
        {
          steamId: p1.leader,
        },
        {
          readyState: ReadyState.DECLINE,
        },
      );

      // when
      await rs.finishReadyCheck(room.id);

      // then
      expect(te.ebusSpy).toBeCalledWith(
        new PlayerDeclinedGameEvent(p1.leader, MatchmakingMode.BOTS_2X2),
      );
    });

    it("should emit event if room is good", async () => {
      // given
      const p1 = await createParty(
        te,
        [MatchmakingMode.BOTS_2X2],
        [testUser()],
      );
      const p2 = await createParty(
        te,
        [MatchmakingMode.BOTS_2X2],
        [testUser()],
      );
      const room = await createRoom(te, MatchmakingMode.BOTS_2X2, [p1], [p2]);
      await rs.startReadyCheck(room);
      // all accept
      await pirRepository.update(
        {
          roomId: room.id,
        },
        { readyState: ReadyState.READY },
      );

      // when
      await rs.finishReadyCheck(room.id);

      // then
      expect(te.ebusSpy).toBeCalledWith(
        new RoomReadyEvent(
          room.id,
          MatchmakingMode.BOTS_2X2,
          [
            new MatchPlayer(new PlayerId(p1.leader), DotaTeam.RADIANT, p1.id),
            new MatchPlayer(new PlayerId(p2.leader), DotaTeam.DIRE, p2.id),
          ],
          Dota2Version.Dota_684,
        ),
      );
    });

    // TODO: fix test
    // it("should expire ready checks via cron job", async () => {
    //   // given
    //   const p1 = await createParty(
    //     te,
    //     [MatchmakingMode.BOTS_2X2],
    //     [testUser()],
    //   );
    //   const p2 = await createParty(
    //     te,
    //     [MatchmakingMode.BOTS_2X2],
    //     [testUser()],
    //   );
    //   const room = await createRoom(te, MatchmakingMode.BOTS_2X2, [p1], [p2]);
    //   await rs.startReadyCheck(room);
    //   // when
    //   await sleep(2000);
    //   await rs.expireReadyChecks("1s");
    //
    //   // then
    //   // in this case, both players didn't accept, so
    //   expect(te.ebusSpy).toReceiveCall(
    //     new PlayerDeclinedGameEvent(p1.leader, MatchmakingMode.BOTS_2X2),
    //   );
    //   expect(te.ebusSpy).toReceiveCall(
    //     new PlayerDeclinedGameEvent(p2.leader, MatchmakingMode.BOTS_2X2),
    //   );
    // });
  });
});
