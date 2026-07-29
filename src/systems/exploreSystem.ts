import type { Account, AttributeId, EggKind, GameState, Tweet } from "@/core/types";
import { dominantAttribute, getActiveAccount, pushTimeline } from "@/core/state";
import {
  makeEggTweet,
  makeRandomAccount,
  FIXED_AUTHOR_HANDLES,
  makeGenericTweet,
  makeRandomTweet,
  makeRumorTweet,
  makeCharacterTweet,
  maybeFixedAuthorTweet,
  makeTweetOfAttribute,
  profileFromAuthor,
  linesForHandle,
} from "@/data/accounts";
import { ATTRIBUTES, getAffinity } from "@/data/attributes";
import { makeOmenAccount } from "@/data/omenAccount";
import { makeChilnamAccount } from "@/data/chilnamAccount";
import { maybeSpawnChilnamDM, assignedTargetTweets, assignedTargetAccount } from "./killer";
import { targetByHandle } from "@/data/killerTargets";
import { SPECIAL_ACCOUNT_MAKERS } from "@/data/specialAccounts";
import { allTemplatesFor } from "@/data/tweets";
import { chance, pick, randInt, sample, uid } from "@/utils/random";
import { calcEncounterFollowerDelta, changeFollowers } from "./followers";
import { makeWishTweet } from "./wish";
import { makeOhaasaTweet } from "./ohaasa";
import { makeChainLetterTweet } from "./chainLetter";
import { makeBoostTweet } from "./statBoost";
import { makePsychoTweet } from "./psychoTest";
import { makeHauntTweet } from "./haunt";
import { DARTPIN_TWEET_CHANCE, makeDartpinTweet } from "./dartpin";
import { webtoonBuzzTweets } from "./author";
import { streamBuzzTweets } from "./livestream";
import { DSTORY_TWEET_CHANCE, isDstoryDone, makeDstoryTweet } from "./dstory";
import { maybeSpawnFanDM } from "./dm";
import { onFollow, onLikeTweet, onRetweet } from "./eggs";
import { makeGoodsGroupBuyTweet } from "./groupBuy";
import { addSchedule, advanceTime } from "./time";
import { unlockAttribute } from "./attributeUnlock";
import { clampAction } from "./stats";
import { recordMission } from "./missions";
import { TREND_MULTIPLIER, rideTrend, unriddenTrendFor } from "./trends";

/** 최근 반응 카테고리 이력을 몇 개까지 들고 있을지(에코챔버 피드 재료) */
const FEED_TASTE_MAX = 10;

/** 신규 게시글 탐색 시 한 칸을 '내 취향' 카테고리로 채울 확률(에코챔버 강도) */
const ECHO_CHANCE = 0.45;

/**
 * 반응한 카테고리를 취향 이력에 남긴다(좋아요·악플·리트윗 공통 — 악플도 관심은 관심이다).
 * 중복 제거를 **하지 않는 게 의도**다: 같은 값이 여러 번 쌓여야 균등 pick이 곧 가중 추첨이 된다.
 */
function recordTaste(state: GameState, attr: AttributeId): void {
  state.feedTaste = [...(state.feedTaste ?? []), attr].slice(-FEED_TASTE_MAX);
}

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
  // 임무 중이면 낮은 확률로 배정된 타겟 계정이 계정 탐색에 뜬다(배정 순간 만들어진 계정).
  if (state.killerJob?.assignment) {
    const tgt = assignedTargetAccount(state);
    if (tgt && chance(0.25)) accounts[randInt(0, 2)] = tgt;
  }
  return accounts;
}

const EGG_KINDS: EggKind[] = ["coin", "pyramid", "animal"];

