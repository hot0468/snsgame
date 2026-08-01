import type { DMThread, Email, GameState } from "@/core/types";
import { MORNING_SLOT, getActiveAccount, pushEmail } from "@/core/state";
import {
  ARREST_MAIL_BODY,
  ARREST_MAIL_FROM,
  ARREST_MAIL_SUBJECT,
  LAB_ARREST_NOTICE,
  LAB_SHIFT_LINES,
  TUCKER_ACCEPT_REPLY,
  TUCKER_HANDLE,
  TUCKER_NAME,
  TUCKER_OPENER,
  TUCKER_REFUSE_REPLY,
} from "@/data/lab";
import { randInt, uid } from "@/utils/random";
import { isWeekday } from "./calendar";
import { clampAction, clampMental, clampResource, gainSkill } from "./stats";
import { addSchedule, advanceTime } from "./time";

/**
 * 터커 연구실 체인.
 *
 * 흐름: 국가연금술사(alchemist) 취득 → 합격이 확정된 뒤 **랜덤일**(3~14일)에 '터커' DM 도착
 *      → 수락하면 평일 저녁이 강제 연구실 출근이 된다 → **5회째 출근에 터커 체포**로 라인 종료.
 *
 * ⚠️ time.ts ↔ lab.ts는 순환 import다(time이 onNewDay 훅을, lab이 advanceTime을 쓴다).
 *    employment.ts와 **완전히 같은 구조**이며, 양쪽 다 함수 선언(호이스팅)이라 초기화 시점에
 *    서로를 평가하지 않는다. 모듈 최상위에서 상대 모듈의 값을 읽지 않는 한 안전하다.
 */

/** 국가연금술사 자격증 id — ⚠️ data/certifications.ts의 id와 반드시 일치해야 한다 */
export const ALCHEMIST_CERT_ID = "alchemist";

/** 합격 후 터커 DM이 오기까지의 최소/최대 일수(이 범위에서 한 번만 추첨해 확정한다) */
export const TUCKER_DM_MIN_DELAY = 3;
export const TUCKER_DM_MAX_DELAY = 14;

/** 총 출근 횟수 — 이 횟수째 출근에서 터커가 체포되고 라인이 끝난다 */
export const LAB_TOTAL_SHIFTS = 5;

/**
 * 출근 1회당 스탯 변화.
 * ⚠️ 행동력은 상한이 **가변**이다 → clampAction(state, v). clampResource를 쓰면 치트 보너스가 깎인다.
 * ⚠️ 도덕성·정신력은 **리소스(0~100)** 다 → clampResource, ×10 하지 않는다.
 * ⚠️ 지식은 **스킬(0~999)** 이다 → clampSkill. 획득량은 ×5 규칙을 반영한 값이다
 *    (구 스케일 +12/회 상당 → 60). 5회 완주 시 지식 +300, 도덕성 -40, 정신력 -60.
 */
export const LAB_MORALITY_COST = 8;
export const LAB_MENTAL_COST = 12;
export const LAB_KNOWLEDGE_GAIN = 60;
/** 출근 1회당 행동력 소모 — 회사 근무(WORK_ACTION_COST)와 같은 값이다 */
export const LAB_ACTION_COST = 15;

/**
 * 국가연금술사에 합격했으면 터커 DM 도착일을 **한 번만** 추첨해 확정 저장한다.
 * onNewDay에서 deliverExamResultEmail(합격 반영) **다음에** 호출된다.
 *
 * ⚠️ `tuckerDmDay !== null`이면 즉시 반환하는 것이 이 함수의 핵심이다 — 매 호출 재추첨하면
 *    도착일이 계속 미래로 밀려 DM이 영원히 오지 않는다.
 */
export function maybeStartTuckerLine(state: GameState): void {
  const lab = state.lab;
  if (lab.tuckerDmDay !== null) return; // 이미 확정됨 — 재추첨 금지
  if (lab.offer !== "none") return;
  if (!(state.certifications ?? []).includes(ALCHEMIST_CERT_ID)) return;
  lab.tuckerDmDay = state.day + randInt(TUCKER_DM_MIN_DELAY, TUCKER_DM_MAX_DELAY);
}

/**
 * 확정된 도착일이 되면 '터커' DM 스레드를 만든다(onNewDay에서 호출).
 * ⚠️ 기존 DM 스레드 구조를 그대로 재사용한다 — 별도 화면 없이 기존 DM UI로 렌더된다
 *    (금발의 신사 eyeDeal 선례).
 * ⚠️ `state.day >= tuckerDmDay`로 판정한다(`===`가 아니다) — 그날을 어떤 이유로든 건너뛰어도
 *    DM이 영원히 유실되지 않는다.
 */
export function maybeSpawnTuckerDM(state: GameState): void {
  if (state.gameOver) return;
  const lab = state.lab;
  if (lab.offer !== "none") return; // 이미 제안했거나 처리됨
  if (lab.tuckerDmDay === null) return; // 아직 합격 전
  if (state.day < lab.tuckerDmDay) return; // 아직 그날이 아님

  const thread: DMThread = {
    id: uid("dm"),
    partnerName: TUCKER_NAME,
    partnerHandle: TUCKER_HANDLE,
    attribute: "daily",
    isAdult: false,
    messages: [{ id: uid("dmm"), from: "partner", text: TUCKER_OPENER, day: state.day }],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    labOffer: true,
  };
  getActiveAccount(state).dms.unshift(thread);
  lab.offer = "offered";
  addSchedule(state, "터커에게서 DM이 왔다", "sns");
}

