import { Controller } from "@nestjs/common";
import { EventPattern } from "@nestjs/microservices";
import { PlayerEnterQueueRequestedEvent } from "@/gateway/events/mm/player-enter-queue-requested.event";
import { construct } from "@/gateway/util/construct";
import { EventBus } from "@nestjs/cqrs";

@Controller()
export class MatchmakerController {
  constructor(private readonly ebus: EventBus) {}

  @EventPattern(PlayerEnterQueueRequestedEvent.name)
  public async PlayerEnterQueueRequestedEvent(
    cmd: PlayerEnterQueueRequestedEvent,
  ) {
    await this.ebus.publish(construct(PlayerEnterQueueRequestedEvent, cmd));
  }
}
