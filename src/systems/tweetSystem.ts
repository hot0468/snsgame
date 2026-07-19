import type { AdultKind, AttributeId, GameState, Tweet, TweetKind } from "@/core/types";
import {
  dominantAttribute,
  getActiveAccount,
  LATE_SLOT,
} from "@/core/state";
import { chance, randInt, uid } from "@/utils/random";
import { makeMedia } from "@/data/media";
import { mediaSetFor } from "@/data/mediaTweets";
import { imageForTweet } from "./mediaImages";
import { calcTweetOutcome, changeFollowers, TWEET_KIND_EFFECTS } from "./followers";
import { maybeSpawnDickPicDM, maybeSpawnFanDM, maybeSpawnMotelDM, maybeSpawnTicketDM } from "./dm";
import { maybeSpawnAvOfferDM } from "./avJob";
import { maybeSpawnSavannaDM } from "./savanna";
import { consumePostSlot, onTweetPosted, smartTweetMultiplier } from "./eggs";
import { maybeSpawnCrewInviteDM } from "./crew";
import { maybeSpawnPushDM } from "./pushtime";
import { maybeSpawnYabamDM } from "./yabam";
import { generateReactions } from "./reactions";
import { clampAction, clampResource, clampSkill } from "./stats";
import { addStrike } from "./ban";
import { rollControversy, CONTROVERSY_REP_THRESHOLD } from "./controversy";
import { gainAffinityFromTweet } from "./relationship";
import { addSchedule } from "./time";
import { MEETING_GATE_THRESHOLDS } from "./meeting";

/** 트윗 1건 작성에 드는 행동력 */
export const TWEET_ACTION_COST = 10;

/** 성인 트윗의 신규 팔로워 배율(일반 대비) */
export const ADULT_FOLLOWER_MULTIPLIER = 1.5;

export interface PostTweetResult {
  tweet: Tweet;
  followerDelta: number;
  /** 이번 성인 트윗으로 만남 시나리오 해금 문턱을 막 넘었으면 true */
  unlockedMeeting: boolean;
}

/** postTweet 부가 옵션 */
export interface PostTweetOptions {
  /**
   * true면 행동력 소모(TWEET_ACTION_COST)를 건너뛴다.
   * 무료 게시 경로(예: 야밤 리뷰 트윗 해금)에 사용. 그 외 팔로워·리액션·타임라인
   * 등록·DM 스폰 등은 그대로 수행된다.
   */
  free?: boolean;
  /**
   * 트윗 성격(무난/자극/정보/감성). 미지정 시 "plain"(중립값)이라 특수 모드
   * (성인·기사·야밤 리뷰·창작·홍보 등) 경로는 기존 동작과 동일하다.
   * 일반 트윗 작성(composeModal 4성격 picker)에서만 선택값이 전달된다.
   */
  kind?: TweetKind;
}

/**
 * 새 트윗을 등록한다.
 * - 행동력을 소모하고(트윗은 시간/슬롯을 진행시키지 않는다 — 행동력이 유일한 통화),
 *   성과를 계산해 팔로워를 반영한 뒤 타임라인 맨 앞에 추가.
 * - 성인 트윗은 신규 팔로워가 1.5배.
 * - 심야 슬롯 트윗이면 lateTweetToday를 세워 다음날 수면 회복을 줄인다.
 */
