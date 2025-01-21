import { Inject, Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { EventBus, ofType, QueryBus } from "@nestjs/cqrs";
import { PartyInviteCreatedEvent } from "@/gateway/events/party/party-invite-created.event";
import { PartyUpdatedEvent } from "@/gateway/events/party/party-updated.event";
import { PartyInviteExpiredEvent } from "@/gateway/events/party/party-invite-expired.event";
import { QueueUpdatedEvent } from "@/gateway/events/queue-updated.event";
import { ReadyCheckStartedEvent } from "@/gateway/events/ready-check-started.event";
import { ReadyStateUpdatedEvent } from "@/gateway/events/ready-state-updated.event";
import { RoomReadyEvent } from "@/gateway/events/room-ready.event";
import { RoomNotReadyEvent } from "@/gateway/events/room-not-ready.event";
import { PlayerDeclinedGameEvent } from "@/gateway/events/mm/player-declined-game.event";

@Injectable()
export class PublishService implements OnApplicationBootstrap {
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
    const publicEvents: any[] = [
      // QueueCreatedEvent,
      // QueueUpdatedEvent,
      // ReadyStateUpdatedEvent,
      // ReadyCheckStartedEvent,
      // RoomReadyCheckCompleteEvent,
      // RoomReadyEvent,
      // RoomNotReadyEvent,
      //
      PartyInviteExpiredEvent,
      PartyInviteCreatedEvent,
      PartyUpdatedEvent,
      QueueUpdatedEvent,
      ReadyCheckStartedEvent,
      ReadyStateUpdatedEvent,

      RoomReadyEvent,
      RoomNotReadyEvent,
      PlayerDeclinedGameEvent,
      // PartyQueueStateUpdatedEvent
    ];
    this.ebus
      .pipe(ofType(...publicEvents))
      .subscribe((t) => this.redisEventQueue.emit(t.constructor.name, t));
  }
}
