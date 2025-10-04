export interface BalanceEntity {
  size: number;
  score: number;
  queueTimeMillis: number;
}

export type BalanceFunction = (
  left: BalanceEntity[],
  right: BalanceEntity[],
) => number;

const getPartyWaitingScore = (party: BalanceEntity) => {
  return party.queueTimeMillis / 100;
};

export const balanceFunctionV1 = (
  left: BalanceEntity[],
  right: BalanceEntity[],
) => {
  const lavg = left.reduce((a, b) => a + b.score, 0) / 5;
  const ravg = right.reduce((a, b) => a + b.score, 0) / 5;
  const avgDiff = Math.abs(lavg - ravg);

  let waitingScore = 0;
  for (let i = 0; i < left.length; i++) {
    waitingScore += getPartyWaitingScore(left[i]);
  }
  for (let i = 0; i < right.length; i++) {
    waitingScore += getPartyWaitingScore(right[i]);
  }

  // We want waitingScore to be highest, so we invert it
  waitingScore = Math.log(Math.max(1, waitingScore));
  waitingScore = -waitingScore;

  const comp1 = waitingScore * 100000;

  return comp1 + avgDiff;
};

export const balanceFunctionV2 = (
  left: BalanceEntity[],
  right: BalanceEntity[],
) => {
  const leftMMR = left.reduce((s, p) => s + p.score * p.size, 0);
  const rightMMR = right.reduce((s, p) => s + p.score * p.size, 0);

  const mmrDiff = Math.abs(leftMMR - rightMMR);

  // waiting time – average of all players in this match
  const allParties = left.concat(right);
  const avgWait =
    allParties.reduce((s, p) => s + p.queueTimeMillis, 0) / allParties.length;

  // Weights (tune empirically)

  const W_MMR = 1.0;
  const W_WAIT = -0.0015; // negative -> reward older queues

  // Lower is better
  return W_MMR * mmrDiff + W_WAIT * avgWait;
};

export const balanceFunctionTakeMost = (
  left: BalanceEntity[],
  right: BalanceEntity[],
) => {
  const playerCount = left.concat(right).reduce((a, b) => a + b.size, 0);

  const W_PLAYER_COUNT = -1000;

  return balanceFunctionV2(left, right) + playerCount * W_PLAYER_COUNT;
  // return playerCount * W_PLAYER_COUNT;
};
