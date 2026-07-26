import type { GameState, Tweet } from "@/core/types";
import { getActiveAccount, pushTimeline } from "@/core/state";
import {
  TCHIN_THRESHOLD,
  TCHIN_REACH,
  TCHIN_CAP,
  TCHIN_BOOST_CHANCE,
  TCHIN_BOOST_MIN,
  TCHIN_BOOST_MAX,
  TCHIN_CHEER_CHATS,
} from "@/data/tchin";
import {
  TCHINSO_COOLDOWN_DAYS,
  TCHINSO_PREFILL_MIN,
  TCHINSO_PREFILL_MAX,
  TCHINSO_RESP_MIN,
  TCHINSO_RESP_MAX,
  TCHINSO_TWEET_TEXT,
} from "@/data/tchinso";
import {
  BIRTHDAY_MIN_DAYS,
  BIRTHDAY_MAX_DAYS,
  BIRTHDAY_BONUS_MIN,
  BIRTHDAY_BONUS_MAX,
  BIRTHDAY_TWEET_LINES,
} from "@/data/birthday";
import { makeRandomAccount } from "@/data/accounts";
import { changeFollowers } from "./followers";
import { consumePostSlot } from "./eggs";
import { clampAction } from "./stats";
import { pushKakao } from "./kakao";
import { addSchedule } from "./time";
import { addAppointment } from "./appointments";
import { TWEET_ACTION_COST } from "./tweetSystem";
import { chance, hashInt, pick, randInt, uid } from "@/utils/random";

/**
 * 트친(단짝) — 사회적 온기 + 성장 축.
 *
 * 같은 계정(핸들)과 상호작용(좋아요/RT/인용/DM)을 임계치만큼 쌓으면 그 계정이 트친이 된다.
 * 트친 수만큼 '기본 도달'이 오른다(모든 트윗 팔로워 증가분에 배율). 판정은 계정별로 따로 센다.
 */

export type TchinBump = "became" | "progress" | "already";

/**
 * 핸들과의 상호작용을 1회 누적한다.
 * - 이미 트친이면 카운터를 건드리지 않고 "already".
 * - 임계치를 이번에 넘겨 새로 성사되면 "became"(호출부가 알림).
 * - 그 외엔 "progress".
 */
export function bumpTchinProgress(state: GameState, handle: string, name?: string): TchinBump {
  const account = getActiveAccount(state);
  if (account.tchins.includes(handle)) return "already";

  const next = (account.tchinProgress[handle] ?? 0) + 1;
  account.tchinProgress[handle] = next;
  if (next >= TCHIN_THRESHOLD) {
    account.tchins.push(handle);
    // 표시용 계정명 기억(없으면 나중에 @핸들로 폴백). 카톡·일정에 @아이디 대신 이름을 쓰기 위함.
    if (name) account.tchinNames[handle] = name;
    state.pendingTchinToasts.push(handle);
    // 성사 즉시 이 트친의 생일을 결정론적으로 달력에 예약(도래 처리는 onNewDay).
    scheduleBirthday(state, handle);
    return "became";
  }
  return "progress";
}

/** 활성 계정의 트친 수에 따른 도달 배율(1 이상). 트윗 팔로워 증가분에만 곱한다. */
export function tchinReachMult(state: GameState): number {
  const account = getActiveAccount(state);
  const effective = Math.min(account.tchins.length, TCHIN_CAP);
  return 1 + effective * TCHIN_REACH;
}

/** 양수 팔로워 증가분에 도달 배율을 적용(감소분은 그대로). 트윗 게시 경로에서 쓴다. */
export function applyTchinReach(state: GameState, gain: number): number {
  return gain > 0 ? Math.round(gain * tchinReachMult(state)) : gain;
}

/**
 * 트윗 게시 후 낮은 확률로 트친 1명이 내 최근 트윗을 리트윗해 띄워준다(보너스 팔로워 + 응원 카톡).
 * 상태 변경(팔로워·카톡·스케줄)만 하고 값을 반환하지 않는다 — 연출은 없다.
 */
export function maybeSpawnTchinBoost(state: GameState): void {
  const account = getActiveAccount(state);
  if (account.tchins.length === 0) return;
  if (!chance(TCHIN_BOOST_CHANCE)) return;

  const handle = pick(account.tchins);
  const bonus = randInt(TCHIN_BOOST_MIN, TCHIN_BOOST_MAX);
  changeFollowers(state, bonus);
  // 표시는 계정명으로(없는 구세이브만 @핸들 폴백). 응원 카톡은 자연스러운 대화 한 세트로 연다.
  const name = account.tchinNames[handle] ?? `@${handle}`;
  const chat = pick(TCHIN_CHEER_CHATS);
  pushKakao(state, name, chat.opener, { hue: 200, reply: chat.reply });
  addSchedule(state, `트친 ${name}의 리트윗 (+${bonus} 팔로워)`, "sns");
}

/* ─────────────────── 트친 생일 ─────────────────── */

/**
 * 트친 성사 시점에 그 트친의 생일을 달력에 예약한다.
 * 생일 날짜는 hashInt(handle)로 결정론 산출(같은 핸들은 항상 같은 오프셋) —
 * 성사일 + BIRTHDAY_MIN_DAYS ~ 성사일 + BIRTHDAY_MAX_DAYS 사이 하루.
 * 이미 같은 handle의 birthday 약속이 있으면 스킵(중복 방지).
 * birthday는 비차단 약속(dueAppointments에서 제외) — 도래 처리는 onNewDay가 한다.
 */
