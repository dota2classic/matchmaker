import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { Logger } from "@nestjs/common";
import { GetPartyInvitationsQuery } from "@/gateway/queries/GetPartyInvitations/get-party-invitations.query";
import { GetPartyInvitationsQueryResult } from "@/gateway/queries/GetPartyInvitations/get-party-invitations-query.result";
import { PartyInvite } from "@/matchmaker/entity/party-invite";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

@QueryHandler(GetPartyInvitationsQuery)
export class GetPartyInvitationsHandler
  implements
    IQueryHandler<GetPartyInvitationsQuery, GetPartyInvitationsQueryResult>
{
  private readonly logger = new Logger(GetPartyInvitationsHandler.name);

  constructor(
    @InjectRepository(PartyInvite)
    private readonly partyInviteRepository: Repository<PartyInvite>,
  ) {}

  async execute({
    steamId,
  }: GetPartyInvitationsQuery): Promise<GetPartyInvitationsQueryResult> {
    const invites = await this.partyInviteRepository.find({
      where: {
        invited: steamId,
      },
    });

    return new GetPartyInvitationsQueryResult(
      steamId,
      invites.map((invite) => invite.toEvent()),
    );
  }
}
