import { EventBus, EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { RoomCreatedEvent } from "@/matchmaker/event/room-created.event";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReadyCheckService } from "@/matchmaker/service/ready-check.service";
import { Room } from "@/matchmaker/entity/room";

@EventsHandler(RoomCreatedEvent)
export class RoomCreatedHandler implements IEventHandler<RoomCreatedEvent> {
  constructor(
    private readonly ebus: EventBus,
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly readyCheckService: ReadyCheckService,
  ) {}

  async handle(event: RoomCreatedEvent) {
    const room = await this.roomRepository.findOneOrFail({
      where: {
        id: event.id,
      },
    });
    await this.readyCheckService.startReadyCheck(room);
  }
}
