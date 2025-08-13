import { findBestMatchBy } from "@/matchmaker/balance/perms";
import { Party } from "@/matchmaker/entity/party";
import { v4 } from "uuid";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { testUser } from "@/test/useFullModule";
import {
  FixedTeamSizePredicate,
  MaxTeamSizeDifference,
} from "@/util/predicates";

describe("permutations", () => {
  const fakeParty = (score: number, ...users: string[]) => {
    const p = new Party();
    p.id = v4();
    p.players = users.map(
      (usr, idx) => new PlayerInParty(usr, p.id, idx === 0),
    );
    p.enterQueueAt = new Date();
    p.score = score;

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
    const parties = [fakeParty(100, testUser()), fakeParty(100, testUser())];
    const m = findBestMatchBy(parties, balanceFunction, 1000, [
      FixedTeamSizePredicate(1),
    ]);

    expect(m).toBeDefined();
  });

  it("should find even balanced game", () => {
    const parties = [
      fakeParty(9000, testUser()),
      fakeParty(4500, testUser()),
      fakeParty(4500, testUser()),
      fakeParty(1000, testUser()),
    ];

    const m = findBestMatchBy(parties, balanceFunction, 1000, [
      MaxTeamSizeDifference(0),
    ]);
    expect(m).toBeDefined();
    expect(m!.left).toHaveLength(2);
    expect(m!.right).toHaveLength(2);

    expect(balanceFunction(m!.left, m!.right)).toBeLessThan(2000);
  });

  it("should find game from this", () => {
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

    const some = findBestMatchBy(pool, balanceFunction, 5000, [
      FixedTeamSizePredicate(5),
      // MakeMaxScoreDifferencePredicate(maxTeamScoreDifference),
      // MakeMaxPlayerScoreDeviationPredicate(maxPlayerScoreDifference),
      // DodgeListPredicate,
    ]);

    expect(some).toBeDefined();
  });
});
