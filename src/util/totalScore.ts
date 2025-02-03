import { Party } from "@/matchmaker/entity/party";

export function totalScore(p: Party[]) {
  return p.reduce((a, b) => a + b.score, 0);
}
