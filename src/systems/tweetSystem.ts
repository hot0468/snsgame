import type { AdultKind, AttributeId, GameState, Tweet, TweetKind } from "@/core/types";
import {
  dominantAttribute,
  getActiveAccount,
  LATE_SLOT,
  pushTimeline,
} from "@/core/state";
import { chance, randInt, uid } from "@/utils/random";
import { makeMedia } from "@/data/media";
import { mediaSetFor } from "@/data/mediaTweets";
import {
  DDEOKSANG_MIN,
  DDEOKSANG_RATE,
  DDEOKSANG_BONUS_RATE,
  COMBO_BONUS_RATE,
  COMBO_MAX_STEP,
  COMBO_CONTROVERSY_RATE,
} from "@/data/tweetFun";
import { masteryTierFor } from "@/data/tweetMastery";
import { imageForTweet } from "./mediaImages";
import { recordMission } from "./missions";
import { PC_UPGRADE_ID } from "@/data/shop";
import { calcTweetOutcome, changeFollowers, TWEET_KIND_EFFECTS } from "./followers";
import { maybeSpawnDickPicDM, maybeSpawnFanDM, maybeSpawnMotelDM, maybeSpawnTicketDM } from "./dm";
import { maybeSpawnAvOfferDM } from "./avJob";
import { maybeSpawnSavannaDM } from "./savanna";
import { consumePostSlot, onTweetPosted, smartTweetMultiplier } from "./eggs";
import { applyTchinReach, maybeSpawnTchinBoost } from "./tchin";
import { maybeSpawnCrewInviteDM } from "./crew";
import { maybeSpawnClubDM } from "./privateClub";
import { maybeSpawnLingerieDM } from "./lingerie";
import { maybeSpawnCosplayDM } from "./cosplay";
import { maybeSpawnPushDM } from "./pushtime";
import { generateReactions } from "./reactions";
import { clampAction, clampMental, clampResource, gainSkill } from "./stats";
import { addStrike } from "./ban";
import { rollControversy, CONTROVERSY_REP_THRESHOLD } from "./controversy";
import { gainAffinityFromTweet } from "./relationship";
import { addSchedule } from "./time";
import { MEETING_GATE_THRESHOLDS } from "./meeting";
import { checkAchievements } from "./achievements";
import { checkStatMilestones } from "./milestones";
import { maybeQueueNews } from "./news";

/** 트윗 1건 작성에 드는 기본 행동력(컴퓨터 업그레이드로 감소 — tweetActionCost 참조) */
export const TWEET_ACTION_COST = 10;
/** 컴퓨터 업그레이드 1개당 트윗 행동력 감소분 */
export const PC_UPGRADE_ACTION_CUT = 1;
/** 컴퓨터 업그레이드로도 이 밑으로는 안 내려가는 트윗 행동력 하한 */
export const TWEET_ACTION_MIN = 5;
/** 아이돌·애니·배우 트윗 1건을 실제로 게시했을 때 선언되는 덕질 획득량(gainSkill 배율 전) */
export const OTAKU_TWEET_SKILL_GAIN = 3;

/**
 * 지금 이 계정이 트윗 1건 게시에 실제로 쓰는 행동력.
 * 기본 TWEET_ACTION_COST에서 컴퓨터 업그레이드(pc_upgrade) 보유 개수만큼 깎되 TWEET_ACTION_MIN이 하한.
 * 게시 경로(일반·인용·트친소)와 UI 게이트·표시가 모두 이 값을 쓴다.
 */
export function tweetActionCost(state: GameState): number {
  const upgrades = state.ownedItems.filter((id) => id === PC_UPGRADE_ID).length;
  return Math.max(TWEET_ACTION_MIN, TWEET_ACTION_COST - PC_UPGRADE_ACTION_CUT * upgrades);
}

/** 성인 트윗의 신규 팔로워 배율(일반 대비) */
export const ADULT_FOLLOWER_MULTIPLIER = 1.5;

