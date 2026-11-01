import { compareMirror, MirrorInput, MirrorParty } from "./mirror-shadow";

// Anonymized historical 5v5 composition; scores are actual queue snapshots.
export function mirrorFixture(): MirrorInput {
  const values = [
    [1945, 131, 2333.999204406914],
    [1496, 741, 1744.9399008320702],
    [1493, 856, 1791.5998767006633],
    [1289, 116, 1546.797637004241],
    [889, 193, 1066.799999262014],
    [4191, 368, 5029.199989548272],
    [1134, 6, 1280.4348502520104],
    [968, 238, 1161.599999991073],
    [752, 5, 845.6178834127589],
    [221, 16, 257.77521262291947],
  ];
  const parties: MirrorParty[] = values.map(([mmr, pvpGames, score], i) => ({
    id: `party-${i}`,
    score,
    enteredAt: "2026-11-01T00:00:00.000Z",
    dodgeList: [],
    players: [
      {
        id: `player-${i}`,
        score,
        mmr,
        pvpGames,
        statsAt: "2026-11-01T00:00:00.000Z",
      },
    ],
  }));
  return {
    version: "mirror-shadow-v1",
    scope: "selected-ten",
    capturedAt: "2026-11-01T00:01:00.000Z",
    leftPartyIds: parties.slice(0, 5).map((p) => p.id),
    rightPartyIds: parties.slice(5).map((p) => p.id),
    parties,
    maxTeamScoreDifference: 3500,
    maxPlayerScoreDifference: 5500,
    balanceFunction: "LOG_WAITING_SCORE",
  };
}

describe("selected-ten mirror shadow", () => {
  it("refuses to silently reinterpret an unknown snapshot version", () => {
    const input = mirrorFixture();
    expect(
      compareMirror({ ...input, version: "future" } as unknown as MirrorInput),
    ).toMatchObject({
      status: "invalid_input",
      reason: "unsupported_version_or_scope",
    });
  });
  it("separates two novices within both budgets and does not change its input", () => {
    const input = mirrorFixture();
    const before = JSON.stringify(input);
    const result = compareMirror(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(result.status).toBe("compared");
    expect(result.candidatesEvaluated).toBe(126);
    expect(result.baseline!.metrics.newPlayerGap).toBe(2);
    for (const v of result.variants!) {
      expect(v.metrics.newPlayerGap).toBe(0);
      expect(v.metrics.scoreGap).toBeLessThanOrEqual(v.budget);
      expect(v.changed).toBe(true);
      expect(v.improvedPlayers + v.worsenedPlayers).toBeLessThanOrEqual(10);
      const ids = v.leftPartyIds.concat(v.rightPartyIds);
      expect(new Set(ids).size).toBe(10);
    }
  });

  it("keeps a novice duo together even when mirroring would improve experience", () => {
    const input = mirrorFixture();
    const a = input.parties[6],
      b = input.parties[8];
    input.parties = input.parties.filter((p) => p !== a && p !== b);
    input.parties.push({
      ...a,
      id: "novice-duo",
      score: a.score + b.score,
      players: [...a.players, ...b.players],
    });
    input.rightPartyIds = input.rightPartyIds
      .filter((id) => id !== a.id && id !== b.id)
      .concat("novice-duo");
    const result = compareMirror(input);
    expect(result.status).toBe("compared");
    for (const v of result.variants!) {
      expect(v.metrics.newPlayerGap).toBe(2);
      expect(
        v.leftPartyIds.includes("novice-duo") !==
          v.rightPartyIds.includes("novice-duo"),
      ).toBe(true);
    }
  });

  it("honors a one-sided avoid constraint in every alternative", () => {
    const input = mirrorFixture();
    const initial = compareMirror(input).variants![0];
    const originalLeft = new Set(input.leftPartyIds);
    const newTeams = [initial.leftPartyIds, initial.rightPartyIds];
    const pair = newTeams
      .flatMap((team) => team.flatMap((a) => team.map((b) => [a, b])))
      .find(([a, b]) => originalLeft.has(a) !== originalLeft.has(b))!;
    const source = input.parties.find((p) => p.id === pair[0])!;
    const avoided = input.parties.find((p) => p.id === pair[1])!;
    source.dodgeList = [avoided.players[0].id];
    const result = compareMirror(input);
    expect(result.status).toBe("compared");
    for (const v of result.variants!) {
      expect(v.leftPartyIds.includes(source.id)).not.toBe(
        v.leftPartyIds.includes(avoided.id),
      );
    }
  });

  it("clips both budgets to the configured hard team limit", () => {
    const input = mirrorFixture();
    input.maxTeamScoreDifference = 200;
    const result = compareMirror(input);
    expect(result.status).toBe("compared");
    for (const v of result.variants!) {
      expect(v.scoreLimit).toBe(200);
      expect(v.metrics.scoreGap).toBeLessThanOrEqual(200);
      expect(v.metrics.newPlayerGap).toBe(2);
    }
  });

  it("preserves an existing wider gap rather than adding the budget to it", () => {
    const input = mirrorFixture();
    input.parties[5].score += 1000;
    input.parties[5].players[0].score += 1000;
    input.maxPlayerScoreDifference = 7000;
    const result = compareMirror(input);
    expect(result.status).toBe("compared");
    expect(result.variants![0].scoreLimit).toBeCloseTo(
      result.baseline!.metrics.scoreGap,
    );
    expect(result.variants![0].scoreLimit).toBeGreaterThan(1000);
  });

  it("does not classify legacy unknown experience as a novice", () => {
    const input = mirrorFixture();
    input.parties[0].players[0].pvpGames = null;
    expect(compareMirror(input).status).toBe("insufficient_data");
    input.parties[0].players[0].pvpGames = 0;
    expect(compareMirror(input).status).toBe("compared");
    input.parties[0].players[0].mmr = null;
    expect(compareMirror(input).status).toBe("insufficient_data");
  });

  it.each(["duplicate", "nonfinite", "playerLimit", "teamLimit"])(
    "rejects invalid %s snapshots",
    (problem) => {
      const input = mirrorFixture();
      if (problem === "duplicate")
        input.parties[1].players[0].id = input.parties[0].players[0].id;
      if (problem === "nonfinite") input.parties[1].score = NaN;
      if (problem === "playerLimit") input.maxPlayerScoreDifference = 1;
      if (problem === "teamLimit") input.maxTeamScoreDifference = 1;
      expect(compareMirror(input).status).toBe("invalid_input");
    },
  );
});
