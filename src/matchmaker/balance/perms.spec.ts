import { findBestMatchBy } from "@/matchmaker/balance/perms";
import { Party } from "@/matchmaker/entity/party";
import { v4 } from "uuid";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { testUser } from "@/test/useFullModule";

describe("permutations", () => {
  const fakeParty = (...users: string[]) => {
    const p = new Party();
    p.id = v4();
    p.players = users.map(
      (usr, idx) => new PlayerInParty(usr, p.id, 123, idx === 0),
    );

    return p;
  };

  const balanceFunction = (left: Party[], right: Party[]) => {
    const lavg = left.reduce((a, b) => a + b.score, 0) / 5;
    const ravg = right.reduce((a, b) => a + b.score, 0) / 5;
    const avgDiff = Math.abs(lavg - ravg);

    let waitingScore = 0;
    for (let i = 0; i < left.length; i++) {
      waitingScore += left[i].waitingScore;
    }
    for (let i = 0; i < right.length; i++) {
      waitingScore += right[i].waitingScore;
    }

    // We want waitingScore to be highest, so we invert it
    waitingScore = Math.log(Math.max(1, waitingScore));
    waitingScore = -waitingScore;

    const comp1 = waitingScore * 100000;

    return comp1 + avgDiff;
  }


  it("should find 1x1", () => {
    const parties = [
      fakeParty(testUser()),
      fakeParty(testUser()),
    ]
    const m = findBestMatchBy(
      parties,
      1,
      balanceFunction,
      1000
    );

    expect(m).toBeDefined()
  });
});