export interface PostTweetResult {
  tweet: Tweet;
  followerDelta: number;
  /** 이번 성인 트윗으로 만남 시나리오 해금 문턱을 막 넘었으면 true */
  unlockedMeeting: boolean;
  /** 이번 트윗이 떡상(대박)했는지 — ui가 떡상 연출을 띄운다. */
  ddeoksang: boolean;
  /** 떡상 시 눈덩이 보너스로 추가된 팔로워(연출 표시용). */
  ddeoksangGain: number;
  /** 이번 트윗으로 변한 스탯들(덕질·지식·평판 등) — ui가 토스트로 알린다. */
  statChanges: { label: string; delta: number }[];
  /** 이번 트윗 포함 같은 갈래 연타 수(1=콤보 없음) — ui가 2연타부터 표시한다. */
  streak: number;
  /** 이번 트윗 적립 후 그 갈래의 숙련 누적(결과 화면 게이지의 분자). */
  masteryCount: number;
  /**
   * 이번 트윗으로 숙련 tier가 올랐으면 새 tier(1~4), 아니면 0.
   * ui가 이 값으로 승급 연출을 띄운다.
   */
  masteryTierUp: number;
}

/**
 * 떡상 판정 — 이번 트윗의 팔로워 증가분이 예외적으로 클 때.
 * 계정이 작아도 절대 최소치(DDEOKSANG_MIN)를 넘거나, 계정 규모의 DDEOKSANG_RATE 이상이면 떡상.
 */
export function isDdeoksang(delta: number, followers: number): boolean {
  return delta >= Math.max(DDEOKSANG_MIN, followers * DDEOKSANG_RATE);
}

/** 떡상 눈덩이 보너스(증가분의 DDEOKSANG_BONUS_RATE, 반올림). */
export function ddeoksangBonus(delta: number): number {
  return Math.round(delta * DDEOKSANG_BONUS_RATE);
}

/**
 * 연속 트윗 콤보를 갱신하고 **이번 트윗 포함** 연타 수를 돌려준다.
 * 같은 갈래면 +1, 다른 갈래면 1로 리셋. 직전 트윗만 보므로 날이 바뀌어도 이어진다.
 */
export function bumpTweetStreak(state: GameState, attr: AttributeId): number {
  const prev = state.tweetStreak;
  const count = prev && prev.attr === attr ? prev.count + 1 : 1;
  state.tweetStreak = { attr, count };
  return count;
}

/** 연타 수 → 도달 배수(1연타=1배, COMBO_MAX_STEP에서 상한). */
export function comboMultiplier(streak: number): number {
  return 1 + COMBO_BONUS_RATE * (Math.min(streak, COMBO_MAX_STEP) - 1);
}

