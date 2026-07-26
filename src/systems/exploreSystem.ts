import type { Account, AttributeId, EggKind, GameState, Tweet } from "@/core/types";
import { dominantAttribute, getActiveAccount, pushTimeline } from "@/core/state";
import {
  makeEggTweet,
  makeRandomAccount,
  makeRandomTweet,
  makeTweetOfAttribute,
  profileFromAuthor,
} from "@/data/accounts";
import { ATTRIBUTES, getAffinity } from "@/data/attributes";
import { makeOmenAccount } from "@/data/omenAccount";
import { makeChilnamAccount } from "@/data/chilnamAccount";
import { maybeSpawnChilnamDM } from "./killer";
import { SPECIAL_ACCOUNT_MAKERS } from "@/data/specialAccounts";
import { allTemplatesFor } from "@/data/tweets";
import { chance, pick, randInt, uid } from "@/utils/random";
import { calcEncounterFollowerDelta, changeFollowers } from "./followers";
import { makeWishTweet } from "./wish";
import { makeOhaasaTweet } from "./ohaasa";
import { makeChainLetterTweet } from "./chainLetter";
import { makeBoostTweet } from "./statBoost";
import { makePsychoTweet } from "./psychoTest";
import { makeHauntTweet } from "./haunt";
import { DARTPIN_TWEET_CHANCE, makeDartpinTweet } from "./dartpin";
import { DSTORY_TWEET_CHANCE, isDstoryDone, makeDstoryTweet } from "./dstory";
import { maybeSpawnFanDM } from "./dm";
import { onFollow, onLikeTweet, onRetweet } from "./eggs";
import { makeGoodsGroupBuyTweet } from "./groupBuy";
import { addSchedule, advanceTime } from "./time";
import { unlockAttribute } from "./attributeUnlock";
import { clampAction } from "./stats";
import { recordMission } from "./missions";

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
  const accounts = Array.from({ length: 3 }, () => {
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
  // 낮은 확률로 한 칸을 전용 트윗 풀을 쓰는 고정 NPC(예언·리딩방·명언봇·공식봇)로 교체한다.
  if (chance(0.3)) {
    const makers = [makeOmenAccount, ...SPECIAL_ACCOUNT_MAKERS];
    accounts[randInt(0, 2)] = pick(makers)(state.day);
  }
  // 킬러가 된 뒤엔 낮은 확률로 '칠남'(대부분 '오늘 운이 없었다' 트윗)이 섞인다.
  else if (state.killerJob?.active && chance(0.25)) {
    accounts[randInt(0, 2)] = makeChilnamAccount(state.day);
  }
  return accounts;
}

const EGG_KINDS: EggKind[] = ["coin", "pyramid", "animal"];

/** 신규 게시글 탐색: 랜덤 트윗 3개 생성(일부는 이스터에그 트윗) */
export function exploreTweets(state: GameState): Tweet[] {
  const adult = state.adultMode;
  const tweets = Array.from({ length: 3 }, () => makeRandomTweet(adult, state.day));
  // 낮은 확률로 한 칸을 이스터에그 트윗으로 교체
  if (chance(0.4)) tweets[randInt(0, 2)] = makeEggTweet(pick(EGG_KINDS), state.day);
  // 오하아사(아침 운세)는 자주 떠야 하므로 사슬 위쪽·높은 확률(사용자 확정 예외).
  else if (chance(0.15)) tweets[randInt(0, 2)] = makeOhaasaTweet(state);
  // 아주 낮은 확률로 '까칠한외눈' 소원 트윗이 섞인다
  else if (chance(0.12)) tweets[randInt(0, 2)] = makeWishTweet(state);
  // 낮은 확률로 '다트 핀' 발견 트윗(링크 첨부)이 섞인다 — 아직 발견 전일 때만.
  // ⚠️ 까칠한외눈 분기 '뒤'에 두는 건 의도다: 앞에 끼우면 소원 트윗 확률이 함께 깎인다.
  else if (!state.dartpinUnlocked && chance(DARTPIN_TWEET_CHANCE)) {
    tweets[randInt(0, 2)] = makeDartpinTweet(state);
  }
  // 나머지 특수 트윗 4종은 사슬 '뒤쪽'·낮은 확률(소원/다트핀을 과희석하지 않도록).
  else if (chance(0.06)) tweets[randInt(0, 2)] = makeChainLetterTweet(state);
  else if (chance(0.06)) tweets[randInt(0, 2)] = makeBoostTweet(state);
  else if (chance(0.05)) tweets[randInt(0, 2)] = makePsychoTweet(state);
  else if (chance(0.06)) tweets[randInt(0, 2)] = makeHauntTweet(state);
  // 낮은 확률로 오타쿠 굿즈 공구 모집 트윗('공구 참여하기' 버튼)이 섞인다.
  else if (chance(0.06)) tweets[randInt(0, 2)] = makeGoodsGroupBuyTweet(state.day);
  return tweets;
}

/** 검색: 특정 카테고리(성향)의 랜덤 트윗 3개 생성 */
export function searchTweetsByCategory(state: GameState, attr: AttributeId): Tweet[] {
  const adult = state.adultMode;
  const tweets = Array.from({ length: 3 }, () => makeTweetOfAttribute(attr, adult, state.day));
  // 낮은 확률로 한 칸을 'd스토리' 링크 트윗으로 교체 — 두 글을 다 풀기 전까지만.
  // ⚠️ IT계 **검색**에만 뜬다. 둘러보기 피드(exploreTweets)에는 넣지 마라(사용자 확정).
  if (attr === "it" && !isDstoryDone(state) && chance(DSTORY_TWEET_CHANCE)) {
    tweets[randInt(0, 2)] = makeDstoryTweet(state);
  }
  return tweets;
}

/**
 * 계정을 팔로우한다.
 * - 내 팔로잉 +1
 * - 궁합에 따라 내 팔로워 증감
 * - 상대 성향이 아직 미해금이면 낮은 확률로 트윗 작성 속성 해금
 */
/**
 * 아무 남의 트윗 작성자든 그 사람의 계정 프로필(Account)을 얻는다 — 트윗 아바타 클릭용.
 * 이미 팔로우한 계정이면 그 실물을 재사용(상태 일관), 아니면 핸들로 결정론 합성한다.
 * `followed`는 현재 팔로잉 목록으로 정확히 표시한다.
 */
export function accountForTweet(state: GameState, tweet: Tweet): Account {
  const me = getActiveAccount(state);
  const existing = me.followingAccounts.find((a) => a.handle === tweet.authorHandle);
  if (existing) return { ...existing, followed: true };
  const acc = profileFromAuthor(
    tweet.authorName,
    tweet.authorHandle,
    tweet.attribute,
    tweet.isAdult,
    state.day,
  );
  acc.followed = me.followingAccounts.some((a) => a.handle === tweet.authorHandle);
  return acc;
}

/** 이미 팔로우한 핸들인지 */
export function isFollowingHandle(state: GameState, handle: string): boolean {
  return getActiveAccount(state).followingAccounts.some((a) => a.handle === handle);
}

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
  // 칠남(동종업계 킬러)을 팔로우하면 그가 품앗이 DM을 건다(킬러일 때만).
  if (account.handle === "chilnam_7") maybeSpawnChilnamDM(state);
  onFollow(state, account); // 봇/유령 다수 팔로우 이스터에그
  recordMission(state, "follow");
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
  if (positive) {
    onLikeTweet(state, tweet); // 이스터에그(코인/다단계/동물/찐친)
    recordMission(state, "like");
  }
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
  pushTimeline(account, rt);
  // 리트윗도 내 계정 성향(다수 카테고리) 집계에 반영
  account.attribute = dominantAttribute(account);

  const delta = calcEncounterFollowerDelta(state, tweet.attribute);
  changeFollowers(state, delta);
  maybeUnlockAttribute(state, tweet.attribute);
  if (delta > 0) maybeSpawnFanDM(state);
  onRetweet(state, tweet); // 같은 사람 반복 리트윗 → 찐친 이스터에그
  recordMission(state, "retweet");
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
