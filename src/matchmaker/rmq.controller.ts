import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { CommandBus, EventBus } from "@nestjs/cqrs";
import { Controller, Logger } from "@nestjs/common";
import { MatchFailedEvent } from "@/gateway/events/match-failed.event";
import { DbMatchmakingQueue } from "@/matchmaker/queue/db-matchmaking.queue";
import { PartyService } from "@/matchmaker/service/party.service";

@Controller()
export class RmqController {
  private readonly logger = new Logger(RmqController.name);

  constructor(
    private readonly cbus: CommandBus,
    private readonly config: ConfigService,
    private readonly ebus: EventBus,
    private readonly queue: DbMatchmakingQueue,
    private readonly partyService: PartyService,
  ) {}

  @RabbitSubscribe({
    exchange: "app.events",
    routingKey: MatchFailedEvent.name,
    queue: `matchmaker-queue.${MatchFailedEvent.name}`,
    errorBehavior: MessageHandlerErrorBehavior.ACK, // its not that important
  })
  async MatchFailedEvent(data: MatchFailedEvent) {
    this.logger.log("MatchFailedEvent", data);
    const jobs = data.goodParties.map(async (partyId) => {
      const party = await this.partyService.getParty(partyId);
      if (party) {
        await this.queue.enterQueue(party);
      }
    });
    await Promise.all(jobs);
  }
}
