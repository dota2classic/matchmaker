import { EventBus, EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { PlayerEnterQueueRequestedEvent } from "@/gateway/events/mm/player-enter-queue-requested.event";
import { PartyService } from "@/matchmaker/service/party.service";
import { DbMatchmakingQueue } from "@/matchmaker/queue/db-matchmaking.queue";

@EventsHandler(PlayerEnterQueueRequestedEvent)
export class PlayerEnterQueueRequestedHandler
  implements IEventHandler<PlayerEnterQueueRequestedEvent>
{
  constructor(
    private readonly ebus: EventBus,
    private readonly partyService: PartyService,
    private readonly queue: DbMatchmakingQueue,
  ) {}

  async handle(event: PlayerEnterQueueRequestedEvent) {
    const party = await this.partyService.getOrCreatePartyOf(event.id);
    // We can enter queue if
    await this.queue.enterQueue(party, event.modes, true);
  }
}
