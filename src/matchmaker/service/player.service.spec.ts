import { PlayerService } from "@/matchmaker/service/player.service";

describe("PlayerService", () => {
  it("should ", async () => {
    // RX
    const RX = PlayerService.getPlayerScore(4600, 0, 681);

    const V = PlayerService.getPlayerScore(3315, 0, 940);

    const Professor = PlayerService.getPlayerScore(3072, 0, 464);

    const lennySmurf = PlayerService.getPlayerScore(2997, 0, 51);

    const torbasow = PlayerService.getPlayerScore(2827, 0, 1513);

    const randomNoobik = PlayerService.getPlayerScore(2255, 0, 109);

    const kiyotaka = PlayerService.getPlayerScore(1649, 0, 134);

    console.log({
      RX,
      torbasow,
      V,
      Professor,
      lennySmurf,
      randomNoobik,
      kiyotaka,
    });
  });
});
