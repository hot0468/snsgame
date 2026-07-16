import type { Account, AttributeId, EggKind, GameState, Tweet } from "@/core/types";
import { dominantAttribute, getActiveAccount } from "@/core/state";
import { makeEggTweet, makeRandomAccount, makeRandomTweet, makeTweetOfAttribute } from "@/data/accounts";
import { ATTRIBUTES, getAffinity } from "@/data/attributes";
import { allTemplatesFor } from "@/data/tweets";
import { chance, pick, randInt, uid } from "@/utils/random";
import { calcEncounterFollowerDelta, changeFollowers } from "./followers";
import { makeWishTweet } from "./wish";
import { DARTPIN_TWEET_CHANCE, makeDartpinTweet } from "./dartpin";
import { maybeSpawnFanDM } from "./dm";
import { onFollow, onLikeTweet, onRetweet } from "./eggs";
import { addSchedule, advanceTime } from "./time";
import { unlockAttribute } from "./attributeUnlock";
import { clampAction } from "./stats";

/** 남에게 다정하게(긍정) 반응하려면 필요한 최소 친화력 */
export const SOCIABILITY_NICE_MIN = 250;

/** 친화력이 충분해 긍정 반응(좋아요/응원)을 남길 수 있는지 */
export function canReactNicely(state: GameState): boolean {
  return state.skills.sociability >= SOCIABILITY_NICE_MIN;
}

/** 탐색 1회 행동력 비용 */
export const EXPLORE_ACTION_COST = 5;

const BOT_NAMES = ["팔로우맞팔", "선팔하면맞팔", "무료홍보", "이벤트당첨", "24시간자동", "지금가입"];

/** 계정 탐색: 랜덤 계정 3개 생성(일부는 봇/유령 계정) */
export function exploreAccounts(state: GameState): Account[] {
  const adult = state.adultMode;
  return Array.from({ length: 3 }, () => {
    const acc = makeRandomAccount(adult, state.day);
    // 낮은 확률로 봇/유령 계정(다수 팔로우 시 신뢰도 하락 이벤트)
    if (chance(0.25)) {
      acc.bot = true;
      acc.name = pick(BOT_NAMES);
      acc.handle = `${pick(["auto", "bot", "free", "win"])}_${Math.random().toString(36).slice(2, 7)}`;
      acc.bio = "선팔하면 맞팔! 무료 홍보/이벤트 문의 DM 📩";
      acc.followers = randInt(0, 30);
    }
    return acc;
  });
}

const EGG_KINDS: EggKind[] = ["coin", "pyramid", "animal"];

/** 신규 게시글 탐색: 랜덤 트윗 3개 생성(일부는 이스터에그 트윗) */
export function exploreTweets(state: GameState): Tweet[] {
  const adult = state.adultMode;
  const tweets = Array.from({ length: 3 }, () => makeRandomTweet(adult, state.day));
  // 낮은 확률로 한 칸을 이스터에그 트윗으로 교체
  if (chance(0.4)) tweets[randInt(0, 2)] = makeEggTweet(pick(EGG_KINDS), state.day);
  // 아주 낮은 확률로 '까칠한외눈' 소원 트윗이 섞인다
  else if (chance(0.12)) tweets[randInt(0, 2)] = makeWishTweet(state);
  // 낮은 확률로 '다트 핀' 발견 트윗(링크 첨부)이 섞인다 — 아직 발견 전일 때만.
  // ⚠️ 까칠한외눈 분기 '뒤'에 두는 건 의도다: 앞에 끼우면 소원 트윗 확률이 함께 깎인다.
  else if (!state.dartpinUnlocked && chance(DARTPIN_TWEET_CHANCE)) {
    tweets[randInt(0, 2)] = makeDartpinTweet(state);
  }
  return tweets;
}

/** 검색: 특정 카테고리(성향)의 랜덤 트윗 3개 생성 */
export function searchTweetsByCategory(state: GameState, attr: AttributeId): Tweet[] {
  const adult = state.adultMode;
  return Array.from({ length: 3 }, () => makeTweetOfAttribute(attr, adult, state.day));
}

/**
 * 계정을 팔로우한다.
 * - 내 팔로잉 +1
 * - 궁합에 따라 내 팔로워 증감
 * - 상대 성향이 아직 미해금이면 낮은 확률로 트윗 작성 속성 해금
 */
export function followAccount(state: GameState, account: Account): number {
  const me = getActiveAccount(state);
  me.following += 1;
  // 팔로우한 계정을 저장(팔로잉 피드용). 핸들 중복은 무시.
  if (!me.followingAccounts.some((a) => a.handle === account.handle)) {
    me.followingAccounts.push({ ...account, followed: true });
  }
  const delta = calcEncounterFollowerDelta(state, account.attribute);
  changeFollowers(state, delta);
  maybeUnlockAttribute(state, account.attribute);
  if (delta > 0) maybeSpawnFanDM(state);
  onFollow(state, account); // 봇/유령 다수 팔로우 이스터에그
  addSchedule(
    state,
    `${account.name} 팔로우 (${delta >= 0 ? "+" : ""}${delta})`,
    "sns",
  );
  return delta;
}

/**
 * 팔로잉 피드: 내가 팔로우한 계정들이 방금 올린 듯한 트윗을 랜덤으로 count개 생성.
 * 팔로우한 계정이 없으면 빈 배열.
 */
