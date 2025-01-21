import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { PartyInviteAcceptedEvent } from "@/gateway/events/party/party-invite-accepted.event";
import { PartyService } from "@/matchmaker/service/party.service";

@EventsHandler(PartyInviteAcceptedEvent)
export class PartyInviteAcceptedHandler
  implements IEventHandler<PartyInviteAcceptedEvent>
{
  constructor(private readonly partyService: PartyService) {}

  async handle(event: PartyInviteAcceptedEvent) {
    if (event.accept) {
      await this.partyService.acceptInvite(event.inviteId);
    } else {
      await this.partyService.declineInvite(event.inviteId);
    }
  }
}
