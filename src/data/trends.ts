import type { AttributeId } from "@/core/types";
import { ATTRIBUTES, ALL_ATTRIBUTE_IDS } from "./attributes";

/**
 * 그날의 '인기 카테고리' — 지금 올리면 인기가 크게 오를 수 있는 분야.
 * 날짜(day)를 시드로 한 결정적 난수로 매일 3종이 랜덤하게 바뀐다.
 * (상태에 저장하지 않아도 같은 날이면 항상 같은 결과가 나온다.)
 */

/** 인기 카테고리 후보(성인계 제외) */
const TREND_POOL: AttributeId[] = ALL_ATTRIBUTE_IDS.filter((a) => !ATTRIBUTES[a].adultOnly);

/** 그날 인기 카테고리에 올라탄 트윗의 성과 배율 */
export const TRENDING_MULTIPLIER = 1.7;

/** day를 시드로 한 결정적 난수(0..1). 같은 (day, salt)면 항상 같은 값. */
function seededRandom(day: number, salt: number): number {
  const x = Math.sin(day * 9301 + salt * 49297 + 233280) * 43758.5453;
  return x - Math.floor(x);
}

/** 그날의 인기 카테고리 3종(day 시드로 매일 갱신) */
export function getTrendingCategories(day: number): AttributeId[] {
  const pool = [...TREND_POOL];
  // Fisher–Yates 셔플을 day 시드로 결정적으로 수행
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(day, i) * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

/** 해당 속성이 오늘 인기 카테고리인지 */
export function isTrending(day: number, attr: AttributeId): boolean {
  return getTrendingCategories(day).includes(attr);
}
