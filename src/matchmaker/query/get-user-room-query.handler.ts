import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { Logger } from "@nestjs/common";
import { GetUserRoomQuery } from "@/gateway/queries/GetUserRoom/get-user-room.query";
import {
  GetUserRoomQueryResult,
  GetUserRoomQueryResultRoomInfo,
} from "@/gateway/queries/GetUserRoom/get-user-room-query.result";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RoomService } from "@/matchmaker/service/room.service";
import { ReadyState } from "@/gateway/events/ready-state-received.event";

@QueryHandler(GetUserRoomQuery)
export class GetUserRoomHandler
  implements IQueryHandler<GetUserRoomQuery, GetUserRoomQueryResult>
{
  private readonly logger = new Logger(GetUserRoomHandler.name);

  constructor(
    @InjectRepository(PlayerInRoom)
    private readonly pirRepo: Repository<PlayerInRoom>,
    private readonly roomService: RoomService,
  ) {}

  async execute(query: GetUserRoomQuery): Promise<GetUserRoomQueryResult> {
    const room = await this.roomService.findRoomOf(query.steamId);

    if (!room) return new GetUserRoomQueryResult();

    const iAccepted =
      room.players.find((t) => t.steamId === query.steamId)?.readyState ===
      ReadyState.READY;

    return new GetUserRoomQueryResult(
      new GetUserRoomQueryResultRoomInfo(
        query.steamId,
        room.id,
        room.lobbyType,
        iAccepted,
        room.players.map((plr) => ({
          readyState: plr.readyState,
          steamId: plr.steamId,
        })),
      ),
    );
  }
}
