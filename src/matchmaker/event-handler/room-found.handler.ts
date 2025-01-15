import { EventBus, EventsHandler, IEventHandler } from "@nestjs/cqrs";
import { RoomFoundEvent } from "@/matchmaker/event/room-found.event";
import { ReadyCheckStartedEvent } from "@/gateway/events/ready-check-started.event";
import { InjectRepository } from "@nestjs/typeorm";
import { PlayerInRoom } from "@/matchmaker/entity/player-in-room";
import { Repository } from "typeorm";

@EventsHandler(RoomFoundEvent)
export class RoomFoundHandler implements IEventHandler<RoomFoundEvent> {
  constructor(
    private readonly ebus: EventBus,
    @InjectRepository(PlayerInRoom)
    private readonly partyInRoomRepository: Repository<PlayerInRoom>,
  ) {}

  async handle(event: RoomFoundEvent) {
    const pirs = await this.partyInRoomRepository.find({
      where: {
        roomId: event.id,
      },
      relations: ["party", "party.players"]
    });

    this.ebus.publish(
      new ReadyCheckStartedEvent(event.id, event.balance.mode, [], {
        total: 0,
        accepted: 0,
      }),
    );
  }
}
