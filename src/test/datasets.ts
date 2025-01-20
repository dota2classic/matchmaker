import { createParty, TestEnvironment, testUser } from "@/test/useFullModule";

async function userParty(te: TestEnvironment) {
  const u1 = testUser();
  const u2 = testUser();

  return {
    u1,
    u2,
    // party: await createParty(te, )
  }
}
