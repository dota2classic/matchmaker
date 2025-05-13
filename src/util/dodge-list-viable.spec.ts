import { makePartyOf } from "@/util/take-while-not-dodged.spec";
import { isDodgeListViable } from "@/util/predicates";

describe("isDodgeListViable", () => {
  it("should return true if no dodge intersections", () => {
    const p1 = makePartyOf(["1", "2"]);
    const p2 = makePartyOf(["3", "4"]);

    expect(isDodgeListViable([p1, p2])).toEqual(true);
  });

  it("should return false if dodge intersections", () => {
    const p1 = makePartyOf(["1", "2"]);
    const p2 = makePartyOf(["3", "4"], ["1"]);

    expect(isDodgeListViable([p1, p2])).toEqual(false);
  });
});
