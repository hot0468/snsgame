import type { GameState } from "@/core/types";
import { BOSS_JOKES } from "@/data/bossJokes";
import { gainSkill } from "@/systems/stats";
import { pick } from "@/utils/random";

/** 부장님 아재개그에 "재밌다"고 반응했을 때 얻는 개그(comedy) 스탯. */
export const BOSS_JOKE_COMEDY = 5;

/** 부장님이 툭 던지는 아재개그 하나를 뽑는다(랜덤). */
export function pickBossJoke(_state: GameState): string {
  return pick(BOSS_JOKES);
}

/** 오늘 아직 부장님 개그로 comedy를 얻지 않았으면 true. */
export function canLaughToday(state: GameState): boolean {
  return state.bossJokeDay !== state.day;
}

/**
 * 부장님 개그에 웃어 comedy를 얻는다. 하루 1회 캡(시간·행동력 미소모).
 * 첫 회면 comedy +BOSS_JOKE_COMEDY 후 BOSS_JOKE_COMEDY 반환, 이미 웃었으면 0 반환(변화 없음).
 */
export function laughAtBossJoke(state: GameState): number {
  if (!canLaughToday(state)) return 0;
  gainSkill(state, "comedy", BOSS_JOKE_COMEDY);
  state.bossJokeDay = state.day;
  return BOSS_JOKE_COMEDY;
}
