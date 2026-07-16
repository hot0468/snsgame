import type { GameState } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { randInt } from "@/utils/random";
import { addSchedule, advanceTime } from "./time";

/** 하루에 한 번 광고를 볼 수 있는지 */
export function canWatchAd(state: GameState): boolean {
  return state.daily.adWatchedDay !== state.day;
}

/** 활성 계정 팔로워 규모에 따른 광고 수익(생활비/월세를 감당하는 주 수입원) */
export function adReward(state: GameState): number {
  const followers = getActiveAccount(state).followers;
  // 팔로워가 늘수록 단가 상승. 예: 1만 팔로워 ≈ 10,000원대.
  return 1000 + Math.round(followers * 1.0) + randInt(0, 500);
}

/**
 * 광고 시청: 하루 1회, 팔로워 규모에 비례한 수익 획득.
 * @returns 획득 금액(불가 시 0)
 */
export function watchAd(state: GameState): number {
  if (!canWatchAd(state)) return 0;
  const reward = adReward(state);
  state.money += reward;
  state.daily.adWatchedDay = state.day;
  addSchedule(state, `광고 시청 (+${reward.toLocaleString("ko-KR")}원)`, "sns");
  advanceTime(state, 1);
  return reward;
}
