import { Team } from "@/matchmaker/balance/perms";
import { totalScore } from "@/util/totalScore";

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

export const DodgeListPredicate: BalancePredicate = (t1, t2) => {
  return isDodgeListViable(t1) && isDodgeListViable(t2);
};

export const MakeMaxScoreDifferencePredicate =
  (maxScoreDifference: number): BalancePredicate =>
  (left, right) =>
    Math.abs(totalScore(left) - totalScore(right)) <= maxScoreDifference;
