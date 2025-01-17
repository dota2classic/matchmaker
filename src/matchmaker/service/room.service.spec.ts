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
import SpyInstance = jest.SpyInstance;

describe("RoomService", () => {
  const te = useFullModule();
  let spy: SpyInstance;

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
          })),
        } satisfies DeepPartial<Room>),
      );


    });

    it("should fail if parties dont exist", async () => {
      // given
      const parties: Party[] = await Promise.all(
        Array.from({ length: 10 }, () => {
          const pid = v4();
          return {
            id: pid,
            players: [{ steamId: testUser(), partyId: pid, score: 0 }],
            score: 0,
            waitingScore: 0,
            queueModes: [MatchmakingMode.UNRANKED],
          } as Party;
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
        new PlayerInRoom(room.id, parties[0].id, parties[0].players[0].steamId),
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
