import { Controller } from "@nestjs/common";
import { EventPattern, MessagePattern } from "@nestjs/microservices";
import { PlayerEnterQueueRequestedEvent } from "@/gateway/events/mm/player-enter-queue-requested.event";
import { construct } from "@/gateway/util/construct";
import { EventBus, QueryBus } from "@nestjs/cqrs";
import { GetPartyQueryResult } from "@/gateway/queries/GetParty/get-party-query.result";
import { GetPartyQuery } from "@/gateway/queries/GetParty/get-party.query";
import { GetUserRoomQueryResult } from "@/gateway/queries/GetUserRoom/get-user-room-query.result";
import { GetUserRoomQuery } from "@/gateway/queries/GetUserRoom/get-user-room.query";
import { GetPartyInvitationsQueryResult } from "@/gateway/queries/GetPartyInvitations/get-party-invitations-query.result";
import { GetPartyInvitationsQuery } from "@/gateway/queries/GetPartyInvitations/get-party-invitations.query";

@Controller()
export class MatchmakerController {
  constructor(
    private readonly ebus: EventBus,
    private readonly qbus: QueryBus,
  ) {}

  @EventPattern(PlayerEnterQueueRequestedEvent.name)
  public async PlayerEnterQueueRequestedEvent(
    cmd: PlayerEnterQueueRequestedEvent,
  ) {
    await this.ebus.publish(construct(PlayerEnterQueueRequestedEvent, cmd));
  }

  @MessagePattern(GetPartyQuery.name)
  async GetPartyQuery(query: GetPartyQuery): Promise<GetPartyQueryResult> {
    return this.qbus.execute(construct(GetPartyQuery, query));
  }

  @MessagePattern(GetUserRoomQuery.name)
  async GetUserRoomQuery(
    query: GetUserRoomQuery,
  ): Promise<GetUserRoomQueryResult> {
    return this.qbus.execute(construct(GetUserRoomQuery, query));
  }

  @MessagePattern(GetPartyInvitationsQuery.name)
  async GetPartyInvitationsQuery(
    query: GetPartyInvitationsQuery,
  ): Promise<GetPartyInvitationsQueryResult> {
    return this.qbus.execute(construct(GetPartyInvitationsQuery, query));
  }
}