export function postTweet(
  state: GameState,
  attr: AttributeId,
  text: string,
  isAdult: boolean,
  adultKind: AdultKind = "meetup",
  followerMultiplier = 1,
  opts: PostTweetOptions = {},
): PostTweetResult {
  const account = getActiveAccount(state);
  // 성인 해금 크로싱 판정용: adultTweetsPosted 증가 전 값을 잡아둔다.
  const beforeAdult = state.adultTweetsPosted;
  const kind = opts.kind ?? "plain";
  const kindEff = TWEET_KIND_EFFECTS[kind];
  const outcome = calcTweetOutcome(state, attr, kind);
  // 성인 트윗은 신규 팔로워 1.5배, 박학다식 달성 시 정보성 트윗 성과 상승,
  // 창작(1차/2차)·이달의 인기작 적중 시 followerMultiplier로 추가 가중.
  const followers = Math.round(
    outcome.followers *
      (isAdult ? ADULT_FOLLOWER_MULTIPLIER : 1) *
      smartTweetMultiplier(state, attr) *
      followerMultiplier,
  );

  const postedSlot = state.slot;

  const tweet: Tweet = {
    id: uid("tweet"),
    authorName: account.name,
    authorHandle: account.handle,
    attribute: attr,
    isAdult,
    text,
    createdDay: state.day,
    likes: outcome.likes,
    retweets: outcome.retweets,
    gainedFollowers: followers,
  };

  tweet.replies = generateReactions(state, attr, text);
  // 미디어 세트 트윗이면 그 미디어를, 아니면 확률적으로 랜덤 미디어 첨부
  const mset = mediaSetFor(text);
  if (mset) tweet.media = mset.media;
  else if (chance(0.2)) tweet.media = makeMedia(attr);
  // 게시 순간의 이미지를 박제한다 — 등록 이미지 풀이 늘어도 내 트윗 이미지가 다음날 안 바뀌게.
  if (tweet.media) {
    const ti = imageForTweet(tweet);
    if (ti) tweet.mediaImage = { url: ti.url, adult: ti.source === "adult" };
  }

  // 무료 게시(opts.free)면 행동력 소모와 게시 슬롯 소비를 둘 다 건너뛴다.
  if (!opts.free) {
    state.resources.action = clampAction(state, state.resources.action - TWEET_ACTION_COST);
    consumePostSlot(state);
    // 아이돌/애니/배우 트윗을 실제로 게시하면 덕질 스탯이 오른다(무료 게시 제외).
    if (attr === "idol" || attr === "anime" || attr === "actor") {
      state.skills.otaku = clampSkill(state.skills.otaku + 3);
    }
  }
  changeFollowers(state, followers);
  account.timeline.unshift(tweet);
  account.lastTweetDay = state.day;
  // 올린 트윗들의 다수 카테고리로 계정 성향을 갱신(유저에게는 표출되지 않음)
  account.attribute = dominantAttribute(account);
  addSchedule(state, `트윗 등록 (+${followers} 팔로워)`, "sns");
  // 게시 트윗의 attr+kind가 관계 캐릭터의 좋아하는 계열+유형과 맞으면 호감도가 오른다.
  // (활성 계정 해금 계열만 순회 — 로스터가 비면 빈 루프라 무영향.)
  gainAffinityFromTweet(state, attr, kind);
  if (followers > 0) maybeSpawnFanDM(state);
  // 성인 트윗이면 확률적으로 (종류에 맞는) 모텔 제안 DM 또는 성기 사진 DM이 온다
  if (isAdult) {
    state.postedAdultEver = true;
    state.adultTweetsPosted++;
    if (adultKind === "punish") state.punishTweetsPosted++;
    maybeSpawnMotelDM(state, adultKind);
    maybeSpawnDickPicDM(state);
    maybeSpawnSavannaDM(state);
    maybeSpawnYabamDM(state);
    maybeSpawnAvOfferDM(state);
  }
  // 아이돌덕/배우덕 트윗이면 확률적으로 티켓 양도 DM이 온다
  else if (attr === "idol" || attr === "actor") maybeSpawnTicketDM(state, attr);
  // 운동 트윗이면 확률적으로 러닝크루 가입 권유 DM이 온다
  else if (attr === "fitness") maybeSpawnCrewInviteDM(state);
  // 애니덕 트윗이면(성인+음란 높음) 확률적으로 푸시타임 링크 DM이 온다
  else if (attr === "anime") maybeSpawnPushDM(state);

  // 성격별 부수효과: 정보=평판·지식↑, 자극=평판 리스크(감성/무난은 0). plain은 전부 0이라 특수 모드는 무영향.
  if (kindEff.reputationDelta !== 0) {
    state.resources.reputation = clampResource(state.resources.reputation + kindEff.reputationDelta);
  }
  if (kindEff.knowledgeDelta !== 0) {
    state.skills.knowledge = clampSkill(state.skills.knowledge + kindEff.knowledgeDelta);
  }

  // 평판이 낮거나 성인 트윗은 논란/박제가 터질 수 있다. 자극 성격은 논란 확률이 추가된다.
  let ctrlChance = kindEff.controversyBonus;
  if (state.resources.reputation < CONTROVERSY_REP_THRESHOLD) ctrlChance += 0.18;
  if (isAdult && state.resources.morality < 30) ctrlChance += 0.15;
  rollControversy(state, ctrlChance);

  // 심야 슬롯 트윗이면 수면 부족 플래그(다음날 슬롯이 넘어갈 때 회복이 줄어듦).
  // 단, 무료 게시(opts.free)면 진짜 '무료' 해금이므로 수면 페널티도 남기지 않는다.
  if (!opts.free && postedSlot === LATE_SLOT) state.lateTweetToday = true;

  // 도배(하루 10개 초과)·밤샘(7일 연속 심야) 이스터에그 판정
  onTweetPosted(state, postedSlot);

  // 트윗은 시간을 진행시키지 않는다(슬롯 전환은 오프라인 활동·근무 등이 담당).
  const unlockedMeeting =
    isAdult &&
    MEETING_GATE_THRESHOLDS.some((t) => beforeAdult < t && state.adultTweetsPosted >= t);
  return { tweet, followerDelta: followers, unlockedMeeting };
}

