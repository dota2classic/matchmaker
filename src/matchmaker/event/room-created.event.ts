import { GameBalance } from "@/matchmaker/balance/game-balance";

export class RoomCreatedEvent {
  constructor(
    public readonly id: string,
    public readonly balance: GameBalance,
  ) {}
}
