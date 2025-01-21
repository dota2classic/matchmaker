import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { ReadyStateReceivedEvent } from "@/gateway/events/ready-state-received.event";
import { ReadyCheckService } from "@/matchmaker/service/ready-check.service";

@EventsHandler(ReadyStateReceivedEvent)
export class ReadyStateReceivedHandler
  implements IEventHandler<ReadyStateReceivedEvent>
{
  constructor(private readonly readyCheckService: ReadyCheckService) {}

  async handle(event: ReadyStateReceivedEvent) {
    await this.readyCheckService.submitReadyCheck(
      event.roomId,
      event.steamId,
      event.state,
    );
  }
}