/** 연타 수 → 추가 논란 확률(1연타=0, COMBO_MAX_STEP에서 상한). */
export function comboControversy(streak: number): number {
  return COMBO_CONTROVERSY_RATE * (Math.min(streak, COMBO_MAX_STEP) - 1);
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
  /**
   * 창작 트윗이면 그 종류(1차=original / 2차=fan). 있으면 **무조건 미디어(그림) 형태**로 게시되고
   * (mset·확률 분기를 건너뛴다), 이미지는 창작 전용 풀에서 붙는다(imageForTweet의 pickCreationImage).
   */
  creation?: "original" | "fan";
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
  // 이번 트윗으로 오른/내린 스탯을 모아 ui가 토스트로 알린다.
  const statChanges: { label: string; delta: number }[] = [];
  // 성인 해금 크로싱 판정용: adultTweetsPosted 증가 전 값을 잡아둔다.
  const beforeAdult = state.adultTweetsPosted;
  const kind = opts.kind ?? "plain";
  const kindEff = TWEET_KIND_EFFECTS[kind];
  const outcome = calcTweetOutcome(state, attr, kind);
  // 같은 갈래 연타 콤보 — 도달이 오르는 대신 아래에서 논란 확률도 같이 오른다.
  const streak = bumpTweetStreak(state, attr);
  // 갈래 숙련 적립. ⚠️ **반드시 calcTweetOutcome 뒤다.** 문턱을 넘는 트윗이 넘은 뒤의
  // 배율까지 받으면 결과 화면이 보여주는 "이번 성과"와 표시 tier가 어긋난다.
  // 무료 게시(opts.free)도 적립한다 — 면제되는 건 행동력·게시 슬롯뿐이다.
  const masteryBefore = state.tweetMastery[attr] ?? 0;
  const masteryCount = masteryBefore + 1;
  state.tweetMastery[attr] = masteryCount;
  const tierAfter = masteryTierFor(masteryCount);
  const masteryTierUp = tierAfter > masteryTierFor(masteryBefore) ? tierAfter : 0;
  // 성인 트윗은 신규 팔로워 1.5배, 박학다식 달성 시 정보성 트윗 성과 상승,
  // 창작(1차/2차)·이달의 인기작 적중 시 followerMultiplier로 추가 가중.
  const followers = applyTchinReach(
    state,
    Math.round(
      outcome.followers *
        (isAdult ? ADULT_FOLLOWER_MULTIPLIER : 1) *
        smartTweetMultiplier(state, attr) *
        comboMultiplier(streak) *
        followerMultiplier,
    ),
  );

  const postedSlot = state.slot;
  recordMission(state, "tweet"); // 도전과제: 트윗 게시 카운트

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
  // 창작(1차/2차) 트윗은 무조건 미디어(직접 그린 그림) 형태 — mset·확률 분기를 건너뛴다.
  if (opts.creation) {
    tweet.creation = opts.creation;
    tweet.media = {
      kind: "photo",
      prompt: opts.creation === "original" ? "직접 그린 오리지널 일러스트" : "직접 그린 팬아트",
    };
  } else {
    // 미디어 세트 트윗이면 그 미디어를, 아니면 확률적으로 랜덤 미디어 첨부
    const mset = mediaSetFor(text);
    if (mset) tweet.media = mset.media;
    else if (chance(0.2)) tweet.media = makeMedia(attr);
  }
  // 게시 순간의 이미지를 박제한다 — 등록 이미지 풀이 늘어도 내 트윗 이미지가 다음날 안 바뀌게.
  if (tweet.media) {
    const ti = imageForTweet(tweet);
    if (ti) tweet.mediaImage = { url: ti.url, adult: ti.source === "adult" };
  }

  // 무료 게시(opts.free)면 행동력 소모와 게시 슬롯 소비를 둘 다 건너뛴다.
  if (!opts.free) {
    state.resources.action = clampAction(state, state.resources.action - tweetActionCost(state));
    consumePostSlot(state);
    // 아이돌/애니/배우 트윗을 실제로 게시하면 덕질 스탯이 오른다(무료 게시 제외).
    if (attr === "idol" || attr === "anime" || attr === "actor") {
      // ⚠️ statChanges에는 선언값(3)이 아니라 gainSkill이 **실제로 반영한 델타**를 넣는다.
      //    선언값을 넣으면 컨디션이 나쁠 때 "덕질 +3"으로 예고하고 +1만 오르는 괴리가 생긴다.
      const otakuDelta = gainSkill(state, "otaku", OTAKU_TWEET_SKILL_GAIN);
      if (otakuDelta !== 0) statChanges.push({ label: "덕질", delta: otakuDelta });
    }
  }
  changeFollowers(state, followers);
  // 떡상 판정 — 증가분이 예외적으로 크면 눈덩이 보너스 1회(보너스로 재판정하지 않는다).
  const ddeoksang = followers > 0 && isDdeoksang(followers, account.followers);
  let ddeoksangGain = 0;
  if (ddeoksang) {
    ddeoksangGain = ddeoksangBonus(followers);
    changeFollowers(state, ddeoksangGain);
  }
  pushTimeline(account, tweet);
  account.lastTweetDay = state.day;
  // 떡상 트윗이면 확률적으로 기사화 예약(다음날 아침 팝업). 떡상 아니면 gain 0 → 내부 스킵.
  maybeQueueNews(state, tweet.id, tweet.text, ddeoksang ? followers : 0);
  // 올린 트윗들의 다수 카테고리로 계정 성향을 갱신(유저에게는 표출되지 않음)
  account.attribute = dominantAttribute(account);
  addSchedule(state, `트윗 등록 (+${followers} 팔로워)`, "sns");
  // 게시 트윗의 attr+kind가 관계 캐릭터의 좋아하는 계열+유형과 맞으면 호감도가 오른다.
  // (활성 계정 해금 계열만 순회 — 로스터가 비면 빈 루프라 무영향.)
  gainAffinityFromTweet(state, attr, kind);
  // 게시 후 낮은 확률로 트친이 리트윗해 띄워준다(보너스 팔로워 + 응원 카톡).
  maybeSpawnTchinBoost(state);
  if (followers > 0) maybeSpawnFanDM(state);
  // 성인 트윗이면 확률적으로 (종류에 맞는) 모텔 제안 DM 또는 성기 사진 DM이 온다
  if (isAdult) {
    state.postedAdultEver = true;
    state.adultTweetsPosted++;
    if (adultKind === "punish") {
      state.punishTweetsPosted++;
      // 체벌 트윗이 쌓이면 비공개 클럽에서 연락이 온다(러닝크루를 안 거치는 우회로).
      maybeSpawnClubDM(state);
    }
    maybeSpawnMotelDM(state, adultKind);
    maybeSpawnDickPicDM(state);
    maybeSpawnSavannaDM(state);
    maybeSpawnAvOfferDM(state);
  }
  // 아이돌덕/배우덕 트윗이면 확률적으로 티켓 양도 DM이 온다
  else if (attr === "idol" || attr === "actor") maybeSpawnTicketDM(state, attr);
  // 운동 트윗이면 확률적으로 러닝크루 가입 권유 DM이 온다
  else if (attr === "fitness") maybeSpawnCrewInviteDM(state);
  // 애니덕 트윗이면(성인+음란 높음) 확률적으로 푸시타임 링크 DM이 온다
  else if (attr === "anime") maybeSpawnPushDM(state);

  // 애니덕 트윗은 성인 무관 누적 카운트(코스프레 제의 트리거).
  if (attr === "anime") state.animeTweetsPosted++;
  // 전속 계약/촬영 제의는 attr·성인 여부와 무관하게 조건 충족 시 확률 스폰(각 함수가 자체 게이트).
  maybeSpawnLingerieDM(state);
  maybeSpawnCosplayDM(state);

  // 성격별 부수효과: 정보=평판·지식↑, 자극=평판 리스크, 감성·자극=정신력 소모(무난은 전부 0).
  // plain은 모든 필드가 0이라 특수 모드(성격 미지정) 경로는 기존 동작과 동일하다.
  if (kindEff.reputationDelta !== 0) {
    state.resources.reputation = clampResource(state.resources.reputation + kindEff.reputationDelta);
    statChanges.push({ label: "평판", delta: kindEff.reputationDelta });
  }
  if (kindEff.mentalDelta !== 0) {
    // ⚠️ 감성·자극의 대가. 실제 반영 델타를 표시한다(0에서 더 못 깎이면 0으로 보여야 한다).
    const before = state.resources.mental;
    state.resources.mental = clampMental(state, state.resources.mental + kindEff.mentalDelta);
    const applied = state.resources.mental - before;
    if (applied !== 0) statChanges.push({ label: "정신력", delta: applied });
  }
  if (kindEff.knowledgeDelta !== 0) {
    // 선언값이 아니라 실제 반영 델타를 표시한다(위 덕질과 같은 이유).
    const knowledgeDelta = gainSkill(state, "knowledge", kindEff.knowledgeDelta);
    if (knowledgeDelta !== 0) statChanges.push({ label: "지식", delta: knowledgeDelta });
  }

  // 평판이 낮거나 성인 트윗은 논란/박제가 터질 수 있다. 자극 성격은 논란 확률이 추가된다.
  let ctrlChance = kindEff.controversyBonus + comboControversy(streak);
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
  // 팔로워/트윗 업적 즉시 판정(첫 트윗·팔로워 마일스톤·도배왕 등).
  checkAchievements(state);
  // 트윗으로 오른 스킬(덕질·지식 등)의 스탯 마일스톤 즉시 판정.
  checkStatMilestones(state);
  return {
    tweet,
    followerDelta: followers,
    unlockedMeeting,
    ddeoksang,
    ddeoksangGain,
    statChanges,
    streak,
    masteryCount,
    masteryTierUp,
  };
}

/** 트윗 작성이 가능한지(행동력 체크) */
export function canPostTweet(state: GameState): boolean {
  return state.resources.action >= tweetActionCost(state);
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
  pushTimeline(account, tweet);
  account.lastTweetDay = state.day;
  addSchedule(state, `사기 트윗 (+${earned.toLocaleString("ko-KR")}원)`, "sns");

  // 사기는 경고 누적(밴 위험) + 높은 확률로 논란 발생
  addStrike(state, 1);
  rollControversy(state, 0.5);

  if (postedSlot === LATE_SLOT) state.lateTweetToday = true;

  // 사기 트윗도 시간을 진행시키지 않는다(일반 트윗과 규칙 통일).
  return { tweet, earned };
}
