import type { GameState } from "@/core/types";
import { ACHIEVEMENTS } from "@/data/achievements";

/**
 * 달성 조건을 만족한 도전과제를 판정해 state에 기록한다.
 * - 이미 달성한 id는 건너뛴다(중복 방지).
 * - 새로 달성한 id는 state.achievements + state.pendingAchievements(토스트 대기)에 push.
 * 반환값: 이번에 새로 달성한 id 배열.
 *
 * data/achievements + core만 의존한다(ui/systems 순환 금지).
 * onNewDay(일 단위 상태 업적)와 postTweet(팔로워/트윗 업적 즉시) 말미에서 호출된다.
 */
export function checkAchievements(state: GameState): string[] {
  const newly: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.includes(a.id)) continue;
    if (a.condition(state)) {
      state.achievements.push(a.id);
      state.pendingAchievements.push(a.id);
      newly.push(a.id);
    }
  }
  return newly;
}

/** 업적 진행도(UI 표시용, 순수 읽기) */
export function achievementProgress(state: GameState): { done: number; total: number } {
  // 성인물 보기 OFF면 성인 업적은 진행 표기에서 제외한다.
  const visible = ACHIEVEMENTS.filter((a) => state.adultMode || !a.adult);
  const visibleIds = new Set(visible.map((a) => a.id));
  return {
    done: state.achievements.filter((id) => visibleIds.has(id)).length,
    total: visible.length,
  };
}
