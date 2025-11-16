import { findBestMatchByAsync, subsetPairs, subsetPairsNew } from "@/matchmaker/balance/perms";
import { Party } from "@/matchmaker/entity/party";
import { fakeParty, testUser } from "@/test/useFullModule";
import {
  DodgeListPredicate,
  FixedTeamSizePredicate,
  LongQueuePopPredicate,
  MakeMaxPlayerScoreDeviationPredicate,
  MakeMaxScoreDifferencePredicate,
  MaxTeamSizeDifference,
} from "@/util/predicates";
import {
  balanceFunctionLogWaitingTime,
  balanceFunctionTakeMost,
} from "@/matchmaker/balance/balance-functions";

describe("permutations", () => {
  jest.setTimeout(30_000);
  // it("should find all possible combinations", () => {
  //   const parties = [1,2,3,4,5,6,7,8,9,10];
  //   const combos = Array.from(subsetPairs(parties));
  //   console.log(combos.filter(t => t[0].length === 5 && t[1].length === 5));
  // });

  it("should find 1x1", async () => {
    const parties = [fakeParty(100), fakeParty(100)];
    const m = await findBestMatchByAsync(
      parties,
      balanceFunctionLogWaitingTime,
      1000,
      [FixedTeamSizePredicate(1)],
    );

    expect(m).toBeDefined();
  });

  it("should find even balanced game while taking as much players as possible", async () => {
    const parties = [
      fakeParty(9000),
      fakeParty(4500),
      fakeParty(4500),
      fakeParty(1000),
    ];

    const m = await findBestMatchByAsync(
      parties,
      balanceFunctionTakeMost,
      1000,
      [MaxTeamSizeDifference(0)],
    );
    expect(m).toBeDefined();
    expect(m!.left).toHaveLength(2);
    expect(m!.right).toHaveLength(2);

    expect(balanceFunctionLogWaitingTime(m!.left, m!.right)).toBeLessThan(2000);
  });

  it("should find game from this", async () => {
    const pool: Party[] = [
      {
        score: 3424.7987098068907,
        id: "4c65c15b-58f4-4857-b9c0-716081eca763",
        enterQueueAt: new Date("2025-08-13T16:40:21.578Z"),
        queueModes: [1],
        dodgeList: [],
        inQueue: true,
        players: [
          {
            steamId: "898733034",
            partyId: "4c65c15b-58f4-4857-b9c0-716081eca763",
            isLeader: true,
            score: 3424.7987098068907,
          },
        ],
      },
      {
        score: 477.59983719997524,
        id: "54945e61-f33b-4e39-b611-b0a00083a477",
        enterQueueAt: new Date("2025-08-13T16:34:52.212Z"),
        queueModes: [1],
        dodgeList: [],
        inQueue: true,
        players: [
          {
            steamId: "1281242640",
            partyId: "54945e61-f33b-4e39-b611-b0a00083a477",
            isLeader: true,
            score: 477.59983719997524,
          },
        ],
      },
      {
        score: 4486.799999999962,
        id: "5d7fd768-e92b-4a0b-88df-ad3aad1673ef",
        enterQueueAt: new Date("2025-08-13T16:02:30.818Z"),
        queueModes: [1],
        dodgeList: ["1770781994"],
        inQueue: true,
        players: [
          {
            steamId: "466056687",
            partyId: "5d7fd768-e92b-4a0b-88df-ad3aad1673ef",
            isLeader: true,
            score: 4486.799999999962,
          },
        ],
      },
      {
        score: 2663.9998993816253,
        id: "764c4784-d3f5-4ad7-80e2-1d62e15197a2",
        enterQueueAt: new Date("2025-08-13T16:39:48.457Z"),
        queueModes: [1],
        dodgeList: [],
        inQueue: true,
        players: [
          {
            steamId: "148928588",
            partyId: "764c4784-d3f5-4ad7-80e2-1d62e15197a2",
            isLeader: true,
            score: 2663.9998993816253,
          },
        ],
      },
      {
        score: 2931.5999994998992,
        id: "a63d3096-e5e7-45d9-a40e-cd82e041cabd",
        enterQueueAt: new Date("2025-08-13T16:13:16.874Z"),
        queueModes: [1],
        dodgeList: [],
        inQueue: true,
        players: [
          {
            steamId: "453732964",
            partyId: "a63d3096-e5e7-45d9-a40e-cd82e041cabd",
            isLeader: true,
            score: 2931.5999994998992,
          },
        ],
      },
      {
        score: 1692.8536230435473,
        id: "aa1b06ae-8271-4c60-ac19-c29d42be03eb",
        enterQueueAt: new Date("2025-08-13T16:39:22.888Z"),
        queueModes: [1],
        dodgeList: [],
        inQueue: true,
        players: [
          {
            steamId: "983126592",
            partyId: "aa1b06ae-8271-4c60-ac19-c29d42be03eb",
            isLeader: true,
            score: 1692.8536230435473,
          },
        ],
      },
      {
        score: 3128.3999999988027,
        id: "b35bd2af-5286-4433-a9cb-7b5ba8e7266a",
        enterQueueAt: new Date("2025-08-13T16:37:11.781Z"),
        queueModes: [1],
        dodgeList: [],
        inQueue: true,
        players: [
          {
            steamId: "1909916096",
            partyId: "b35bd2af-5286-4433-a9cb-7b5ba8e7266a",
            isLeader: true,
            score: 3128.3999999988027,
          },
        ],
      },
      {
        score: 955.1970615033874,
        id: "bc2668e2-b5a2-4ab6-bc09-6e44755c9bc3",
        enterQueueAt: new Date("2025-08-13T16:04:53.065Z"),
        queueModes: [1],
        dodgeList: [],
        inQueue: true,
        players: [
          {
            steamId: "1214594937",
            partyId: "bc2668e2-b5a2-4ab6-bc09-6e44755c9bc3",
            isLeader: true,
            score: 955.1970615033874,
          },
        ],
      },
      {
        score: 1799.979682755114,
        id: "c22d0875-2ba8-464e-931a-02931804cdf6",
        enterQueueAt: new Date("2025-08-13T16:39:32.179Z"),
        queueModes: [1, 13],
        dodgeList: [],
        inQueue: true,
        players: [
          {
            steamId: "113013123",
            partyId: "c22d0875-2ba8-464e-931a-02931804cdf6",
            isLeader: true,
            score: 1799.979682755114,
          },
        ],
      },
      {
        score: 8836.340167522028,
        id: "d2b2225c-80ec-493a-a6e4-ce4215b4b9d6",
        enterQueueAt: new Date("2025-08-13T15:56:12.077Z"),
        queueModes: [1],
        dodgeList: ["898733034"],
        inQueue: true,
        players: [
          {
            steamId: "110305574",
            partyId: "d2b2225c-80ec-493a-a6e4-ce4215b4b9d6",
            isLeader: false,
            score: 4249.199999999996,
          },
          {
            steamId: "1866881321",
            partyId: "d2b2225c-80ec-493a-a6e4-ce4215b4b9d6",
            isLeader: false,
            score: 1644.740167522185,
          },
          {
            steamId: "284405760",
            partyId: "d2b2225c-80ec-493a-a6e4-ce4215b4b9d6",
            isLeader: true,
            score: 2942.3999999998473,
          },
        ],
      },
      {
        score: 3064.7999529369313,
        id: "ec65797e-de46-4450-a2cd-8b38d528a733",
        enterQueueAt: new Date("2025-08-13T16:38:46.838Z"),
        queueModes: [1],
        dodgeList: [],
        inQueue: true,
        players: [
          {
            steamId: "209126924",
            partyId: "ec65797e-de46-4450-a2cd-8b38d528a733",
            isLeader: true,
            score: 3064.7999529369313,
          },
        ],
      },
      {
        score: 892.4403683883622,
        id: "ff48e195-274e-41ba-81d2-8b1a62189546",
        enterQueueAt: new Date("2025-08-13T16:38:27.279Z"),
        queueModes: [1],
        dodgeList: [],
        inQueue: true,
        players: [
          {
            steamId: "1805056203",
            partyId: "ff48e195-274e-41ba-81d2-8b1a62189546",
            isLeader: true,
            score: 892.4403683883622,
          },
        ],
      },
    ].map((t) => {
      // @ts-ignore
      t.__proto__ = Party.prototype;
      return t;
    }) as any;

    const some = await findBestMatchByAsync(
      pool,
      balanceFunctionLogWaitingTime,
      20000,
      [
        FixedTeamSizePredicate(5),
        MakeMaxScoreDifferencePredicate(100000),
        MakeMaxPlayerScoreDeviationPredicate(100000),
        LongQueuePopPredicate(pool, 1000 * 60 * 20), // At most 20 minutes
        DodgeListPredicate,
      ],
    );

    expect(some).toBeDefined();
  });

  it("should use workers", async () => {
    const parties = [fakeParty(100), fakeParty(100)];
    const m = await findBestMatchByAsync(
      parties,
      balanceFunctionLogWaitingTime,
      1000,
      [FixedTeamSizePredicate(1)],
    );

    expect(m).toBeDefined();
  });
});

