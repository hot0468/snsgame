import type { GameState, PlayerAccount, Tweet } from "@/core/types";
import type { StreamChoice, StreamEvent, StreamType, StreamTypeId } from "@/data/livestream";
import {
  CHAT_LINES,
  CHAT_NICKS,
  STREAM_EVENTS,
  STREAM_EVENT_COUNT,
  streamTypeById,
} from "@/data/livestream";
import {
  STREAM_BUZZ,
  STREAM_BUZZ_BY_TYPE,
  STREAM_RECAP_TWEETS,
  type StreamTier,
} from "@/data/streamBuzz";
import { randomName } from "@/data/accounts";
import { getActiveAccount, SLOTS_PER_DAY } from "@/core/state";
import { pick, randInt, uid } from "@/utils/random";
import { changeFollowers } from "./followers";
import { clampAction, clampResource, gainSkill } from "./stats";
import { switchAccount } from "./accountSystem";
import { postTweet } from "./tweetSystem";
import { addSchedule, advanceTime } from "./time";

/**
 * 너튜브 인방(라이브 방송) 규칙.
 *
 * 핵심 감각은 **"지금 몇 명이 보고 있다"**는 실시간 압박이다:
 * 시청자가 많을수록 채팅이 빨리 흐르고, 선택지 하나로 시청자가 우르르 늘거나 빠진다.
 *
 * ⚠️ 방송 진행 상태(현재 시청자·채팅 줄·남은 이벤트)는 **GameState에 두지 않는다** —
 *    한 번에 끝나는 세션이고, 저장 중간에 끊긴 방송을 복원할 필요가 없다(인형뽑기와 같은 판단).
 *    여기 함수들은 전부 값을 받아 값을 돌려주고, 상태를 바꾸는 건 startStream/finishStream 둘뿐이다.
 *
 * 순수 로직: DOM/표시 없음.
 */

/** 시청자 수 하한 — 팔로워 0에서도 방송이 성립해야 한다(아무도 안 보는 방송은 재미가 없다) */
export const MIN_VIEWERS = 3;

/** 스탯 보정 계수 — 관련 스탯 합계 100당 이만큼 시청자가 붙는다 */
export const SKILL_VIEWER_BONUS = 20;

/** 채팅 갱신 간격의 하한·상한(ms) */
export const CHAT_INTERVAL_MIN = 120;
export const CHAT_INTERVAL_MAX = 3_000;

/** 방송 1회로 깎이는 정신력(고정) — 방송은 진이 빠지는 일이라 매일은 못 한다 */
export const STREAM_MENTAL_COST = 12;

/** 방송 1회에 드는 행동력 — 시작 시점에 선불로 빠진다(EBS 8, 운동 25 사이의 중간 코스트) */
export const STREAM_ACTION_COST = 18;

/** 방송으로 오르는 스탯의 기본치와 상한 */
export const STREAM_SKILL_BASE = 8;
export const STREAM_SKILL_CAP = 30;

/**
 * 방송 시작 시청자 수.
 * 팔로워 규모가 주(主)이고 관련 스탯이 보정으로 붙는다.
 * ⚠️ 초반엔 자연히 몇 명뿐이라 **이것 자체가 진입 장벽**이다(별도 해금 조건을 두지 않는 이유).
 */
export function startingViewers(state: GameState, type: StreamType): number {
  const followers = getActiveAccount(state).followers;
  const skillSum = type.skills.reduce((sum, id) => sum + (state.skills[id] ?? 0), 0);
  const base = followers * type.reachFactor;
  const bonus = (skillSum / 100) * SKILL_VIEWER_BONUS;
  const jitter = 0.8 + Math.random() * 0.4; // 0.8 ~ 1.2
  return Math.max(MIN_VIEWERS, Math.round((base + bonus) * jitter));
}

/**
 * 시청자 수에 따른 채팅 갱신 간격(ms) — **반비례**.
 * 로그 스케일이라 시청자가 10배 늘 때마다 체감 속도가 한 단계씩 빨라진다.
 * ⚠️ 선형으로 하면 1,000명만 넘어도 즉시 하한에 붙어 변화를 못 느낀다.
 *   3명 ~2,630ms · 10명 ~2,220ms · 100명 ~1,440ms · 1,000명 ~660ms · 10,000명+ 120ms(하한)
 * ⚠️ 아무도 안 보는 방송은 **정말로 조용해야 한다** — 상한이 1.6초이던 시절엔 시청자 3명인
 *    방송에도 채팅이 1초에 한 줄씩 흘러 "시청자 수가 의미 없다"는 인상을 줬다.
 */
