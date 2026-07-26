import type { GameState } from "@/core/types";
import { TREND_POOL, type TrendTopic } from "@/data/trendTopics";
import { sample } from "@/utils/random";

/**
 * 네이놈 실시간 검색어(실검) — 트렌드 편승.
 *
 * 포털에 실검 TOP 10을 매일 스냅샷으로 건다(다트핀 board와 같은 방식 — `systems/dartpin.ts` 미러).
 * 항목 클릭 → 그 트렌드 카테고리로 작성 모달이 열리고, 그 카테고리로 게시하면 팔로워 부스트.
 * 부스트는 트렌드당 **1회/일**(state.trendBoard.ridden으로 판정).
 *
 * ⚠️ 순수 로직 — ui/DOM import 없음. 부스트 적용 자체는 `composeModal`의 postTweet
 * followerMultiplier 인자에서 TREND_MULTIPLIER를 곱해 처리한다(계약서 ①).
 */

/** 실검에 매일 노출되는 트렌드 수 */
export const TREND_BOARD_SIZE = 10;

/** 트렌드 카테고리로 게시 시 곱해지는 팔로워 부스트 배수 */
export const TREND_MULTIPLIER = 1.6;

/**
 * 오늘자 실검을 편성한다(없거나 오늘 것이 아니면 재편성).
 * ui가 위젯 렌더 시 호출한다(systems는 렌더 시점을 모른다 — ensureDartpinBoard와 같은 패턴).
 */
export function ensureTrendBoard(state: GameState): void {
  if (state.trendBoard && state.trendBoard.day === state.day) return;
  const ids = sample(TREND_POOL, Math.min(TREND_BOARD_SIZE, TREND_POOL.length)).map((t) => t.id);
  state.trendBoard = { day: state.day, ids, ridden: [] };
}

/**
 * 오늘 실검의 트렌드 목록을 반환한다.
 * ⚠️ 먼저 `ensureTrendBoard`를 호출해야 한다. 데이터에서 사라진 id는 조용히 걸러낸다(구세이브 대비).
 */
export function getTrends(state: GameState): TrendTopic[] {
  const ids = state.trendBoard?.ids ?? [];
  return ids
    .map((id) => TREND_POOL.find((t) => t.id === id))
    .filter((t): t is TrendTopic => t !== undefined);
}

/** id로 트렌드 하나를 찾는다. 없으면 undefined. */
export function trendById(id: string): TrendTopic | undefined {
  return TREND_POOL.find((t) => t.id === id);
}

/** 오늘 이 트렌드에 이미 편승(부스트)했는지. */
export function hasRiddenTrend(state: GameState, id: string): boolean {
  return state.trendBoard?.ridden.includes(id) ?? false;
}

/** 이 트렌드에 편승 처리한다(중복 push 방지 — 부스트 1회/일 보장). */
export function rideTrend(state: GameState, id: string): void {
  if (!state.trendBoard) return;
  if (!state.trendBoard.ridden.includes(id)) state.trendBoard.ridden.push(id);
}
