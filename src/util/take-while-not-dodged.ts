import { Party } from "@/matchmaker/entity/party";
import { isDodgeListViable } from "@/util/predicates";

export const takeWhileNotDodged = (parties: Party[], limit: number = 5) => {
  let target: Party[] = [];

  for (let i = 0; i < parties.length; i++) {
    const p = parties[i];

    const newGroup = [...target, p];
    const newGroupSize = newGroup.reduce((a, b) => a + b.players.length, 0);

    if (newGroupSize > limit) {
      break;
    }

    if (!isDodgeListViable(newGroup)) {
      continue;
    }

    target = newGroup;
  }

  return target;
};
