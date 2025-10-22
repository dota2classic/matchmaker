import { Team } from "@/matchmaker/balance/perms";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";
import { Party } from "@/matchmaker/entity/party";

export type BalancePredicateFn = (t1: Team, t2: Team, score: number) => boolean;
export type ContextBalancePredicate = {
  context: any;
  fn: BalancePredicateFn;
};
export type BalancePredicate = BalancePredicateFn | ContextBalancePredicate;

export const isDodgeListViable = (team: Team) => {
  const players = team.flatMap((t) => t.players).map((it) => it.steamId);

  for (const party of team) {
    const hasDodge =
      party.dodgeList.findIndex((dodged) => players.includes(dodged)) !== -1;
    if (hasDodge) {
      return false;
    }
  }
  return true;
};

export const LongQueuePopPredicate = (pool: Party[], maxQueueTime: number) => {
  // Take at most 8 oldest players above threshold
  const guaranteedPlayers = pool
    .filter((t) => t.queueTimeMillis >= maxQueueTime)
    .slice(0, 8);

  return (left: Party[], right: Party[]): boolean => {
    if (guaranteedPlayers.length === 0) return true;

    // Flatten both teams
    const allParties = new Set([...left, ...right]);

    // Ensure every guaranteed player is present
    return guaranteedPlayers.every((g) => allParties.has(g));
  };
};

export const FixedTeamSizePredicate = (
  teamSize: number,
): ContextBalancePredicate => {
  return {
    context: { teamSize },
    fn: (left, right) =>
      left.reduce((a, b) => a + b.size, 0) === teamSize &&
      right.reduce((a, b) => a + b.size, 0) === teamSize,
  };
};

export const MaxTeamSizeDifference = (
  maxDifference: number,
): BalancePredicate => {
  return {
    context: { maxDifference },
    fn: (left, right) =>
      Math.abs(
        left.reduce((a, b) => a + b.size, 0) -
          right.reduce((a, b) => a + b.size, 0),
      ) <= maxDifference,
  };
};

export const DodgeListPredicate: BalancePredicate = (t1, t2) => {
  const isDodgeListViable = (team: Team) => {
    const players = team.flatMap((t) => t.players).map((it) => it.steamId);

    for (const party of team) {
      const hasDodge =
        party.dodgeList.findIndex((dodged) => players.includes(dodged)) !== -1;
      if (hasDodge) {
        return false;
      }
    }
    return true;
  };
  return isDodgeListViable(t1) && isDodgeListViable(t2);
};

export const MakeMaxScoreDifferencePredicate = (
  maxScoreDifference: number,
): BalancePredicate => ({
  context: { maxScoreDifference },
  fn: (left, right) => {
    const totalScore = (p: Party[]) => {
      return p.reduce((a, b) => a + b.score, 0);
    };
    return Math.abs(totalScore(left) - totalScore(right)) <= maxScoreDifference;
  },
});

export const MakeMaxPlayerScoreDeviationPredicate = (
  maxScoreDifference: number,
): BalancePredicate => ({
  context: { maxScoreDifference },
  fn: (left, right) => {
    const pool: PlayerInParty[] = [...left, ...right].flatMap(
      (party) => party.players,
    );

    pool.sort((a, b) => a.score - b.score);

    const diff = Math.abs(pool[0].score - pool[pool.length - 1].score);

    return diff <= maxScoreDifference;
  },
});
