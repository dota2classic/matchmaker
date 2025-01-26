import { EventBus, EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { RoomCreatedEvent } from "@/matchmaker/event/room-created.event";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReadyCheckService } from "@/matchmaker/service/ready-check.service";
import { Room } from "@/matchmaker/entity/room";
import { MetricsService } from "@/metrics/metrics.service";
import { MatchmakingMode } from "@/gateway/shared-types/matchmaking-mode";
import { GameBalance } from "@/matchmaker/balance/game-balance";
import { Logger, Optional } from "@nestjs/common";

@EventsHandler(RoomCreatedEvent)
export class RoomCreatedHandler implements IEventHandler<RoomCreatedEvent> {
  private logger = new Logger(RoomCreatedHandler.name);

  constructor(
    private readonly ebus: EventBus,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly readyCheckService: ReadyCheckService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async handle(event: RoomCreatedEvent) {
    const room = await this.roomRepository.findOne({
      where: {
        id: event.id,
      },
    });
    if (!room) return;
    this.logger.log("Room created", room);
    this.doMetrics(room, event.balance);
    await this.readyCheckService.startReadyCheck(room);
  }

  private doMetrics(room: Room, event: GameBalance) {
    if (!this.metrics) return;
    if (room.lobbyType !== MatchmakingMode.UNRANKED) return;
    const leftMMR = event.left.reduce((a, b) => a + b.score, 0);
    const rightMMR = event.right.reduce((a, b) => a + b.score, 0);
    const diff = Math.abs(leftMMR - rightMMR);
    this.logger.log("Room balance mmr difference: ", {
      diff,
      leftMMR,
      rightMMR,
    });
    this.metrics.recordAvgDifference(room.lobbyType, diff);
  }
}
