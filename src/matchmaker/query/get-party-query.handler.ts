import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { GetPartyQuery } from "@/gateway/queries/GetParty/get-party.query";
import { Logger } from "@nestjs/common";
import { GetPartyQueryResult } from "@/gateway/queries/GetParty/get-party-query.result";
import { PartyService } from "@/matchmaker/service/party.service";

@QueryHandler(GetPartyQuery)
export class GetPartyHandler
  implements IQueryHandler<GetPartyQuery, GetPartyQueryResult>
{
  private readonly logger = new Logger(GetPartyHandler.name);

  constructor(private readonly partyService: PartyService) {}

  async execute(command: GetPartyQuery): Promise<GetPartyQueryResult> {
    const p = await this.partyService.getOrCreatePartyOf(command.steamId);

    return new GetPartyQueryResult(
      p.id,
      p.leader,
      p.players.map((plr) => plr.steamId),
      p.queueModes,
      p.inQueue,
    );
  }
}
