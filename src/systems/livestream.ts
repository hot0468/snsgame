import type { GameState } from "@/core/types";
import type { StreamChoice, StreamEvent, StreamType, StreamTypeId } from "@/data/livestream";
import {
  CHAT_LINES,
  CHAT_NICKS,
  STREAM_EVENTS,
  STREAM_EVENT_COUNT,
  streamTypeById,
} from "@/data/livestream";
import { getActiveAccount, SLOTS_PER_DAY } from "@/core/state";
import { pick } from "@/utils/random";
import { changeFollowers } from "./followers";
import { clampResource, gainSkill } from "./stats";
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
export const CHAT_INTERVAL_MAX = 1_600;

/** 방송 1회로 깎이는 정신력(고정) — 방송은 진이 빠지는 일이라 매일은 못 한다 */
export const STREAM_MENTAL_COST = 12;

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
 *   10명 ~1,220ms · 100명 ~840ms · 1,000명 ~460ms · 10,000명+ 120ms(하한)
 */
export function chatInterval(viewers: number): number {
  const raw = CHAT_INTERVAL_MAX - Math.log10(Math.max(1, viewers)) * 380;
  return Math.round(Math.max(CHAT_INTERVAL_MIN, Math.min(CHAT_INTERVAL_MAX, raw)));
}

/** 채팅 한 줄 */
export interface ChatLine {
  nick: string;
  text: string;
}

/** 타입에 맞는 채팅 한 줄을 뽑는다 */
export function rollChatLine(typeId: StreamTypeId): ChatLine {
  return { nick: pick(CHAT_NICKS), text: pick(CHAT_LINES[typeId]) };
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

/**
 * 지금 방송을 켤 수 있는지 — 남은 타임블록이 있어야 한다(canAcceptWork와 같은 계약).
 * ⚠️ 별도 해금 조건은 없다. 시청자 수 자체가 진입 장벽이다(startingViewers 참고).
 */
export function canStream(state: GameState): boolean {
  return !state.gameOver && SLOTS_PER_DAY - state.slot > 0;
}

/**
 * 방송을 시작한다 — 타임블록 1칸을 소비하고 누적 횟수를 올린다.
 * ⚠️ 호출 전에 ui가 canStream으로 확인해야 한다.
 */
export function startStream(state: GameState, type: StreamType): void {
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

  addSchedule(
    state,
    `인방 종료: 시청자 ${viewers.toLocaleString()}명 · 팔로워 +${followers} · 후원 ${donation.toLocaleString()}원`,
    "system",
  );

  return { viewers, followers, donation, skillGain, skillId: type.gainSkill };
}

export { streamTypeById };
