import { Party } from "@/matchmaker/entity/party";
import { takeWhileNotDodged } from "@/util/take-while-not-dodged";

export const makePartyOf = (steamIds: string[], dodgeList: string[] = []) =>
  ({
    players: steamIds.map((steamId) => ({ steamId })),
    dodgeList,
  }) as unknown as Party;

describe("take-while-not-dodged", () => {
  it("should make a group if no dodge list and parties greater than group", () => {
    const parties = Array.from({ length: 10 }, (_, idx) =>
      makePartyOf([idx.toString()]),
    );

    const res = takeWhileNotDodged(parties, 3);

    expect(res).toHaveLength(3);
  });

  it("should make a group if no dodge list and parties less than group size", () => {
    const parties = Array.from({ length: 2 }, (_, idx) =>
      makePartyOf([idx.toString()]),
    );

    const res = takeWhileNotDodged(parties, 3);

    expect(res).toHaveLength(2);
  });
});
