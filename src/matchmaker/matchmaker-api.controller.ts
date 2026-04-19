import { Controller, Get, Param, Post } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { GetUserRoomQuery } from "@/gateway/queries/GetUserRoom/get-user-room.query";
import { GetUserRoomQueryResult } from "@/gateway/queries/GetUserRoom/get-user-room-query.result";
import {
  GetPartyQueryResultDto,
  PlayerRoomDto,
} from "@/matchmaker/dto/matchmaker.dto";
import { GetPartyQuery } from "@/gateway/queries/GetParty/get-party.query";
import { GetPartyQueryResult } from "@/gateway/queries/GetParty/get-party-query.result";
import { ApiTags } from "@nestjs/swagger";
import { PartyService } from "@/matchmaker/service/party.service";

@Controller()
@ApiTags("matchmaker")
export class MatchmakerApiController {
  constructor(
    private readonly qbus: QueryBus,
    private readonly partyService: PartyService,
  ) {}

  @Get("/player/:id/room")
  public async getUserRoom(
    @Param("id") steamId: string,
  ): Promise<PlayerRoomDto> {
    const room = await this.qbus
      .execute<
        GetUserRoomQuery,
        GetUserRoomQueryResult
      >(new GetUserRoomQuery(steamId))
      .then((t) => t?.info);
    return {
      room,
    };
  }

  @Get("/player/:id/party")
  public async getUserParty(
    @Param("id") steamId: string,
  ): Promise<GetPartyQueryResultDto> {
    return await this.qbus.execute<GetPartyQuery, GetPartyQueryResult>(
      new GetPartyQuery(steamId),
    );
  }

  @Post("/party/:leaderId/kick/:targetId")
  public async kickFromParty(
    @Param("leaderId") leaderId: string,
    @Param("targetId") targetId: string,
  ): Promise<void> {
    await this.partyService.kickFromParty(leaderId, targetId);
  }
}