export function chatInterval(viewers: number): number {
  const raw = CHAT_INTERVAL_MAX - Math.log10(Math.max(1, viewers)) * 780;
  return Math.round(Math.max(CHAT_INTERVAL_MIN, Math.min(CHAT_INTERVAL_MAX, raw)));
}

/** 채팅 한 줄 */
export interface ChatLine {
  nick: string;
  text: string;
}

/**
 * 이번 차례에 채팅이 올라올 확률.
 * ⚠️ 간격만 늘려서는 "시청자 3명인데 채팅은 쉼 없이 흐르는" 그림을 못 없앤다 —
 *    간격을 더 늘리면 선택지(채팅 6줄마다)까지 하염없이 밀리기 때문이다.
 *    그래서 차례는 그대로 돌리되 **대부분의 차례를 침묵으로 흘려보낸다.**
 *   3명 ~32% · 10명 ~48% · 100명 ~78% · 500명+ 100%
 */
export function chatChance(viewers: number): number {
  return Math.min(1, 0.18 + Math.log10(Math.max(1, viewers)) * 0.3);
}

/**
 * 타입에 맞는 채팅 한 줄을 뽑는다.
 *
 * ⚠️ **말하는 사람 수는 시청자 수를 넘을 수 없다** — 3명이 보는 방송에 매번 다른 닉네임이
 *    뜨면 시청자 수가 거짓말처럼 보인다. 앞에서부터 시청자 수만큼만 잘라 쓰므로
 *    소규모 방송에서는 같은 몇 명이 반복해 말한다(실제 방송의 결).
 * `prevText`를 주면 바로 앞줄과 같은 문구는 한 번 다시 뽑는다(연속 중복 방지).
 */
export function rollChatLine(
  typeId: StreamTypeId,
  viewers: number,
  prevText?: string,
): ChatLine {
  const talkers = Math.max(1, Math.min(CHAT_NICKS.length, viewers));
  const lines = CHAT_LINES[typeId];
  let text = pick(lines);
  if (text === prevText) text = pick(lines);
  return { nick: pick(CHAT_NICKS.slice(0, talkers)), text };
}

/**
 * 채팅이 한 번 흐를 때의 자연 시청자 변동(-2% ~ +3%).
 * 살짝 우상향이라 가만히 둬도 아주 조금씩 는다 — 방송이 굴러가는 느낌을 준다.
 */
export function driftViewers(viewers: number): number {
  const pct = -0.02 + Math.random() * 0.05;
  return Math.max(1, Math.round(viewers * (1 + pct)));
}

/**
 * 선택지 결과를 시청자 수에 적용한다(비율 증감).
 * ⚠️ 1명 아래로 내려가지 않는다 — 시청자 0은 방송이 성립하지 않는다.
 */
export function applyChoiceViewers(viewers: number, choice: StreamChoice): number {
  return Math.max(1, Math.round(viewers * (1 + choice.viewerDelta)));
}

/**
 * 이 방송 타입에서 나올 수 있는 이벤트 풀.
 * `types`가 없는 이벤트는 공용이라 전 타입에서 나온다.
 */
export function eventsForType(typeId: StreamTypeId): StreamEvent[] {
  return STREAM_EVENTS.filter((e) => !e.types || e.types.includes(typeId));
}

/**
 * 이번 방송에서 쓸 이벤트를 순서대로 뽑는다(중복 없이 STREAM_EVENT_COUNT개).
 * 풀이 모자라면 있는 만큼만 준다.
 */