export function followingFeedTweets(state: GameState, count = 5): Tweet[] {
  const me = getActiveAccount(state);
  const follows = me.followingAccounts;
  if (follows.length === 0) return [];

  const usedTexts = new Set<string>();
  return Array.from({ length: count }, () => {
    const f = pick(follows);
    const pool = allTemplatesFor(f.attribute, state.adultMode);
    let text = pick(pool);
    // 같은 배치 안에서 문구 중복 회피(몇 번 재시도)
    for (let i = 0; i < 5 && usedTexts.has(text); i++) text = pick(pool);
    usedTexts.add(text);
    return {
      id: uid("ff"),
      authorName: f.name,
      authorHandle: f.handle,
      attribute: f.attribute,
      isAdult: f.isAdult,
      text,
      createdDay: state.day,
      likes: randInt(0, 500),
      retweets: randInt(0, 120),
      gainedFollowers: 0,
    };
  });
}

/** 신규 게시글을 보고 상호작용(좋아요/RT)했을 때의 팔로워 영향 */
export function engageTweet(state: GameState, tweet: Tweet): number {
  const delta = calcEncounterFollowerDelta(state, tweet.attribute);
  changeFollowers(state, delta);
  maybeUnlockAttribute(state, tweet.attribute);
  return delta;
}

/**
 * 남의 트윗에 반응을 남긴다.
 * - positive(좋아요/응원): 친화력이 충분해야 가능. 궁합이 좋으면 팔로워 소폭 증가, 도덕성 +1.
 * - negative(악플): 친화력과 무관하게 가능. 도덕성이 깎이고 대개 팔로워가 줄지만, 가끔 관종 유입도.
 */
export function reactToTweet(state: GameState, tweet: Tweet, positive: boolean): number {
  const account = getActiveAccount(state);
  const affinity = getAffinity(account.attribute, tweet.attribute);
  let delta: number;
  if (positive) {
    delta = affinity > 0 ? randInt(2, 6) : affinity < 0 ? randInt(-1, 1) : randInt(0, 3);
    state.resources.morality = Math.min(100, state.resources.morality + 1);
    maybeUnlockAttribute(state, tweet.attribute);
  } else {
    delta = chance(0.3) ? randInt(1, 4) : -randInt(1, 5);
    state.resources.morality = Math.max(0, state.resources.morality - randInt(3, 6));
  }
  changeFollowers(state, delta);
  if (positive) onLikeTweet(state, tweet); // 이스터에그(코인/다단계/동물/찐친)
  addSchedule(state, positive ? "응원 반응" : "악플", "sns");
  return delta;
}

/**
 * 남의 트윗(신규 게시글·다른 계정 트윗)을 리트윗한다.
 * - 해당 트윗이 원작자 정보를 유지한 채 '리트윗'으로 내 타임라인에 등록된다.
 * - 상호작용 효과(궁합 팔로워 증감 + 속성 해금 기회)도 함께 발생.
 * 같은 트윗을 중복 리트윗하지 않으면 delta를, 이미 했으면 null을 반환.
 */
export function retweetTweet(state: GameState, tweet: Tweet): number | null {
  const account = getActiveAccount(state);
  // 원본 id 기준 중복 방지
  if (account.timeline.some((t) => t.isRetweet && t.retweetSourceId === tweet.id)) {
    return null;
  }
  const rt: Tweet = {
    ...tweet,
    id: uid("rt"),
    isRetweet: true,
    retweetSourceId: tweet.id,
    createdDay: state.day,
    gainedFollowers: 0,
  };
  account.timeline.unshift(rt);
  // 리트윗도 내 계정 성향(다수 카테고리) 집계에 반영
  account.attribute = dominantAttribute(account);

  const delta = calcEncounterFollowerDelta(state, tweet.attribute);
  changeFollowers(state, delta);
  maybeUnlockAttribute(state, tweet.attribute);
  if (delta > 0) maybeSpawnFanDM(state);
  onRetweet(state, tweet); // 같은 사람 반복 리트윗 → 찐친 이스터에그
  addSchedule(state, `리트윗 (${delta >= 0 ? "+" : ""}${delta})`, "sns");
  return delta;
}

/** 탐색 행동으로 시간·행동력 소모 처리 */
export function spendExplore(state: GameState): void {
  state.resources.action = clampAction(state, state.resources.action - EXPLORE_ACTION_COST);
  advanceTime(state, 1);
}

/**
 * 성인계는 성인물 해제가 켜져 있어야만 해금 가능.
 * 그 외 속성은 조우 시 25% 확률로 트윗 작성 속성 해금.
 */
export function maybeUnlockAttribute(state: GameState, attr: Account["attribute"]): void {
  const account = getActiveAccount(state);
  if (account.unlockedAttributes.includes(attr)) return;
  // 강아지계/고양이계는 조우로 해금되지 않는다 — 산책에서 직접 데려와야 열린다.
  if (attr === "dog" || attr === "cat") return;
  if (ATTRIBUTES[attr].adultOnly && !state.adultMode) return;
  if (Math.random() < 0.25) {
    // ⚠️ push 직접 호출 금지 — 해금 부수효과(게임 스킬 기준선 등)를 단일 관문이 보장한다.
    unlockAttribute(state, account, attr);
    addSchedule(state, `새 트윗 속성 해금: ${ATTRIBUTES[attr].label}`, "system");
  }
}
