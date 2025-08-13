import { Team } from "@/matchmaker/balance/perms";
import { totalScore } from "@/util/totalScore";
import { PlayerInParty } from "@/matchmaker/entity/player-in-party";

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

export type BalancePredicate = (t1: Team, t2: Team, score: number) => boolean;

export const FixedTeamSizePredicate = (teamSize: number): BalancePredicate => {
  return (left, right) =>
    left.reduce((a, b) => a + b.size, 0) === teamSize &&
    right.reduce((a, b) => a + b.size, 0) === teamSize;
};

export const MaxTeamSizeDifference = (
  maxDifference: number,
): BalancePredicate => {
  return (left, right) =>
    Math.abs(
      left.reduce((a, b) => a + b.size, 0) -
        right.reduce((a, b) => a + b.size, 0),
    ) <= maxDifference;
};

export const DodgeListPredicate: BalancePredicate = (t1, t2) => {
  return isDodgeListViable(t1) && isDodgeListViable(t2);
};

export const MakeMaxScoreDifferencePredicate =
  (maxScoreDifference: number): BalancePredicate =>
  (left, right) =>
    Math.abs(totalScore(left) - totalScore(right)) <= maxScoreDifference;

export const MakeMaxPlayerScoreDeviationPredicate =
  (maxScoreDifference: number): BalancePredicate =>
  (left, right) => {
    const pool: PlayerInParty[] = [...left, ...right].flatMap(
      (party) => party.players,
    );

    pool.sort((a, b) => a.score - b.score);

    const diff = Math.abs(pool[0].score - pool[pool.length - 1].score);

    return diff <= maxScoreDifference;
  };