describe("matchmaking party combinations", ()=> {
  type GeneratorResult = [Party[], Party[]][]

  function generateRandomTestParties (): Party[] {
    const result: Party[] = [];

    // Better not set amounts more than 5 or 7 because of old function bad performance.
    // Depends on processor power.
    for (let i = 0; i < 15; i++) {
      const players: string[] = [];
      const playersAmount: number = Math.round(1 + (Math.random() * 4));

      for (let i = 0; i < playersAmount; i++) {
        players.push(testUser());
      }

      result.push(fakeParty(Math.round(50 + (Math.random() * 1500)), players));
    }

    return result;
  }

  function generateTestParties (partiesAmount: number, playersAmount: number): Party[] {
    const result: Party[] = [];

    for (let i = 0; i < partiesAmount; i++) {
      const players: string[] = [];

      for (let i = 0; i < playersAmount; i++) {
        players.push(testUser());
      }

      result.push(fakeParty(Math.round(50 + (Math.random() * 1500)), players));
    }

    return result;
  }

  function partiesLength(parties: Party[]): number {
    let l: number = 0;

    for (const p of parties) {
      l = l + p.players.length;
    }

    return l;
  }

  function* subsetPairsOld(parties: Party[]): Generator<[Party[], Party[]]> {
    for (const [p1, p2] of subsetPairs(parties)) {
      if (partiesLength(p1) != 5 || partiesLength(p2) != 5) {
        continue;
      }
      yield [p1, p2];
    }
  }

  function isEqualResults(res1: GeneratorResult, res2 :GeneratorResult): boolean {
    res1.sort();
    res2.sort();

    const s1 = JSON.stringify(res1);
    const s2 = JSON.stringify(res2);

    return s1 === s2;
  }

  it("different data and result", async () => {
    const testParties1 = generateRandomTestParties();
    const testParties2 = generateRandomTestParties();

    const oldResults: GeneratorResult = [];
    const newResults: GeneratorResult = [];

    for (const res of subsetPairsOld(testParties1)) {
      oldResults.push(res);
    }

    for (const res of subsetPairsNew(testParties2)) {
      newResults.push(res);
    }

    expect(isEqualResults(oldResults, newResults)).toEqual(false);
  }, 30_000);

  it("similar data and result", async () => {
    const testParties = generateRandomTestParties();

    const oldResults: GeneratorResult = [];
    const newResults: GeneratorResult = [];

    for (const res of subsetPairsOld(testParties)) {
      oldResults.push(res);
    }

    for (const res of subsetPairsNew(testParties)) {
      newResults.push(res);
    }

    expect(isEqualResults(oldResults, newResults)).toEqual(true)
  }, 30_000);

  it("unavailable combinations", async () => {
    const tests = [
        generateTestParties(4, 3),
        generateTestParties(0, 0),
        generateTestParties(10, 25),
        generateTestParties(1, 5),
        generateTestParties(2, 4),
      ];

      for (const test of tests) {
        const result: GeneratorResult = [];

        for (const res of subsetPairsNew(test)) {
          result.push(res);
        }

        expect(result).toHaveLength(0)
      }
  }, 30_000);
})