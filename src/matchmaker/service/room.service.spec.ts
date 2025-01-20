import { createParties, testUser, useFullModule } from "@/test/useFullModule";
import { RoomService } from "@/matchmaker/service/room.service";
import { GameBalance } from "@/matchmaker/balance/game-balance";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { Room } from "@/matchmaker/entity/room";
import { DeepPartial, Repository } from "typeorm";
import { ReadyState } from "@/gateway/events/ready-state-received.event";
import { Party } from "@/matchmaker/entity/party";
import { v4 } from "uuid";
import { getRepositoryToken } from "@nestjs/typeorm";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { DotaTeam } from "@/gateway/shared-types/dota-team";

describe("RoomService", () => {
  const te = useFullModule();

  describe("createRoom", () => {
    it("should succeed when parties exist", async () => {
      // given
      const parties = await createParties(te, 10, [MatchmakingMode.UNRANKED]);

      // when
      const rs = te.module.get(RoomService);
      const room = await rs.createRoom(
        new GameBalance(
          MatchmakingMode.UNRANKED,
          parties.slice(0, 5),
          parties.slice(5),
        ),
      );

      // then
      expect(room).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          lobbyType: MatchmakingMode.UNRANKED,
          players: parties.map((party) => ({
            partyId: party.id,
            roomId: room.id,
            steamId: party.players[0].steamId,
            readyState: ReadyState.PENDING,
            team: expect.any(Number),
          })),
        } satisfies DeepPartial<Room>),
      );
    });

    it("should fail if parties dont exist", async () => {
      // given
      const parties: Party[] = await Promise.all(
        Array.from({ length: 10 }, () => {
          const pid = v4();
          const p = new Party();
          p.id = pid;
          p.players = [
            { steamId: testUser(), partyId: pid, isLeader: true, party: p },
          ];
          p.score = 0;
          p.waitingScore = 0;
          p.queueModes = [MatchmakingMode.UNRANKED];
          p.inQueue = false;

          return p;
        }),
      );
      const rs = te.module.get(RoomService);

      // when
      const createRoom = rs.createRoom(
        new GameBalance(
          MatchmakingMode.UNRANKED,
          parties.slice(0, 5),
          parties.slice(5),
        ),
      );
      // then
      await expect(createRoom).rejects.toThrow("insert or update on table");
    });

    it("should fail if player already in another room", async () => {
      // given
      const parties = await createParties(te, 10, [MatchmakingMode.UNRANKED]);
      const pir: Repository<PlayerInRoom> = te.module.get(
        getRepositoryToken(PlayerInRoom),
      );
      const r: Repository<Room> = te.module.get(getRepositoryToken(Room));
      const room = await r.save(new Room(MatchmakingMode.UNRANKED));

      await pir.save(
        new PlayerInRoom(
          room.id,
          parties[0].id,
          parties[0].players[0].steamId,
          DotaTeam.RADIANT,
        ),
      );

      // when
      const rs = te.module.get(RoomService);
      const createRoom = rs.createRoom(
        new GameBalance(
          MatchmakingMode.UNRANKED,
          parties.slice(0, 5),
          parties.slice(5),
        ),
      );

      // then
      await expect(createRoom).rejects.toThrow("duplicate key value violates");
    });
  });
});
