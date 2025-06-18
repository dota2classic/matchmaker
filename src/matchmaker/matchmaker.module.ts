import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import Entities from "@/matchmaker/entity";
import { PlayerEnterQueueRequestedHandler } from "@/matchmaker/event-handler/player-enter-queue-request.handler";
import { PartyService } from "@/matchmaker/service/party.service";
import { CqrsModule } from "@nestjs/cqrs";
import { PlayerService } from "@/matchmaker/service/player.service";
import { DbMatchmakingQueue } from "@/matchmaker/queue/db-matchmaking.queue";
import { RoomService } from "@/matchmaker/service/room.service";
import { QueueService } from "@/matchmaker/service/queue.service";
import { RoomCreatedHandler } from "@/matchmaker/event-handler/room-created.handler";
import { ReadyCheckService } from "@/matchmaker/service/ready-check.service";
import { MatchmakerController } from "@/matchmaker/matchmaker.controller";
import { GetPartyHandler } from "@/matchmaker/query/get-party-query.handler";
import { GetUserRoomHandler } from "@/matchmaker/query/get-user-room-query.handler";
import { GetPartyInvitationsHandler } from "@/matchmaker/query/get-party-invitations-query.handler";
import { GetQueueStateHandler } from "@/matchmaker/query/get-queue-state-query.handler";
import { PlayerLeaveQueueRequestedHandler } from "@/matchmaker/event-handler/player-leave-queue-requested.handler";
import { PartyInviteRequestedHandler } from "@/matchmaker/event-handler/party-invite-requested.handler";
import { PartyInviteAcceptedHandler } from "@/matchmaker/event-handler/party-invite-accepted.handler";
import { PartyLeaveRequestedHandler } from "@/matchmaker/event-handler/party-leave-requested.handler";
import { ReadyStateReceivedHandler } from "@/matchmaker/event-handler/ready-state-received.handler";
import { MatchmakerApiController } from "@/matchmaker/matchmaker-api.controller";
import { Configuration, PlayerApi } from "@/generated-api/gameserver";
import { ConfigService } from "@nestjs/config";

const EventHandlers = [
  PlayerEnterQueueRequestedHandler,
  RoomCreatedHandler,
  PlayerLeaveQueueRequestedHandler,
  PartyInviteRequestedHandler,
  PartyInviteAcceptedHandler,
  PartyLeaveRequestedHandler,
  ReadyStateReceivedHandler,
];
const QueryHandlers = [
  GetPartyHandler,
  GetUserRoomHandler,
  GetPartyInvitationsHandler,
  GetQueueStateHandler,
];

const Apis = [
  {
    provide: PlayerApi,
    useFactory: (config: ConfigService) => {
      return new PlayerApi(
        new Configuration({ basePath: config.get("gameserverUrl") }),
      );
    },
    inject: [ConfigService],
  },
];

@Module({
  controllers: [MatchmakerController, MatchmakerApiController],
  imports: [TypeOrmModule.forFeature(Entities), CqrsModule],
  providers: [
    PartyService,
    PlayerService,
    RoomService,
    QueueService,
    ReadyCheckService,

    DbMatchmakingQueue,
    ...EventHandlers,
    ...QueryHandlers,
    ...Apis,
  ],
})
export class MatchmakerModule {}
