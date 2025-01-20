import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { PartyInviteRequestedEvent } from "@/gateway/events/party/party-invite-requested.event";
import { PartyService } from "@/matchmaker/service/party.service";

@EventsHandler(PartyInviteRequestedEvent)
export class PartyInviteRequestedHandler
  implements IEventHandler<PartyInviteRequestedEvent>
{
  constructor(private readonly partyService: PartyService) {}

  async handle(event: PartyInviteRequestedEvent) {
    await this.partyService.invitePlayerToParty(
      event.requestedBy,
      event.receiver,
    );
  }
}