export function scheduleBirthday(state: GameState, handle: string): void {
  const already = state.appointments.some(
    (a) => a.kind === "birthday" && a.partnerName === handle,
  );
  if (already) return;
  const span = BIRTHDAY_MAX_DAYS - BIRTHDAY_MIN_DAYS;
  const day = state.day + BIRTHDAY_MIN_DAYS + (hashInt(handle) % span);
  addAppointment(state, {
    day,
    slot: 0,
    kind: "birthday",
    title: `@${handle} 생일`,
    partnerName: handle,
  });
}

/**
 * 오늘 생일인 트친(state.pendingBirthday)에게 축하 트윗을 무료로 게시한다.
 * 일반 트윗과 달리 행동력·게시 슬롯을 소모하지 않는다(pushTimeline만) — 순수 사교 보너스.
 * 보너스 팔로워를 얻고 pendingBirthday를 클리어한다. pendingBirthday가 없으면 무동작.
 */
export function sendBirthdayTweet(state: GameState): void {
  const handle = state.pendingBirthday;
  if (!handle) return;
  const account = getActiveAccount(state);
  const tweet: Tweet = {
    id: uid("bday"),
    authorName: account.name,
    authorHandle: account.handle,
    attribute: "daily",
    isAdult: false,
    text: pick(BIRTHDAY_TWEET_LINES).replace("{handle}", handle),
    createdDay: state.day,
    likes: 0,
    retweets: 0,
    gainedFollowers: 0,
  };
  pushTimeline(account, tweet);
  const bonus = randInt(BIRTHDAY_BONUS_MIN, BIRTHDAY_BONUS_MAX);
  changeFollowers(state, bonus);
  tweet.gainedFollowers = bonus;
  state.pendingBirthday = null;
}

/** 트친소 결과 — 응답 계정별 이름·핸들·트친까지 남은 상호작용 횟수. ui가 결과 목록으로 쓴다. */
export interface TchinsoResult {
  responders: { name: string; handle: string; remaining: number }[];
}

/**
 * 트친소(트친 소개) 트윗을 올릴 수 있는가.
 * 첫 사용(lastTchinsoDay===0)이거나 마지막 게시 후 쿨다운(주 1회)이 지났으면 가능.
 */
export function canPostTchinso(state: GameState): boolean {
  const account = getActiveAccount(state);
  return (
    account.lastTchinsoDay === 0 ||
    state.day - account.lastTchinsoDay >= TCHINSO_COOLDOWN_DAYS
  );
}

/**
 * 트친소 트윗을 게시한다. 응답 계정 2~4명(친화력↑ 시 최대 +2)이 등장하고,
 * 각 응답 계정의 트친 진행도를 선채움한다(트친 성사에 유리한 출발점).
 * 트윗은 pushTimeline으로 게시하고 행동력·게시 슬롯을 일반 트윗과 동일하게 소모한다.
 */
export function postTchinso(state: GameState): TchinsoResult {
  const account = getActiveAccount(state);

  // 비용(일반 트윗과 동일)
  state.resources.action = clampAction(state, state.resources.action - TWEET_ACTION_COST);
  consumePostSlot(state);

  // 응답 계정 수: 기본 2~4, 친화력 300당 상한 +1(최종 상한 RESP_MAX+2).
  const bonus = Math.floor(state.skills.sociability / 300);
  const respMax = Math.min(TCHINSO_RESP_MAX + bonus, TCHINSO_RESP_MAX + 2);
  const targetCount = randInt(TCHINSO_RESP_MIN, respMax);

  const responders: TchinsoResult["responders"] = [];
  const seen = new Set<string>();
  // 중복 핸들·이미 트친인 계정은 건너뛴다. 무한 루프 방지로 시도 횟수를 제한한다.
  for (let attempt = 0; attempt < targetCount * 5 && responders.length < targetCount; attempt++) {
    const cand = makeRandomAccount(state.adultMode, state.day);
    if (seen.has(cand.handle)) continue;
    if (account.tchins.includes(cand.handle)) continue;
    seen.add(cand.handle);

    const progress =
      (account.tchinProgress[cand.handle] ?? 0) + randInt(TCHINSO_PREFILL_MIN, TCHINSO_PREFILL_MAX);
    account.tchinProgress[cand.handle] = progress;
    responders.push({
      name: cand.name,
      handle: cand.handle,
      remaining: Math.max(0, TCHIN_THRESHOLD - progress),
    });
  }

  // 트친소 트윗 게시(사교 목적 — 팔로워 효과는 없다).
  const tweet: Tweet = {
    id: uid("tchinso"),
    authorName: account.name,
    authorHandle: account.handle,
    attribute: "daily",
    isAdult: false,
    text: pick(TCHINSO_TWEET_TEXT),
    createdDay: state.day,
    likes: 0,
    retweets: 0,
    gainedFollowers: 0,
  };
  pushTimeline(account, tweet);
  account.lastTweetDay = state.day;
  account.lastTchinsoDay = state.day;

  return { responders };
}
