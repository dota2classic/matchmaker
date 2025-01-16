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

const EventHandlers = [PlayerEnterQueueRequestedHandler];
@Module({
  imports: [
    TypeOrmModule.forFeature(Entities),
    CqrsModule,
  ],
  providers: [
    PartyService,
    PlayerService,
    RoomService,
    QueueService,
    DbMatchmakingQueue,
    ...EventHandlers,
  ],
})
export class MatchmakerModule {}
