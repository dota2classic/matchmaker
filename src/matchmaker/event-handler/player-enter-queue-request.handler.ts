import { EventBus, EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { PlayerEnterQueueRequestedEvent } from "@/gateway/events/mm/player-enter-queue-requested.event";
import { PartyService } from "@/matchmaker/service/party.service";

@EventsHandler(PlayerEnterQueueRequestedEvent)
export class PlayerEnterQueueRequestedHandler
  implements IEventHandler<PlayerEnterQueueRequestedEvent>
{
  constructor(
    private readonly ebus: EventBus,
    private readonly partyService: PartyService,
    // @InjectRepository(Party)
    // private readonly partyRepository: Repository<Party>,
  ) {}

  async handle(event: PlayerEnterQueueRequestedEvent) {
    const party = await this.partyService.getOrCreatePartyOf(event.id);
    // Check if party good
  }
}
