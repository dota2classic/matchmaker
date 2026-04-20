import {
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from "@golevelup/nestjs-rabbitmq";
import { Controller, Logger } from "@nestjs/common";
import { ReturnGoodPlayersToQueueEvent } from "@/gateway/events/mm/return-good-players-to-queue.event";
import { PartyService } from "@/matchmaker/service/party.service";

@Controller()
export class RmqController {
  private readonly logger = new Logger(RmqController.name);

  constructor(private readonly partyService: PartyService) {}

  @RabbitSubscribe({
    exchange: "app.events",
    routingKey: ReturnGoodPlayersToQueueEvent.name,
    queue: `matchmaker-queue.${ReturnGoodPlayersToQueueEvent.name}`,
    errorBehavior: MessageHandlerErrorBehavior.ACK,
  })
  async ReturnGoodPlayersToQueueEvent(data: ReturnGoodPlayersToQueueEvent) {
    this.logger.log("ReturnGoodPlayersToQueueEvent", data);
    await this.partyService.returnGoodPlayersToQueues(data.steamIds);
  }
}
