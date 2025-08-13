import { findBestMatchBy } from "@/matchmaker/balance/perms";
import { Party } from "@/matchmaker/entity/party";
import { v4 } from "uuid";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { testUser } from "@/test/useFullModule";
import { FixedTeamSizePredicate } from "@/util/predicates";

describe("permutations", () => {
  const fakeParty = (...users: string[]) => {
    const p = new Party();
    p.id = v4();
    p.players = users.map(
      (usr, idx) => new PlayerInParty(usr, p.id, idx === 0),
    );
    p.enterQueueAt = new Date();

    return p;
  };

  const balanceFunction = (left: Party[], right: Party[]) => {
    const lavg = left.reduce((a, b) => a + b.score, 0) / 5;
    const ravg = right.reduce((a, b) => a + b.score, 0) / 5;
    const avgDiff = Math.abs(lavg - ravg);

    let waitingScore = 0;
    for (let i = 0; i < left.length; i++) {
      waitingScore += Date.now() - left[i].enterQueueAt!.getTime();
    }
    for (let i = 0; i < right.length; i++) {
      waitingScore += Date.now() - right[i].enterQueueAt!.getTime();
    }

    // We want waitingScore to be highest, so we invert it
    waitingScore = Math.log(Math.max(1, waitingScore));
    waitingScore = -waitingScore;

    const comp1 = waitingScore * 100000;

    return comp1 + avgDiff;
  };

  it("should find 1x1", () => {
    const parties = [fakeParty(testUser()), fakeParty(testUser())];
    const m = findBestMatchBy(parties, balanceFunction, 1000, [
      FixedTeamSizePredicate(1),
    ]);

    expect(m).toBeDefined();
  });

  it("should find even balanced game", () => {
    const parties = [
      fakeParty(testUser()),
      fakeParty(testUser()),
      fakeParty(testUser()),
      fakeParty(testUser()),
    ];

    // findBestMatchBy(parties, )
  });
});