export function rollEventSequence(typeId: StreamTypeId): StreamEvent[] {
  const pool = [...eventsForType(typeId)];
  const out: StreamEvent[] = [];
  for (let i = 0; i < STREAM_EVENT_COUNT && pool.length > 0; i++) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

/* ============================================================
 * 방송 활동명 · 방송 전용 계정
 * ============================================================ */

/** 활동명 최대 길이 — 검색창·트윗 본문에 그대로 박히므로 길면 문장이 깨진다(필명과 같은 규격) */
export const STREAM_NAME_MAX = 12;

/** 방송 전용 계정에 방송 후기를 올릴 때 팔로워 배수 */
export const DEDICATED_FOLLOWER_MULT = 2.5;

/** 이름 비교용 정규화 — 공백·@·대소문자 차이로 전용 계정 판정이 어긋나지 않게 한다 */
function normName(s: string): string {
  return s.replace(/^@/, "").replace(/\s+/g, "").toLowerCase();
}

/** 이 방송 타입의 활동명(아직 안 정했으면 빈 문자열) */
export function streamName(state: GameState, typeId: StreamTypeId): string {
  return state.streamNames[typeId] ?? "";
}

/** 방송 활동명을 정한다(빈 값은 무시 — 이름 없는 방송은 검색이 성립하지 않는다) */
export function setStreamName(state: GameState, typeId: StreamTypeId, name: string): void {
  const trimmed = name.trim().slice(0, STREAM_NAME_MAX);
  if (!trimmed) return;
  state.streamNames[typeId] = trimmed;
}

/**
 * 이 방송 타입의 **방송 전용 계정** — 계정명이 활동명과 같은 SNS 계정.
 * 없으면 undefined(그냥 활성 계정에 올리면 된다).
 */
export function dedicatedAccount(
  state: GameState,
  typeId: StreamTypeId,
): PlayerAccount | undefined {
  const name = streamName(state, typeId);
  if (!name) return undefined;
  return state.accounts.find((a) => normName(a.name) === normName(name));
}

/**
 * 지금 방송을 켤 수 있는지 — 남은 타임블록과 행동력이 있어야 한다(canAcceptWork와 같은 계약).
 * ⚠️ 별도 해금 조건은 없다. 시청자 수 자체가 진입 장벽이다(startingViewers 참고).
 * ⚠️ 활동명은 여기서 보지 않는다 — 없으면 ui가 정하게 시키고 곧바로 방송으로 이어진다.
 */
export function canStream(state: GameState): boolean {
  return (
    !state.gameOver &&
    SLOTS_PER_DAY - state.slot > 0 &&
    state.resources.action >= STREAM_ACTION_COST
  );
}

/**
 * 방송을 시작한다 — 타임블록 1칸과 행동력을 소비하고 누적 횟수를 올린다.
 * ⚠️ 호출 전에 ui가 canStream으로 확인해야 한다.
 */
export function startStream(state: GameState, type: StreamType): void {
  state.resources.action = clampAction(state, state.resources.action - STREAM_ACTION_COST);
  state.streamCount += 1;
  addSchedule(state, `인방 시작: ${type.label}`, "system");
  advanceTime(state, 1);
}

/** 선택지 하나의 정신력 효과를 적용한다(없으면 무시) */
export function applyChoiceMental(state: GameState, choice: StreamChoice): void {
  if (!choice.mental) return;
  state.resources.mental = clampResource(state.resources.mental + choice.mental);
}

/** 방송 종료 정산 결과 */
export interface StreamResult {
  /** 최종 시청자 수 */
  viewers: number;
  /** 얻은 팔로워 */
  followers: number;
  /** 받은 후원금(원) */
  donation: number;
  /** 오른 스탯의 실제 반영량(감쇠·상한 반영) */
  skillGain: number;
  /** 오른 스탯 id */
  skillId: StreamType["gainSkill"];
  /** 이 방송이 그 타입의 최고 시청자 기록을 갈아치웠는지 */
  isBest: boolean;
  /** 갱신 후의 그 타입 최고 기록 */
  best: number;
}

/**
 * 방송을 마치고 정산한다.
 * 최종 시청자 수에 비례해 팔로워·후원금이 들어오고, 관련 스탯이 오르며, 정신력이 깎인다.
 *
 * ⚠️ 팔로워는 반드시 changeFollowers를 거친다 — 승리 판정·게시슬롯 동기화가 거기 걸려 있다.
 */
export function finishStream(
  state: GameState,
  type: StreamType,
  viewers: number,
): StreamResult {
  const followers = Math.round(viewers * type.followerRate);
  const donation = Math.round(viewers * type.donationPerViewer);
  const skillAmount = Math.min(STREAM_SKILL_CAP, STREAM_SKILL_BASE + Math.floor(viewers / 500));

  if (followers > 0) changeFollowers(state, followers);
  state.money += donation;
  const skillGain = gainSkill(state, type.gainSkill, skillAmount);
  state.resources.mental = clampResource(state.resources.mental - STREAM_MENTAL_COST);

  // 최고 시청자 기록 갱신(raceBests 패턴 — 기록한 타입만 키가 생긴다)
  const prevBest = state.streamBests[type.id] ?? 0;
  const isBest = viewers > prevBest;
  if (isBest) state.streamBests[type.id] = viewers;
  const best = state.streamBests[type.id] ?? prevBest;

  addSchedule(
    state,
    `인방 종료: 시청자 ${viewers.toLocaleString()}명 · 팔로워 +${followers} · 후원 ${donation.toLocaleString()}원`,
    "system",
  );
  if (isBest) {
    addSchedule(state, `🏆 ${type.label} 최고 시청자 신기록: ${viewers.toLocaleString()}명`, "system");
  }

  return { viewers, followers, donation, skillGain, skillId: type.gainSkill, isBest, best };
}

/* ============================================================
 * 활동명 검색 반응 · 방송 후기 트윗
 * ============================================================ */

/**
 * 이 방송 타입의 인기 구간 — **최고 시청자 기록**으로 정한다.
 * 오늘 방송이 망해도 예전에 5만을 찍었으면 검색 반응은 대형 스트리머의 것이어야 한다.
 */
export function streamBuzzTier(state: GameState, typeId: StreamTypeId): StreamTier {
  const best = state.streamBests[typeId] ?? 0;
  if (best < 50) return 0;
  if (best < 500) return 1;
  if (best < 5_000) return 2;
  return 3;
}

/**
 * 방송 활동명 검색 결과로 뜨는 시청자 반응 트윗(웹툰 필명 검색과 같은 결).
 * 검색어와 같은 활동명이 없으면 빈 배열 — 호출부(exploreSystem)가 그냥 이어붙이면 된다.
 *
 * 인기 구간이 높을수록 더 많이 뜬다(0~3 → 1~4개). 화제성이 곧 트윗 수라는 직관과 맞다.
 */
export function streamBuzzTweets(state: GameState, query: string): Tweet[] {
  const q = normName(query);
  if (!q) return [];
  const hit = Object.keys(state.streamNames).find(
    (id) => normName(state.streamNames[id] ?? "") === q,
  ) as StreamTypeId | undefined;
  // 방송을 한 번도 안 켠 활동명은 검색해도 아무 반응이 없다(이름만 지어둔 상태).
  if (!hit || !(hit in state.streamBests)) return [];

  const name = state.streamNames[hit];
  const tier = streamBuzzTier(state, hit);
  const pool = [...STREAM_BUZZ[tier], ...STREAM_BUZZ_BY_TYPE[hit]];
  const count = Math.min(tier + 1, pool.length);
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);

  return shuffled.map((line) => {
    const viewer = randomName();
    return {
      id: uid("sbuzz"),
      authorName: viewer.name,
      authorHandle: viewer.handle,
      attribute: "gaming" as const,
      isAdult: false,
      text: line.replaceAll("{name}", name),
      createdDay: state.day,
      // 구간이 높을수록 반응 수치도 커진다(무명 방송에 1만 좋아요가 붙으면 거짓말이 된다).
      likes: randInt(2, 60) * (tier + 1) * (tier + 1),
      retweets: randInt(0, 15) * (tier + 1),
      gainedFollowers: 0,
    };
  });
}

