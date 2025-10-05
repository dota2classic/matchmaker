import { fakeParty, testUser } from "@/test/useFullModule";
import { range } from "@/util/range";
import { findBestMatchBy } from "@/matchmaker/balance/perms";
import {
  balanceFunctionLogWaitingTime,
  balanceFunctionMultWaitingTime,
  balanceFunctionTakeMost,
} from "@/matchmaker/balance/balance-functions";
import { BalanceFunctionType } from "@/matchmaker/balance/balance-function-type";
import {
  FixedTeamSizePredicate,
  MakeMaxScoreDifferencePredicate,
} from "@/util/predicates";
import { Party } from "@/matchmaker/entity/party";

describe("balance functions", () => {
  const allEvenSingles = range(10).map(() => fakeParty(1000));

  const uneven = [fakeParty(1000), fakeParty(2000), fakeParty(10000)];

  const edgeCaseWithLongWaiting: Party[] = [
    fakeParty(3000, [testUser()], new Date(Date.now() - 1000 * 60 * 20)),
    fakeParty(1000),
    fakeParty(1000),
  ];

  describe(BalanceFunctionType.OPTIMIZE_PLAYER_COUNT, () => {
    it("should get as much players as possible", () => {
      const res = findBestMatchBy(
        allEvenSingles,
        balanceFunctionTakeMost,
        5000,
      );

      expect(res).toBeDefined();
      expect(res!.left.length).toEqual(5);
      expect(res!.right.length).toEqual(5);
    });

    it("should prioritize getting more players over balance", () => {
      const res = findBestMatchBy(uneven, balanceFunctionTakeMost, 5000);

      expect(res).toBeDefined();
      const [smaller, bigger] = [res!.left, res!.right].sort(
        (a, b) => a.length - b.length,
      );
      // console.log(res)
      expect(smaller.map((t) => t.score).sort()).toEqual([10000]);
      expect(bigger.map((t) => t.score).sort()).toEqual([1000, 2000]);
    });

    it("should still put longest waiting first", () => {
      const res = findBestMatchBy(
        edgeCaseWithLongWaiting,
        balanceFunctionTakeMost,
        5000,
        [FixedTeamSizePredicate(1)],
      );
      expect(res).toBeDefined();

      expect(
        res!.left.concat(res!.right).find((t) => t.score === 3000),
      ).toBeDefined();
    });
  });

  describe(BalanceFunctionType.MULT_WAITING_SCORE, () => {
    it("should get a balanced match", () => {
      const res = findBestMatchBy(
        allEvenSingles,
        balanceFunctionLogWaitingTime,
        1000,
        [FixedTeamSizePredicate(5)],
      );

      expect(res).toBeDefined();
      expect(res!.left.length).toEqual(5);
      expect(res!.right.length).toEqual(5);
    });

    it("should provide most balanced game", () => {
      const res = findBestMatchBy(uneven, balanceFunctionLogWaitingTime, 5000, [
        MakeMaxScoreDifferencePredicate(5000),
      ]);

      expect(res).toBeDefined();
      const [smaller, bigger] = [res!.left, res!.right].sort(
        (a, b) => a[0].score - b[0].score,
      );

      expect(smaller.map((t) => t.score).sort()).toEqual([1000]);
      expect(bigger.map((t) => t.score).sort()).toEqual([2000]);
    });

    it("should push long waiting parties", () => {
      const res = findBestMatchBy(
        edgeCaseWithLongWaiting,
        balanceFunctionLogWaitingTime,
        5000,
        [FixedTeamSizePredicate(1)],
      );

      expect(res).toBeDefined();
      const [smaller, bigger] = [res!.left, res!.right].sort(
        (a, b) => a[0].score - b[0].score,
      );
      expect(smaller.map((t) => t.score).sort()).toEqual([1000]);
      expect(bigger.map((t) => t.score).sort()).toEqual([3000]);
    });
  });

  describe(BalanceFunctionType.LOG_WAITING_SCORE, () => {
    it("should get a balanced match", () => {
      const res = findBestMatchBy(
        allEvenSingles,
        balanceFunctionLogWaitingTime,
        1000,
        [FixedTeamSizePredicate(5)],
      );

      expect(res).toBeDefined();
      expect(res!.left.length).toEqual(5);
      expect(res!.right.length).toEqual(5);
    });

    it("should provide most balanced game", () => {
      const res = findBestMatchBy(uneven, balanceFunctionLogWaitingTime, 5000, [
        MakeMaxScoreDifferencePredicate(5000),
      ]);

      expect(res).toBeDefined();
      const [smaller, bigger] = [res!.left, res!.right].sort(
        (a, b) => a[0].score - b[0].score,
      );

      expect(smaller.map((t) => t.score).sort()).toEqual([1000]);
      expect(bigger.map((t) => t.score).sort()).toEqual([2000]);
    });

    it("should push long waiting parties", () => {
      const res = findBestMatchBy(
        edgeCaseWithLongWaiting,
        balanceFunctionLogWaitingTime,
        5000,
        [FixedTeamSizePredicate(1)],
      );

      expect(res).toBeDefined();
      const [smaller, bigger] = [res!.left, res!.right].sort(
        (a, b) => a[0].score - b[0].score,
      );
      expect(smaller.map((t) => t.score).sort()).toEqual([1000]);
      expect(bigger.map((t) => t.score).sort()).toEqual([3000]);
    });
  });

  it("comparison", () => {
    const pair1 = [[edgeCaseWithLongWaiting[0]], [edgeCaseWithLongWaiting[1]]];

    const pair2 = [[edgeCaseWithLongWaiting[2]], [edgeCaseWithLongWaiting[1]]];

    {
      const [left, right] = pair1;
      const score1 = balanceFunctionMultWaitingTime(left, right);
      const score2 = balanceFunctionLogWaitingTime(left, right);
      console.log("Long waiting:", score1, score2);
    }

    {
      const [left, right] = pair2;
      const score1 = balanceFunctionMultWaitingTime(left, right);
      const score2 = balanceFunctionLogWaitingTime(left, right);
      console.log("Casual waiting:", score1, score2);
    }
  });
});
