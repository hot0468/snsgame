import type { AttributeId, GameState, TweetKind } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { ATTRIBUTES, getAffinity } from "@/data/attributes";
import { NIGL_COMPANY } from "@/data/niglnigl";
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
 * 트윗 성격별 효과. **밸런스 튜닝 지점** — 시작값(실측 후 조정 전제).
 * calcTweetOutcome이 reachMul·varLow·varRange(도달·분산)를 쓰고,
 * postTweet이 controversyBonus·reputationDelta·knowledgeDelta(게시 후 부수효과)를 적용한다.
 * plain은 전부 중립값(1.0/0)이라 성격 미지정(특수 모드) 경로는 기존 동작과 동일하다.
 */
export interface TweetKindEffect {
  reachMul: number; // 기본 도달·유입 배율
  varLow: number; // 좋아요 랜덤 하한 계수
  varRange: number; // 좋아요 랜덤 폭(클수록 대박/폭망이 갈림)
  controversyBonus: number; // 게시 후 추가 논란 확률
  reputationDelta: number; // 게시 후 평판 증감(0~100 스케일)
  knowledgeDelta: number; // 게시 후 지식 스킬 증감(999 스케일)
}

export const TWEET_KIND_EFFECTS: Record<TweetKind, TweetKindEffect> = {
  // 기준점: 배율 1.0, 리스크 없음.
  plain: { reachMul: 1.0, varLow: 0.8, varRange: 0.6, controversyBonus: 0, reputationDelta: 0, knowledgeDelta: 0 },
  // 자극: 도달↑ + 분산 대폭↑(0.4~1.9배로 대박/폭망 갈림) + 논란 +0.12 + 평판 소폭 리스크.
  provoke: { reachMul: 1.35, varLow: 0.4, varRange: 1.5, controversyBonus: 0.12, reputationDelta: -3, knowledgeDelta: 0 },
  // 정보: 유입 ×0.85(꾸준) 대신 평판 +2, 지식 스킬 +2.
  info: { reachMul: 0.85, varLow: 0.85, varRange: 0.4, controversyBonus: 0, reputationDelta: 2, knowledgeDelta: 2 },
  // 감성: 유입 ×1.2(공감·확산), 부가 이득 없음.
  emotional: { reachMul: 1.2, varLow: 0.8, varRange: 0.6, controversyBonus: 0, reputationDelta: 0, knowledgeDelta: 0 },
};

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
export function calcTweetOutcome(
  state: GameState,
  attr: AttributeId,
  kind: TweetKind = "plain",
): TweetOutcome {
  const eff = TWEET_KIND_EFFECTS[kind];
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

  // 성격별 도달 배율(자극↑·정보↓·감성↑)과 분산(자극은 대박/폭망이 갈림)을 반영한다.
  const base = reach * skillMul * affinityMul * trendMul * eff.reachMul;
  const likes = Math.round(base * (eff.varLow + Math.random() * eff.varRange));
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

  // 니글니글 재직 중이면 IT계 트윗의 신규 팔로워만 2배(혜택이므로 이득만 — 상충 손실은 안 키운다).
  if (followers > 0 && attr === "it" && state.employment?.company === NIGL_COMPANY) followers *= 2;

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
  // 게시 슬롯 상한이 팔로워 티어를 넘어 늘었으면 pending 알림을 세운다. maxPostSlots는 순수 계산이라
  // changeFollowers가 자주 불려도 무해하다. lastMaxPostSlots는 증가·감소 무관하게 항상 동기화한다.
  const nowMax = maxPostSlots(account.followers);
  if (nowMax > state.lastMaxPostSlots) state.postSlotIncreasedTo = nowMax;
  state.lastMaxPostSlots = nowMax;
}

/* ─────────────────── 게시 슬롯 곡선 ─────────────────── */

/** 게시 슬롯 상한(엔드게임 최상위 구간에서 닿는 천장). */
export const MAX_POST_SLOTS = 10;

/**
 * 팔로워 수 → 하루 최대 게시 슬롯. **밸런스 튜닝 지점** — 값을 여기서 조정한다.
 * 각 [최소팔로워, 슬롯] 구간. 내림차순으로 첫 매치가 그날의 슬롯 상한이다.
 * (시작값 — 실측 후 조정 전제. 0→1, 20→2 … 100만→10.)
 */
export const POST_SLOT_TIERS: readonly (readonly [followers: number, slots: number])[] = [
  [1_000_000, 10],
  [400_000, 9],
  [150_000, 8],
  [50_000, 7],
  [10_000, 6],
  [2_000, 5],
  [500, 4],
  [100, 3],
  [20, 2],
  [0, 1],
];

/** 활성 계정 팔로워 수 → 오늘 최대 게시 슬롯 수(1~MAX_POST_SLOTS). */
export function maxPostSlots(followers: number): number {
  const f = Number.isFinite(followers) ? followers : 0;
  for (const [threshold, slots] of POST_SLOT_TIERS) {
    if (f >= threshold) return Math.min(slots, MAX_POST_SLOTS);
  }
  return 1;
}
