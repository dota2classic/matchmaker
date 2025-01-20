import {
  createParty,
  createRoom,
  sleep,
  testUser,
  useFullModule,
} from "@/test/useFullModule";
import { PlayerEnterQueueRequestedEvent } from "@/gateway/events/mm/player-enter-queue-requested.event";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import Redis from "ioredis";
import { DeepPartial } from "typeorm";
import { RoomCreatedEvent } from "@/matchmaker/event/room-created.event";
import { GameBalance } from "@/matchmaker/balance/game-balance";
import { ReadyCheckService } from "@/matchmaker/service/ready-check.service";
import { PartyInvite } from "@/matchmaker/entity/party-invite";
import { PartyService } from "@/matchmaker/service/party.service";
import { ReadyState } from "@/gateway/events/ready-state-received.event";
import { RoomReadyEvent } from "@/gateway/events/room-ready.event";
import { PlayerId } from "@/gateway/shared-types/player-id";
import { DotaTeam } from "@/gateway/shared-types/dota-team";
import { Dota2Version } from "@/gateway/shared-types/dota2version";
import { Party } from "@/matchmaker/entity/party";
import { QueueService } from "@/matchmaker/service/queue.service";

describe("AppController (e2e)", () => {
  const te = useFullModule(false);

  let redisClient: Redis;

  beforeEach(async () => {
    redisClient = new Redis(
      te.containers.redis.getPort(),
      te.containers.redis.getHost(),
      {
        password: te.containers.redis.getPassword(),
      },
    );
  });

  afterEach(() => {
    redisClient.disconnect()
  })

  const publish = async (t: any) =>
    redisClient.publish(t.constructor.name, JSON.stringify(t));

  it("enter queue and leave flow", async () => {
    const u1 = testUser();
    const u2 = testUser();

    // Enter 1x1 queue
    await publish(
      new PlayerEnterQueueRequestedEvent(u1, [MatchmakingMode.SOLOMID]),
    );
    await publish(
      new PlayerEnterQueueRequestedEvent(u2, [MatchmakingMode.SOLOMID]),
    );

    // Wait for events to process
    await sleep(500);

    //  Simulate cycle call
    await te.module.get(QueueService).cycle();

    expect(te.ebusSpy).toReceiveCall(
      expect.objectContaining({
        id: expect.any(String),
        balance: expect.objectContaining({
          mode: MatchmakingMode.SOLOMID,
        } satisfies DeepPartial<GameBalance>),
      } satisfies DeepPartial<RoomCreatedEvent>),
    );
  });

  describe("Party invites and room interaction", () => {
    it("accepted invite should not intervene with room process", async () => {
      // given
      const u1 = testUser();
      const u2 = testUser();

      const u3 = testUser();

      const p1 = await createParty(te, [MatchmakingMode.SOLOMID], [u1], false);
      const p2 = await createParty(te, [MatchmakingMode.SOLOMID], [u2], false);

      const room = await createRoom(te, MatchmakingMode.SOLOMID, [p1], [p2]);
      await te.service(ReadyCheckService).startReadyCheck(room);

      console.log("Ready check start");

      const invite = await te
        .repo(PartyInvite)
        .save(new PartyInvite(p1.id, u1, u3));

      console.log("invite created");

      // when
      await te.service(PartyService).acceptInvite(invite.id);
      console.log("invite accepted");
      await te
        .service(ReadyCheckService)
        .submitReadyCheck(room.id, u1, ReadyState.READY);
      console.log("ready check submit 1");
      await te
        .service(ReadyCheckService)
        .submitReadyCheck(room.id, u2, ReadyState.READY);
      console.log("ready check submit 2");
      await sleep(1000);

      // Results:
      // 1) Room should be left intact: u1 vs u2
      // 2) Party p1 should now have u1 and u3

      console.log("results");
      expect(te.ebusSpy).toReceiveCall(
        new RoomReadyEvent(
          room.id,
          room.lobbyType,
          [u1, u2].map((id, idx) => ({
            playerId: new PlayerId(id),
            partyId: idx == 0 ? p1.id : p2.id,
            team: idx === 0 ? DotaTeam.RADIANT : DotaTeam.DIRE,
          })),
          Dota2Version.Dota_684,
        ),
      );

      await expect(
        te
          .repo<Party>(Party)
          .findOneOrFail({ where: { id: p1.id } })
          .then((it) => it.players),
      ).resolves.toPartiallyContain({
        steamId: u3,
      });
    });
  });
});
