import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { PartyLeaveRequestedEvent } from "@/gateway/events/party/party-leave-requested.event";
import { PartyService } from "@/matchmaker/service/party.service";

@EventsHandler(PartyLeaveRequestedEvent)
export class PartyLeaveRequestedHandler
  implements IEventHandler<PartyLeaveRequestedEvent>
{
  constructor(private readonly partyService: PartyService) {}

  async handle(event: PartyLeaveRequestedEvent) {
    await this.partyService.leaveCurrentParty(event.steamId, true);
  }
}
