import {
  balanceFunctionLogWaitingTime,
  balanceFunctionMultWaitingTime,
  balanceFunctionTakeMost,
} from "@/matchmaker/balance/balance-functions";

export enum BalanceFunctionType {
  LOG_WAITING_SCORE = "LOG_WAITING_SCORE",
  MULT_WAITING_SCORE = "MULT_WAITING_SCORE",
  OPTIMIZE_PLAYER_COUNT = "OPTIMIZE_PLAYER_COUNT",
}

export const BalanceFunctionMapping = {
  [BalanceFunctionType.LOG_WAITING_SCORE]: balanceFunctionLogWaitingTime,
  [BalanceFunctionType.MULT_WAITING_SCORE]: balanceFunctionMultWaitingTime,
  [BalanceFunctionType.OPTIMIZE_PLAYER_COUNT]: balanceFunctionTakeMost,
};
