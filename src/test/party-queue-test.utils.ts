import { Party } from "@/matchmaker/entity/party";
import { TestEnvironment } from "@/test/useFullModule";
import { PartyInvite } from "@/matchmaker/entity/party-invite";

export const createTestingUtils = (te: TestEnvironment) => {
  const expectPartyHasPlayer = async (
    partyId: string,
    plr: string,
    not: boolean = false,
  ) => {
    const party: Party = await te
      .repo<Party>(Party)
      .findOneOrFail({ where: { id: partyId } });

    let matcher: any = expect(party.players);
    if (not) matcher = matcher.not;
    return matcher.toPartiallyContain({ steamId: plr });
  };

  const expectPartyHasNotPlayer = (id: string, plr: string) =>
    expectPartyHasPlayer(id, plr, true);

  const expectPartyInQueue = async (id: string, inQueue: boolean) => {
    const party: Party = await te
      .repo<Party>(Party)
      .findOneOrFail({ where: { id } });

    return expect(party.inQueue).toEqual(inQueue);
  };

  const expectInviteDeleted = (id: string) =>
    expect(te.repo(PartyInvite).exists({ where: { id: id } })).resolves.toEqual(
      false,
    );

  return {
    expectPartyHasNotPlayer,
    expectPartyInQueue,
    expectPartyHasPlayer,
    expectInviteDeleted,
  };
};
