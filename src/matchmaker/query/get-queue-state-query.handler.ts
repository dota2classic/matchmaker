import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { Logger } from "@nestjs/common";
import { GetQueueStateQuery } from "@/gateway/queries/QueueState/get-queue-state.query";
import { GetQueueStateQueryResult } from "@/gateway/queries/QueueState/get-queue-state-query.result";
import { DbMatchmakingQueue } from "@/matchmaker/queue/db-matchmaking.queue";

@QueryHandler(GetQueueStateQuery)
export class GetQueueStateHandler
  implements IQueryHandler<GetQueueStateQuery, GetQueueStateQueryResult>
{
  private readonly logger = new Logger(GetQueueStateHandler.name);

  constructor(private readonly q: DbMatchmakingQueue) {}

  async execute(
    command: GetQueueStateQuery,
  ): Promise<GetQueueStateQueryResult> {
    const entries = await this.q.entries();

    return new GetQueueStateQueryResult(
      entries.map((entry) => ({
        partyID: entry.id,
        players: entry.players.map((plr) => plr.steamId),
        modes: entry.queueModes,
      })),
    );
  }
}
