import { EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { PlayerLeaveQueueRequestedEvent } from "@/gateway/events/mm/player-leave-queue-requested.event";
import { DbMatchmakingQueue } from "@/matchmaker/queue/db-matchmaking.queue";
import { PartyService } from "@/matchmaker/service/party.service";

@EventsHandler(PlayerLeaveQueueRequestedEvent)
export class PlayerLeaveQueueRequestedHandler
  implements IEventHandler<PlayerLeaveQueueRequestedEvent>
{
  constructor(
    private readonly queue: DbMatchmakingQueue,
    private readonly partyService: PartyService,
  ) {}

  async handle(event: PlayerLeaveQueueRequestedEvent) {
    const party = await this.partyService.getOrCreatePartyOf(event.steamId);
    await this.queue.leaveQueue([party], true);
  }
}
