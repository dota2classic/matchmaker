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
import { GetQueueStateQueryResult } from "@/gateway/queries/QueueState/get-queue-state-query.result";
import { GetQueueStateQuery } from "@/gateway/queries/QueueState/get-queue-state.query";
import { PlayerLeaveQueueRequestedEvent } from "@/gateway/events/mm/player-leave-queue-requested.event";
import { PartyInviteRequestedEvent } from "@/gateway/events/party/party-invite-requested.event";
import { PartyInviteAcceptedEvent } from "@/gateway/events/party/party-invite-accepted.event";
import { PartyLeaveRequestedEvent } from "@/gateway/events/party/party-leave-requested.event";
import { ReadyStateReceivedEvent } from "@/gateway/events/ready-state-received.event";

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

  @EventPattern(PartyInviteRequestedEvent.name)
  public async PartyInviteRequestedEvent(cmd: PartyInviteRequestedEvent) {
    await this.ebus.publish(construct(PartyInviteRequestedEvent, cmd));
  }

  @EventPattern(PartyInviteAcceptedEvent.name)
  public async PartyInviteAcceptedEvent(cmd: PartyInviteAcceptedEvent) {
    await this.ebus.publish(construct(PartyInviteAcceptedEvent, cmd));
  }

  @EventPattern(PartyLeaveRequestedEvent.name)
  public async PartyLeaveRequestedEvent(cmd: PartyLeaveRequestedEvent) {
    await this.ebus.publish(construct(PartyLeaveRequestedEvent, cmd));
  }

  @EventPattern(PlayerLeaveQueueRequestedEvent.name)
  public async PlayerLeaveQueueRequestedEvent(
    cmd: PlayerLeaveQueueRequestedEvent,
  ) {
    await this.ebus.publish(construct(PlayerLeaveQueueRequestedEvent, cmd));
  }

  @EventPattern(ReadyStateReceivedEvent.name)
  public async ReadyStateReceivedEvent(cmd: ReadyStateReceivedEvent) {
    await this.ebus.publish(construct(ReadyStateReceivedEvent, cmd));
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

  @MessagePattern(GetQueueStateQuery.name)
  async GetQueueStateQuery(
    query: GetQueueStateQuery,
  ): Promise<GetQueueStateQueryResult> {
    return this.qbus.execute(construct(GetQueueStateQuery, query));
  }
}