/**
 * 특수 트윗(이스터에그·오하아사·소원 등)이 덮어쓸 슬롯을 고른다.
 *
 * 그냥 randInt로 고르면 전용 문구 고정 계정이 뽑힌 칸을 덮어써서, 선언한
 * `FIXED_AUTHOR_TWEET_CHANCE`(30%)가 화면에서는 19%까지 내려간다. 그래서 **고정 계정이 아닌
 * 칸을 우선**한다 — 특수 트윗 빈도는 그대로 두면서 고정 계정 노출만 지켜진다.
 * 세 칸이 전부 고정 계정이면(≈2.7%) 어쩔 수 없이 아무 칸이나 덮는다.
 */
function specialSlot(tweets: Tweet[]): number {
  const free = tweets
    .map((t, i) => (FIXED_AUTHOR_HANDLES.includes(t.authorHandle) ? -1 : i))
    .filter((i) => i >= 0);
  return free.length ? pick(free) : randInt(0, tweets.length - 1);
}

/** 신규 게시글 탐색: 랜덤 트윗 3개 생성(일부는 이스터에그 트윗) */
export function exploreTweets(state: GameState): Tweet[] {
  const adult = state.adultMode;
  // 에코챔버: 최근 반응한 카테고리가 다시 뜰 확률이 높다. 편식하면 그 판만 보이고,
  // 대신 안 보는 카테고리는 마주칠 일이 없어 속성 해금이 정체된다(maybeUnlockAttribute가
  // 마주친 카테고리에만 걸리므로 별도 페널티 코드 없이 자연히 따라온다).
  const taste = state.feedTaste ?? [];
  const tweets = Array.from({ length: 3 }, () => {
    // ⚠️ 전용 문구 고정 계정 판정이 **에코챔버보다 먼저**다. 뒤에 두면 취향 편중이 45%를
    //    가로채 실제 노출이 FIXED_AUTHOR_TWEET_CHANCE보다 낮아진다(선언값 30% → 체감 16%).
    //    그래서 여기서 한 번만 굴리고, 아래 경로는 고정 계정을 다시 굴리지 않는 makeGenericTweet를 쓴다.
    const fixed = maybeFixedAuthorTweet(state.day);
    if (fixed) return fixed;
    if (taste.length && chance(ECHO_CHANCE)) {
      const attr = pick(taste);
      // 성인물이 꺼져 있으면 성인계는 취향이어도 띄우지 않는다(일반 랜덤 경로와 같은 규칙).
      if (adult || !ATTRIBUTES[attr].adultOnly) return makeTweetOfAttribute(attr, adult, state.day);
    }
    return makeGenericTweet(adult, state.day);
  });
  // 낮은 확률로 한 칸을 이스터에그 트윗으로 교체
  if (chance(0.4)) tweets[specialSlot(tweets)] = makeEggTweet(pick(EGG_KINDS), state.day);
  // 오하아사(아침 운세)는 자주 떠야 하므로 사슬 위쪽·높은 확률(사용자 확정 예외).
  else if (chance(0.15)) tweets[specialSlot(tweets)] = makeOhaasaTweet(state);
  // 아주 낮은 확률로 '까칠한외눈' 소원 트윗이 섞인다
  else if (chance(0.12)) tweets[specialSlot(tweets)] = makeWishTweet(state);
  // 낮은 확률로 '다트 핀' 발견 트윗(링크 첨부)이 섞인다 — 아직 발견 전일 때만.
  // ⚠️ 까칠한외눈 분기 '뒤'에 두는 건 의도다: 앞에 끼우면 소원 트윗 확률이 함께 깎인다.
  else if (!state.dartpinUnlocked && chance(DARTPIN_TWEET_CHANCE)) {
    tweets[specialSlot(tweets)] = makeDartpinTweet(state);
  }
  // 나머지 특수 트윗 4종은 사슬 '뒤쪽'·낮은 확률(소원/다트핀을 과희석하지 않도록).
  else if (chance(0.06)) tweets[specialSlot(tweets)] = makeChainLetterTweet(state);
  else if (chance(0.06)) tweets[specialSlot(tweets)] = makeBoostTweet(state);
  else if (chance(0.05)) tweets[specialSlot(tweets)] = makePsychoTweet(state);
  else if (chance(0.06)) tweets[specialSlot(tweets)] = makeHauntTweet(state);
  // 낮은 확률로 오타쿠 굿즈 공구 모집 트윗('공구 참여하기' 버튼)이 섞인다.
  else if (chance(0.06)) tweets[specialSlot(tweets)] = makeGoodsGroupBuyTweet(state.day);
  // 킬러 임무 중이면 낮은 확률로 배정된 타겟의 트윗이 피드에 섞인다(일반 트윗처럼 마주친다).
  if (state.killerJob?.active && state.killerJob.assignment && chance(0.3)) {
    const tgt = assignedTargetTweets(state);
    if (tgt.length) tweets[specialSlot(tweets)] = pick(tgt);
  }
  return tweets;
}

