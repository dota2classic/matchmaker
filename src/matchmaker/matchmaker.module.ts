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

const EventHandlers = [PlayerEnterQueueRequestedHandler, RoomCreatedHandler];
@Module({
  controllers: [MatchmakerController],
  imports: [TypeOrmModule.forFeature(Entities), CqrsModule],
  providers: [
    PartyService,
    PlayerService,
    RoomService,
    QueueService,
    ReadyCheckService,

    DbMatchmakingQueue,
    ...EventHandlers,
  ],
})
export class MatchmakerModule {}
