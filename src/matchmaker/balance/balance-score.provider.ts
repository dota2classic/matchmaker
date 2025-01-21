export type BalanceProvider = (
  mmr: number,
  recentWinrate: number,
  games: number,
) => number;

export const BalancerV2_MMR: BalanceProvider = (
  mmr,
  wrLast20Games,
  gamesPlayed,
) => {
  // B2 * ((MIN(D2, 90) + 10) / 100)* (C2 + 0.5)

  const EDUCATION_THRESHOLD = 10;

  // Education factor: the less games you have, the less score you will end up with
  const educationFactor =
    (Math.min(gamesPlayed, EDUCATION_THRESHOLD - 1) + 1) / EDUCATION_THRESHOLD;

  // Experience factor: if you have a lot of games, its diminishing returns, so we use log
  const experienceFactor = Math.log10(Math.min(500, Math.max(10, gamesPlayed)));

  return mmr * educationFactor * experienceFactor;
};
