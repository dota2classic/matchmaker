import {
  createParty,
  createRoom,
  testUser,
  useFullModule,
} from "@/test/useFullModule";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { ReadyCheckService } from "@/matchmaker/service/ready-check.service";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { Repository } from "typeorm";
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
    it("should return good parties back to queue if ready check failed", async () => {
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
      const room = await createRoom(te, MatchmakingMode.BOTS_2X2, [p1, p2]);

      await pirRepository.update(
        {
          steamId: p1.players[0].steamId,
        },
        {
          readyState: ReadyState.READY,
        },
      );

      // when
      await rs.finishReadyCheck(room.id);

      // then
      await expect(
        partyRepository.findOne({ where: { id: p1.id } }),
      ).resolves.toMatchObject({ inQueue: true });

      await expect(
        partyRepository.findOne({ where: { id: p2.id } }),
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
  });
});
