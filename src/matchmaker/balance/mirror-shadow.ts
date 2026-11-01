/** Pure, bounded selected-ten comparison. Never returns a live GameBalance. */
export interface MirrorPlayer {
  id: string;
  score: number;
  mmr: number | null;
  pvpGames: number | null;
  statsAt: string | null;
}

export interface MirrorParty {
  id: string;
  score: number;
  enteredAt: string | null;
  dodgeList: string[];
  players: MirrorPlayer[];
}

export interface MirrorInput {
  appliedAssignment?: { leftPartyIds: string[]; rightPartyIds: string[] };
  version: "mirror-shadow-v1";
  scope: "selected-ten";
  capturedAt: string;
  leftPartyIds: string[];
  rightPartyIds: string[];
  parties: MirrorParty[];
  maxTeamScoreDifference: number;
  maxPlayerScoreDifference: number;
  balanceFunction: string;
}

export interface MirrorMetrics {
  scoreGap: number;
  newPlayerGap: number;
  lowMmrGap: number;
  floorMmrGap: number;
  rankMmrGap: number;
  partyPairGap: number;
  rankDistanceByPlayer: Record<string, number>;
}

export interface MirrorCandidate {
  leftPartyIds: string[];
  rightPartyIds: string[];
  metrics: MirrorMetrics;
}

export interface MirrorResult {
  computeMillis?: number;
  status: "compared" | "insufficient_data" | "invalid_input";
  reason?: string;
  candidatesEvaluated: number;
  baseline?: MirrorCandidate;
  variants?: Array<
    MirrorCandidate & {
      budget: number;
      scoreLimit: number;
      changed: boolean;
      improvedPlayers: number;
      worsenedPlayers: number;
      maxIndividualWorsening: number;
    }
  >;
}

const EPSILON = 1e-6;
const finiteNonnegative = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;

function viable(left: MirrorParty[], right: MirrorParty[]) {
  return [left, right].every((team) => {
    const players = new Set(team.flatMap((p) => p.players.map((x) => x.id)));
    return team.every((p) => p.dodgeList.every((id) => !players.has(id)));
  });
}

function evaluate(left: MirrorParty[], right: MirrorParty[]): MirrorCandidate {
  const a = left.flatMap((p) => p.players);
  const b = right.flatMap((p) => p.players);
  const gap = (fn: (p: MirrorPlayer) => boolean) =>
    Math.abs(a.filter(fn).length - b.filter(fn).length);
  const sort = (players: MirrorPlayer[]) =>
    [...players].sort(
      (p, q) => q.mmr! - p.mmr! || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0),
    );
  const sa = sort(a);
  const sb = sort(b);
  const distances: Record<string, number> = Object.create(null);
  for (let i = 0; i < 5; i++) {
    const d = Math.abs(sa[i].mmr! - sb[i].mmr!);
    distances[sa[i].id] = d;
    distances[sb[i].id] = d;
  }
  const total = (team: MirrorParty[]) => team.reduce((s, p) => s + p.score, 0);
  const pairs = (team: MirrorParty[]) =>
    team.reduce(
      (s, p) => s + (p.players.length * (p.players.length - 1)) / 2,
      0,
    );
  return {
    leftPartyIds: left.map((p) => p.id),
    rightPartyIds: right.map((p) => p.id),
    metrics: {
      scoreGap: Math.abs(total(left) - total(right)),
      newPlayerGap: gap((p) => p.pvpGames! < 10),
      lowMmrGap: gap((p) => p.mmr! <= 500),
      floorMmrGap: gap((p) => p.mmr! <= 10),
      rankMmrGap: Object.values(distances).reduce((s, d) => s + d, 0) / 10,
      partyPairGap: Math.abs(pairs(left) - pairs(right)),
      rankDistanceByPlayer: distances,
    },
  };
}

function better(a: MirrorCandidate, b: MirrorCandidate) {
  const order: Array<keyof Omit<MirrorMetrics, "rankDistanceByPlayer">> = [
    "newPlayerGap",
    "lowMmrGap",
    "floorMmrGap",
    "rankMmrGap",
    "scoreGap",
  ];
  for (const key of order) {
    if (Math.abs(a.metrics[key] - b.metrics[key]) > EPSILON) {
      return a.metrics[key] < b.metrics[key];
    }
  }
  return false; // Preserve the actual assignment when objectives tie.
}

