import { Injectable } from "@nestjs/common";
import { ResolvedPlayer } from "@/matchmaker/model/resolved-player";

@Injectable()
export class PlayerService {

  public async resolvePlayer(steamId: string): Promise<ResolvedPlayer> {
    // todo implement queries


    return {
      steamId,
      balanceScore: Math.random() * 10000
    }

  }
}
