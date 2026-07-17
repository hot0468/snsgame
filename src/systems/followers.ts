import type { AttributeId, GameState } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { ATTRIBUTES, getAffinity } from "@/data/attributes";
import { MAX_SKILL } from "@/data/stats";
import { isTrending, TRENDING_MULTIPLIER } from "@/data/trends";

/**
 * RT → 신규 팔로워 전환율. **의도적으로 상수다 — 스킬을 곱하지 마라.**
 *
 * 예전엔 `0.06 + skill01 * 0.44`(스킬 0→6%, 999→50%)였고, 스킬이 skillMul(0.3→2.5)에도
 * 동시에 곱해져 **스킬 하나가 팔로워를 58배** 흔들었다. 다른 레버는 전부 합쳐도 13배
 * (평판 3.3 · 궁합 2.3 · 트렌드 1.7)라 최적 플레이가 "스킬 만렙 찍고 트윗"뿐이었다.
 *
 * 측정(하루 3회·궁합최적·평판100, 100만 팔로워 도달일):
 *   변경 전 — 스킬 0: 5985일 / 300: 1193일 / 999: 103일  (격차 58배)
 *   변경 후 — 스킬 격차 8배. 만렙 도달 156일(기본집) / 93일(펜트하우스).
 * 스킬은 skillMul에만 남는다. 그래야 집·평판·궁합·트렌드가 의미를 갖는다.
 */
export const TWEET_CONV_RATE = 0.32;

export interface TweetOutcome {
  likes: number;
  retweets: number;
  followers: number; // 증감(음수 가능)
}

/**
 * 평판에 따른 팔로워 '증가분' 배율(0.3~1.0).
 * 평판이 높으면 1.0, 낮을수록 신규 유입이 줄어든다. (감소분에는 적용 안 함)
 */
export function reputationFactor(state: GameState): number {
  return Math.max(0.3, state.resources.reputation / 100);
}

/**
 * 내 트윗 성과 계산.
 * - 연계 세부 스탯 평균이 높을수록 좋아요/RT/신규팔로워 증가.
 * - 내 계정 주 성향과 트윗 성향의 궁합이 성과 배율에 반영된다.
 * - 팔로워 규모에 비례한 기본 도달도 존재.
 */
export function calcTweetOutcome(state: GameState, attr: AttributeId): TweetOutcome {
  const def = ATTRIBUTES[attr];
  const skillAvg =
    def.relatedSkills.reduce((sum, s) => sum + state.skills[s], 0) /
    Math.max(1, def.relatedSkills.length);

  const account = getActiveAccount(state);
  const affinity = getAffinity(account.attribute, attr); // -1..1
  const affinityMul = 1 + affinity * 0.4; // 0.6 ~ 1.4

  // 연계 스탯 정도(0~1). 초반 저스탯일수록 성과가 급격히 낮아지도록 제곱 가중.
  const skill01 = Math.min(1, Math.max(0, skillAvg) / MAX_SKILL);
  const skillWeight = skill01 * skill01; // 0 → 0, 500 → 0.25, 999 → 1

  // 기본 도달: 팔로워의 일정 비율 + 최소 노출
  const reach = 20 + account.followers * 0.05;
  const skillMul = 0.3 + skillWeight * 2.2; // 스킬 0 → 0.3배, 500 → 0.85배, 999 → 2.5배

  // 오늘의 인기 카테고리면 도달·성과가 크게 상승
  const trendMul = isTrending(state.day, attr) ? TRENDING_MULTIPLIER : 1;

  const base = reach * skillMul * affinityMul * trendMul;
  const likes = Math.round(base * (0.8 + Math.random() * 0.6));
  const retweets = Math.round(likes * (0.15 + Math.random() * 0.2));

  // 신규 팔로워: RT 전환율은 스킬과 무관한 상수(TWEET_CONV_RATE), 궁합 보너스만 스탯에 좌우된다.
  const affinityBonus = affinity * (0.5 + skill01 * 3.5); // 저스탯이면 궁합 이득도 작음
  let followers = Math.round(retweets * TWEET_CONV_RATE + affinityBonus);
  if (affinity < 0) {
    // 상충 카테고리는 언팔 위험(스탯이 높을수록 파급도 큼)
    followers = Math.min(followers, Math.round(affinity * (2 + skill01 * 6)));
  }
  // 평판이 낮으면 신규 유입이 줄어든다(증가분에만 적용)
  if (followers > 0) followers = Math.round(followers * reputationFactor(state));

  return { likes, retweets, followers };
}

/**
 * 계정 팔로우 / 게시글 조우 시 내 팔로워 증감 계산.
 * 내 성향과 상대 성향의 궁합에 따라 늘거나 준다.
 */
export function calcEncounterFollowerDelta(
  state: GameState,
  otherAttr: AttributeId,
): number {
  const affinity = getAffinity(getActiveAccount(state).attribute, otherAttr); // -1..1
  const magnitude = 3 + Math.floor(Math.random() * 6);
  const raw = affinity === 0 ? Math.floor(magnitude / 3) : Math.round(affinity * magnitude);
  // 평판이 낮으면 유입이 줄어든다(증가분에만 적용)
  return raw > 0 ? Math.round(raw * reputationFactor(state)) : raw;
}

/** 활성 계정의 팔로워 수를 안전하게 변경(0 미만 방지) */
export function changeFollowers(state: GameState, delta: number): void {
  const account = getActiveAccount(state);
  account.followers = Math.max(0, account.followers + delta);
}