export function compareMirror(input: MirrorInput): MirrorResult {
  const invalid = (reason: string): MirrorResult => ({
    status: "invalid_input",
    reason,
    candidatesEvaluated: 0,
  });
  if (input.version !== "mirror-shadow-v1" || input.scope !== "selected-ten") {
    return invalid("unsupported_version_or_scope");
  }
  if (
    !finiteNonnegative(input.maxTeamScoreDifference) ||
    !finiteNonnegative(input.maxPlayerScoreDifference)
  )
    return invalid("invalid_limits");
  const parties = input.parties;
  if (
    parties.length < 2 ||
    parties.length > 10 ||
    new Set(parties.map((p) => p.id)).size !== parties.length
  )
    return invalid("invalid_parties");
  const players = parties.flatMap((p) => p.players);
  if (
    players.length !== 10 ||
    new Set(players.map((p) => p.id)).size !== 10 ||
    parties.some(
      (p) =>
        p.players.length < 1 ||
        p.players.length > 5 ||
        !finiteNonnegative(p.score) ||
        p.players.some((x) => !finiteNonnegative(x.score)) ||
        Math.abs(p.score - p.players.reduce((s, x) => s + x.score, 0)) >
          EPSILON,
    )
  ) {
    return invalid("invalid_players_or_scores");
  }
  const leftIds = new Set(input.leftPartyIds);
  const rightIds = new Set(input.rightPartyIds);
  if (
    leftIds.size !== input.leftPartyIds.length ||
    rightIds.size !== input.rightPartyIds.length ||
    leftIds.size + rightIds.size !== parties.length ||
    parties.some((p) => leftIds.has(p.id) === rightIds.has(p.id)) ||
    [...leftIds, ...rightIds].some((id) => !parties.some((p) => p.id === id))
  ) {
    return invalid("invalid_baseline_assignment");
  }
  const left = parties.filter((p) => leftIds.has(p.id));
  const right = parties.filter((p) => rightIds.has(p.id));
  if (
    [left, right].some(
      (team) => team.reduce((s, p) => s + p.players.length, 0) !== 5,
    ) ||
    !viable(left, right)
  )
    return invalid("invalid_baseline_teams");
  const scores = players.map((p) => p.score);
  if (
    Math.max(...scores) - Math.min(...scores) >
    input.maxPlayerScoreDifference + EPSILON
  ) {
    return invalid("player_score_limit_exceeded");
  }
  if (
    players.some(
      (p) =>
        !finiteNonnegative(p.mmr) ||
        !Number.isSafeInteger(p.pvpGames) ||
        p.pvpGames! < 0,
    )
  ) {
    return {
      status: "insufficient_data",
      reason: "missing_mmr_or_lifetime_pvp_games",
      candidatesEvaluated: 0,
    };
  }
  const baseline = evaluate(left, right);
  if (baseline.metrics.scoreGap > input.maxTeamScoreDifference + EPSILON) {
    return invalid("baseline_team_score_limit_exceeded");
  }
  const candidates: MirrorCandidate[] = [];
  // A party is atomic; fixing the first party removes side-swapped duplicates.
  for (let mask = 1; mask < 1 << parties.length; mask += 2) {
    const a = parties.filter((_, i) => (mask & (1 << i)) !== 0);
    const b = parties.filter((_, i) => (mask & (1 << i)) === 0);
    if (a.reduce((s, p) => s + p.players.length, 0) !== 5 || !viable(a, b))
      continue;
    candidates.push(evaluate(a, b));
  }
  const variants = [500, 1000].map((budget) => {
    const scoreLimit = Math.min(
      input.maxTeamScoreDifference,
      Math.max(baseline.metrics.scoreGap, budget),
    );
    let best = baseline;
    for (const candidate of candidates) {
      if (
        candidate.metrics.scoreGap <= scoreLimit + EPSILON &&
        better(candidate, best)
      )
        best = candidate;
    }
    const deltas = players.map(
      (p) =>
        best.metrics.rankDistanceByPlayer[p.id] -
        baseline.metrics.rankDistanceByPlayer[p.id],
    );
    const baselineLeft = new Set(baseline.leftPartyIds);
    const same =
      best.leftPartyIds.length === baselineLeft.size &&
      best.leftPartyIds.every((id) => baselineLeft.has(id));
    const swapped =
      best.rightPartyIds.length === baselineLeft.size &&
      best.rightPartyIds.every((id) => baselineLeft.has(id));
    return {
      ...best,
      budget,
      scoreLimit,
      changed: !same && !swapped,
      improvedPlayers: deltas.filter((d) => d < -EPSILON).length,
      worsenedPlayers: deltas.filter((d) => d > EPSILON).length,
      maxIndividualWorsening: Math.max(0, ...deltas),
    };
  });
  return {
    status: "compared",
    candidatesEvaluated: candidates.length,
    baseline,
    variants,
  };
}