/** 방송 후기 트윗 결과 */
export interface StreamTweetResult {
  /** 실제로 올라간 계정 */
  account: PlayerAccount;
  /** 방송 전용 계정에 올렸는지(팔로워 배수가 붙었는지) */
  dedicated: boolean;
  /** 늘어난 팔로워(떡상 보너스 포함) */
  followers: number;
  /** 올라간 본문 */
  text: string;
}

/**
 * 방송이 끝나고 후기 트윗을 올린다.
 *
 * ⚠️ **전용 계정이 있으면 그 계정으로 갈아타서 올린다** — 방송 이름을 내건 계정에
 *    방송 얘기를 올리는 게 자연스럽고, 플레이어에게 계정 전환을 따로 시키면
 *    "전용 계정을 만들었는데 왜 보너스가 없냐"는 함정이 된다.
 * ⚠️ 행동력은 받지 않는다(free) — 방송 자체가 이미 행동력을 냈다.
 */
export function postStreamTweet(
  state: GameState,
  type: StreamType,
  viewers: number,
): StreamTweetResult {
  const dedi = dedicatedAccount(state, type.id);
  if (dedi) switchAccount(state, dedi.id);
  const account = getActiveAccount(state);
  const text = pick(STREAM_RECAP_TWEETS[type.id]).replaceAll(
    "{viewers}",
    viewers.toLocaleString(),
  );
  const posted = postTweet(state, account.attribute, text, false, "meetup", dedi ? DEDICATED_FOLLOWER_MULT : 1, { free: true });
  addSchedule(
    state,
    `방송 후기 게시${dedi ? ` (방송 전용 계정 @${account.handle})` : ""}: 팔로워 +${
      posted.followerDelta + posted.ddeoksangGain
    }`,
    "sns",
  );
  return {
    account,
    dedicated: Boolean(dedi),
    followers: posted.followerDelta + posted.ddeoksangGain,
    text,
  };
}

export { streamTypeById };