/** 홈(추천) 피드 하루치 구성 — 광고 2개는 state.adTweets가 따로 공급한다. */
export const HOME_FEED_RANDOM = 5;
export const HOME_FEED_FIXED = 2;
export const HOME_FEED_EGG = 1;
export const HOME_FEED_COUNT = HOME_FEED_RANDOM + HOME_FEED_FIXED + HOME_FEED_EGG;

/**
 * 홈 타임라인 하루치 트윗을 만든다(랜덤 5 + 전용 문구 고정 계정 2 + 이스터에그 1, 섞어서 반환).
 * UI가 날짜가 바뀔 때만 부르고 결과를 그날 내내 재사용한다(재렌더마다 피드가 흔들리지 않게).
 *
 * ⚠️ 순수 생성기다 — 여기서 상태를 바꾸지 마라(렌더 경로에서 호출된다).
 * d스토리(IT 블로그) 링크 트윗은 원래 IT계 '검색'에만 뜨는 예외였는데,
 * 홈 이스터에그 후보로는 사용자가 명시적으로 요청해 포함한다(둘러보기 피드는 여전히 제외).
 */
export function homeFeedTweets(state: GameState): Tweet[] {
  const adult = state.adultMode;
  const taste = state.feedTaste ?? [];

  // 같은 문구가 한 피드에 두 번 뜨면 바로 티가 난다 — 겹치면 몇 번 다시 뽑는다.
  const seen = new Set<string>();
  const uniq = (make: () => Tweet): Tweet => {
    let t = make();
    for (let i = 0; i < 5 && seen.has(t.text); i++) t = make();
    seen.add(t.text);
    return t;
  };

  // 랜덤 트윗 — 둘러보기와 같은 에코챔버 규칙(최근 반응한 카테고리가 더 자주 뜬다).
  const random = Array.from({ length: HOME_FEED_RANDOM }, () =>
    uniq(() => {
      if (taste.length && chance(ECHO_CHANCE)) {
        const attr = pick(taste);
        if (adult || !ATTRIBUTES[attr].adultOnly) return makeTweetOfAttribute(attr, adult, state.day);
      }
      return makeGenericTweet(adult, state.day);
    }),
  );

  // 전용 문구 고정 계정(소문 계정 / 캐릭터 계정) — 확률이 아니라 매일 확정 2칸.
  const fixed = Array.from({ length: HOME_FEED_FIXED }, () =>
    uniq(() => (chance(0.5) ? makeRumorTweet(state.day) : makeCharacterTweet(state.day))),
  );

  // 이스터에그 1칸 — 조건부(다트 핀·d스토리)는 아직 안 푼 동안만 후보에 든다.
  const eggMakers: Array<() => Tweet> = [
    () => makeEggTweet(pick(EGG_KINDS), state.day),
    () => makeOhaasaTweet(state),
    () => makeWishTweet(state),
    () => makeChainLetterTweet(state),
    () => makeBoostTweet(state),
    () => makePsychoTweet(state),
    () => makeHauntTweet(state),
    () => makeGoodsGroupBuyTweet(state.day),
  ];
  if (!state.dartpinUnlocked) eggMakers.push(() => makeDartpinTweet(state));
  if (!isDstoryDone(state)) eggMakers.push(() => makeDstoryTweet(state));
  const egg = pick(eggMakers)();

  const feed = [...random, ...fixed, egg];
  return sample(feed, feed.length); // 셔플 — 고정 계정·이스터에그가 항상 아래쪽에 몰리지 않게
}

