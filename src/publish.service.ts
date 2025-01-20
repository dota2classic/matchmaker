import { Inject, Injectable, OnApplicationBootstrap, Type } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { EventBus, ofType, QueryBus } from "@nestjs/cqrs";
import { PlayerEnterQueueRequestedEvent } from "@/gateway/events/mm/player-enter-queue-requested.event";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";

@Injectable()
export class PublishService implements OnApplicationBootstrap{


  constructor(
    private readonly ebus: EventBus,
    private readonly qbus: QueryBus,
    @Inject("RedisQueue") private readonly redisEventQueue: ClientProxy,
  ) {}


  async onApplicationBootstrap() {
    try {
      await this.redisEventQueue.connect();
    } catch (e) {}


    // setInterval(async () => {
    //   const some = await this.redisEventQueue.emit(
    //     PlayerEnterQueueRequestedEvent.name,
    //     new PlayerEnterQueueRequestedEvent("123", [MatchmakingMode.BOTS_2X2])
    //   ).toPromise();
    // }, 500)

    // events to publish to global
    const publicEvents: Type<any>[] = [
      // QueueCreatedEvent,
      // QueueUpdatedEvent,
      // ReadyStateUpdatedEvent,
      // ReadyCheckStartedEvent,
      // RoomReadyCheckCompleteEvent,
      // RoomReadyEvent,
      // RoomNotReadyEvent,
      //
      // PartyInviteExpiredEvent,
      // PartyInviteCreatedEvent,
      // PartyUpdatedEvent,
      // PartyInviteResultEvent,
      //
      // MatchmakingBannedEvent,
      // LogEvent,
      //
      // EnterQueueDeclinedEvent,
      // EnterRankedQueueDeclinedEvent,
      // PlayerDeclinedGameEvent,
      // PartyQueueStateUpdatedEvent
    ];
    this.ebus
      .pipe(ofType(...publicEvents))
      .subscribe((t) => this.redisEventQueue.emit(t.constructor.name, t));
  }

}
