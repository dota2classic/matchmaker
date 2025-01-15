import { GameBalance } from "@/matchmaker/balance/game-balance";

export class RoomFoundEvent {
  constructor(
    public readonly id: string,
    public readonly balance: GameBalance,
  ) {}
}