/**
 * 트윗 단어 검색 — 질의(단어 또는 @핸들)가 본문·이름·핸들에 포함된 트윗을 돌려준다.
 * 배정된 킬러 타겟의 트윗을 후보에 포함하므로, 타겟 @핸들이나 그가 흘린 위치 단어로 검색하면
 * 그 계정 트윗이 뜬다(타겟 발견 경로). 일반 트윗 배치도 섞어 진짜 검색처럼 보이게 한다.
 */
export function searchTweetsByWord(state: GameState, query: string): Tweet[] {
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const q = norm(query.replace(/^@/, ""));
  if (!q) return [];
  const pool: Tweet[] = [...assignedTargetTweets(state)];
  for (let i = 0; i < 24; i++) pool.push(makeRandomTweet(state.adultMode, state.day));
  const hit = (t: Tweet) =>
    norm(t.authorHandle).includes(q) || norm(t.authorName).includes(q) || norm(t.text).includes(q);
  // 내 작가 필명·방송 활동명을 검색했으면 그 반응을 맨 앞에 붙인다(활동 중일 때만).
  // 랜덤 트윗 뒤에 섞이면 정작 찾던 반응이 안 보인다.
  return [
    ...webtoonBuzzTweets(state, query),
    ...streamBuzzTweets(state, query),
    ...pool.filter(hit),
  ].slice(0, 20);
}

/** 검색: 특정 카테고리(성향)의 랜덤 트윗 3개 생성 */
export function searchTweetsByCategory(state: GameState, attr: AttributeId): Tweet[] {
  const adult = state.adultMode;
  const tweets = Array.from({ length: 3 }, () => makeTweetOfAttribute(attr, adult, state.day));
  // 낮은 확률로 한 칸을 'd스토리' 링크 트윗으로 교체 — 두 글을 다 풀기 전까지만.
  // ⚠️ IT계 **검색**에만 뜬다. 둘러보기 피드(exploreTweets)에는 넣지 마라(사용자 확정).
  if (attr === "it" && !isDstoryDone(state) && chance(DSTORY_TWEET_CHANCE)) {
    tweets[specialSlot(tweets)] = makeDstoryTweet(state);
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
  // 킬러 타겟이면 배정 시 저장된 트윗으로 프로필을 구성한다(피드에서 본 트윗과 프로필이 일치).
  if (targetByHandle(tweet.authorHandle)) {
    const acc = assignedTargetAccount(state);
    if (acc && acc.handle === tweet.authorHandle) return acc;
  }
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
    // 고정 캐릭터 계정은 전용 문구만 쓴다(팔로우 후에도 말투가 안 바뀌게).
    const pool = linesForHandle(f.handle) ?? allTemplatesFor(f.attribute, state.adultMode);
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
  recordTaste(state, tweet.attribute);
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

  // 실검 편승: 오늘 실검에 뜬 카테고리의 트윗을 리트윗하면 팔로워 배수(트렌드당 1회/일).
  // 이득 방향으로만 곱한다 — 궁합 상충(delta<0)일 땐 편승도 소모하지 않는다.
  const trend = unriddenTrendFor(state, tweet.attribute);
  let delta = calcEncounterFollowerDelta(state, tweet.attribute);
  if (trend && delta > 0) {
    delta = Math.round(delta * TREND_MULTIPLIER);
    rideTrend(state, trend.id);
  }
  changeFollowers(state, delta);
  recordTaste(state, tweet.attribute);
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