/**
 * 터커의 조수 제안에 답한다(수락/거절). eyeDeal 선례대로 기존 DM UI 안에서 호출된다.
 * - 수락 → 평일 저녁 강제 출근 시작(isLabNow).
 * - 거절 → 라인 종료. **재제안은 없다**(offer가 "refused"로 굳어 maybeSpawnTuckerDM이 막힌다).
 * @returns 처리했으면 true, 제안 대기 상태가 아니면 false
 */
export function resolveLabOffer(state: GameState, accept: boolean): boolean {
  const lab = state.lab;
  if (lab.offer !== "offered") return false;

  const thread = getActiveAccount(state).dms.find((t) => t.labOffer);
  lab.offer = accept ? "accepted" : "refused";
  thread?.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: accept ? TUCKER_ACCEPT_REPLY : TUCKER_REFUSE_REPLY,
    day: state.day,
  });
  if (thread) thread.unread = true;
  addSchedule(
    state,
    accept ? "터커의 부탁을 수락했다" : "터커의 부탁을 거절했다",
    "sns",
  );
  return true;
}

/**
 * 지금이 강제 연구실 출근 시간인지(평일 낮 + 수락함 + 5회 미만 + 미종료).
 * isWorkNow 선례를 따른다.
 *
 * ⚠️ app.ts 강제 화면 체인에서 **isWorkNow보다 먼저** 판정해야 한다(연구실 우선).
 *    그래야 같은 낮 슬롯에서 회사 근무보다 연구실이 이긴다.
 */
export function isLabNow(state: GameState): boolean {
  const lab = state.lab;
  if (state.gameOver) return false;
  if (lab.offer !== "accepted") return false;
  if (lab.done) return false;
  if (lab.shifts >= LAB_TOTAL_SHIFTS) return false;
  if (!isWeekday(state.day)) return false;
  return state.slot === MORNING_SLOT;
}

export interface LabShiftResult {
  /** 화면에 띄울 출근 묘사. 5회째면 체포 소식(LAB_ARREST_NOTICE)이 이어 붙는다 */
  message: string;
  /** 이번 출근이 몇 회째인지(1..LAB_TOTAL_SHIFTS) */
  shifts: number;
  /** 이번 출근에서 터커가 체포되어 라인이 끝났는지 */
  arrested: boolean;
  /** 이번 출근으로 오른 지식(표시용) */
  knowledgeGain: number;
}

/**
 * 연구실 출근 한 블록을 처리한다.
 * 도덕성·정신력이 깎이고 지식이 대폭 오른다. **이유는 설명하지 않는다**(계약서 F).
 *
 * ⚠️ 5회째 출근에서 터커가 체포된다. 체포 소식은 **반환 message에 이어 붙어** 플레이어가
 *    보고 있는 그 화면에 그대로 표시된다 — 조용히 출근만 사라지지 않게 하는 1차 보장이다.
 *    수신함 메일은 나중에 다시 확인할 수 있는 2차 기록이다.
 */
export function doLabShift(state: GameState): LabShiftResult {
  const lab = state.lab;
  lab.shifts += 1;

  // 행동력은 상한이 가변(치트 +20) — clampAction. 도덕성·정신력은 고정 0~100 — clampResource.
  // 지식은 스킬(0~999) — clampSkill.
  state.resources.action = clampAction(state, state.resources.action - LAB_ACTION_COST);
  state.resources.morality = clampResource(state.resources.morality - LAB_MORALITY_COST);
  state.resources.mental = clampMental(state, state.resources.mental - LAB_MENTAL_COST);
  // 지식은 스킬(0~999) — 반복 근무형 육성이므로 gainSkill 관문(정신력 배율·감쇠)을 거친다.
  gainSkill(state, "knowledge", LAB_KNOWLEDGE_GAIN);

  const arrested = lab.shifts >= LAB_TOTAL_SHIFTS;
  // 데이터가 짧아도 크래시하지 않게 마지막 문구로 폴백한다.
  let message =
    LAB_SHIFT_LINES[lab.shifts - 1] ?? LAB_SHIFT_LINES[LAB_SHIFT_LINES.length - 1] ?? "";

  addSchedule(state, `터커 연구실 (${lab.shifts}/${LAB_TOTAL_SHIFTS})`, "offline");

  if (arrested) {
    lab.done = true;
    message += `\n\n${LAB_ARREST_NOTICE}`;
    // ⚠️ 정보 전달 전용 메일 — jobOffer/adOffer/spam은 절대 세팅하지 않는다.
    const email: Email = {
      id: uid("mail"),
      from: ARREST_MAIL_FROM,
      subject: ARREST_MAIL_SUBJECT,
      body: ARREST_MAIL_BODY,
      day: state.day,
      read: false,
    };
    pushEmail(state, email);
    addSchedule(state, "터커 박사 체포 — 연구실 폐쇄", "system");
  }

  advanceTime(state, 1);
  return { message, shifts: lab.shifts, arrested, knowledgeGain: LAB_KNOWLEDGE_GAIN };
}