/** 트윗 작성이 가능한지(행동력 체크) */
export function canPostTweet(state: GameState): boolean {
  return state.resources.action >= TWEET_ACTION_COST;
}

/** 사기 트윗 1건이 깎는 평판 */
export const SCAM_REPUTATION_DROP = 35;
/** 사기 트윗 1건이 깎는 도덕성 */
export const SCAM_MORALITY_DROP = 8;

export interface ScamTweetResult {
  tweet: Tweet;
  /** 사기로 번 금액 */
  earned: number;
}

/**
 * 사기성 트윗을 등록한다(도덕성이 매우 낮을 때만 UI에서 노출).
 * - 소지금을 얻지만 평판이 크게, 도덕성도 함께 떨어진다.
 * - 신규 팔로워는 없다(오히려 평판 하락으로 이후 유입이 줄어든다).
 */
export function postScamTweet(state: GameState, text: string): ScamTweetResult {
  const account = getActiveAccount(state);
  const postedSlot = state.slot;

  // 팔로워가 많을수록 등쳐먹을 대상도 많아 수익이 크다
  const earned = Math.round((30_000 + account.followers * 3) * (0.7 + Math.random() * 0.6));
  state.money += earned;
  state.resources.reputation = clampResource(state.resources.reputation - SCAM_REPUTATION_DROP);
  state.resources.morality = clampResource(state.resources.morality - SCAM_MORALITY_DROP);

  const tweet: Tweet = {
    id: uid("tweet"),
    authorName: account.name,
    authorHandle: account.handle,
    attribute: "daily",
    isAdult: false,
    text,
    createdDay: state.day,
    likes: randInt(0, 40),
    retweets: randInt(0, 15),
    gainedFollowers: 0,
  };

  state.resources.action = clampAction(state, state.resources.action - TWEET_ACTION_COST);
  consumePostSlot(state);
  account.timeline.unshift(tweet);
  account.lastTweetDay = state.day;
  addSchedule(state, `사기 트윗 (+${earned.toLocaleString("ko-KR")}원)`, "sns");

  // 사기는 경고 누적(밴 위험) + 높은 확률로 논란 발생
  addStrike(state, 1);
  rollControversy(state, 0.5);

  if (postedSlot === LATE_SLOT) state.lateTweetToday = true;

  // 사기 트윗도 시간을 진행시키지 않는다(일반 트윗과 규칙 통일).
  return { tweet, earned };
}
