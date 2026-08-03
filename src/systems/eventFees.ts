import type { Appointment, GameState } from "@/core/types";
import { appendSchedule } from "@/core/state";
import { uid } from "@/utils/random";

/**
 * 행사 참가비 — '행사에 간다'는 선택은 행동력만이 아니라 **돈**도 든다.
 *
 * 구조: 행사마다 **기본 요금**이 있고, 코믹콘처럼 참여 방식이 갈리는 행사는
 * 기본 입장료에 **방식별 추가 요금**이 얹힌다(부스비·탈의실 대여료).
 * 즉 부스 참가 실비 = 입장료 + 부스비다.
 *
 * ⚠️ 이 파일은 순수 로직이다. UI(appointmentModal 등)는 `canAffordEventFee`로 버튼을
 *    잠그고, 실제 진행 직전에 `payEventFee`를 불러 차감한다. 차감은 반드시 한 번만.
 *
 * 금액 근거(2026-08 밸런스 기준):
 * - 초기 소지금 500,000원 / 일일 생활비 10,000원 / 음원CD 18,000원 / 바디프로필 200,000원.
 * - 행사 요금은 "하루 생활비 ~ 며칠치" 구간에 두어, 초반엔 부담이지만 알바 몇 번이면 갈 수 있게 한다.
 */

/* ─────────────────── 코믹콘 ─────────────────── */

/** 코믹콘 기본 입장료 — 참여 방식과 무관하게 누구나 낸다(하루 생활비 1.5배). */
export const COMICCON_ENTRY_FEE = 15_000;

/** 부스 참가 시 추가로 내는 부스(테이블) 사용료. 판매 수익으로 회수하는 구조라 회수 가능한 규모. */
export const COMICCON_BOOTH_FEE = 40_000;

/**
 * 코스프레 참가 시 추가로 내는 탈의실·락커 대여료.
 * 의상 관리·분장 공간까지 빌리는 값이라 코믹콘 3종 중 **가장 비싸다**.
 * 노출 코스프레는 개인 탈의실이 필요해 여기서 더 붙는다(COMICCON_COSPLAY_LEWD_FEE).
 */
export const COMICCON_COSPLAY_FEE = 80_000;

/** 노출 코스프레 — 개인 탈의실 + 전용 동선 확보로 일반 코스프레보다 비싸다. */
export const COMICCON_COSPLAY_LEWD_FEE = 120_000;

/** 코믹콘 참여 방식(ComicconMode와 같은 키 — systems/appointments.ComicconMode 참조) */
export type ComicconFeeMode = "visitor" | "booth" | "cosplay" | "cosplayLewd";

/**
 * 코믹콘 참여 방식별 **추가** 요금(입장료 제외).
 * ⚠️ `ComicconMode`에 값을 추가하면 여기도 채워야 한다(Record 전수 — typecheck가 잡는다).
 */
export const COMICCON_MODE_FEES: Record<ComicconFeeMode, number> = {
  visitor: 0,
  booth: COMICCON_BOOTH_FEE,
  cosplay: COMICCON_COSPLAY_FEE,
  cosplayLewd: COMICCON_COSPLAY_LEWD_FEE,
};

/**
 * 코믹콘 참여 방식의 **총 실비**(입장료 + 방식별 추가금).
 * UI는 이 값을 버튼에 그대로 표시하면 된다(입장료가 이미 포함된 금액).
 */
export function comicconFee(mode: ComicconFeeMode): number {
  return COMICCON_ENTRY_FEE + COMICCON_MODE_FEES[mode];
}

/** 이 참여 방식의 실비를 지금 낼 수 있는지(소지금만 본다 — 행동력은 UI가 따로 검사). */
export function canAffordComiccon(state: GameState, mode: ComicconFeeMode): boolean {
  return state.money >= comicconFee(mode);
}

/**
 * 코믹콘 참여 실비를 차감한다. 잔고가 모자라면 **아무것도 바꾸지 않고** false.
 * 진행(resolveComiccon) **직전에 한 번만** 부른다.
 * @returns 지불 성공 여부
 */
export function payComicconFee(state: GameState, mode: ComicconFeeMode): boolean {
  const fee = comicconFee(mode);
  if (state.money < fee) return false;
  state.money -= fee;
  addFeeSchedule(state, "코믹콘", fee);
  return true;
}

/* ─────────────────── 일반 행사(무대인사·팬사인회·팬미팅 등) ─────────────────── */

/**
 * 행사명별 참가비. 여기 없는 행사는 무료다(시사회·전시회 등 초대/무료 행사).
 *
 * - 무대인사: 영화표값. 티켓팅에 성공해도 표는 현장에서 결제한다.
 * - 팬사인회·팬미팅: 음원CD 추첨 당첨으로 자리를 얻지만, 현장 진행비(예매 수수료·교통)는 별도.
 *   당첨 자체가 희소 자원이라 요금은 상징적인 수준으로 낮게 잡았다.
 */
export const EVENT_FEES: Record<string, number> = {
  무대인사: 12_000,
  팬사인회: 9_000,
  팬미팅: 9_000,
};

/** 이 행사의 참가비(요금표에 없으면 0 = 무료). */
export function eventFee(title: string): number {
  return EVENT_FEES[title] ?? 0;
}

/** 이 약속(행사)의 참가비 — 코믹콘이면 0을 돌려준다(코믹콘은 방식 선택 후 comicconFee로 계산). */
export function appointmentFee(appt: Appointment): number {
  if (appt.variant === "comiccon") return 0;
  return eventFee(appt.title);
}

/** 이 행사의 참가비를 지금 낼 수 있는지. 무료 행사는 항상 true. */
export function canAffordEventFee(state: GameState, appt: Appointment): boolean {
  return state.money >= appointmentFee(appt);
}

/**
 * 행사 참가비를 차감한다. 무료 행사면 아무것도 하지 않고 true.
 * 잔고가 모자라면 아무것도 바꾸지 않고 false.
 */
export function payEventFee(state: GameState, appt: Appointment): boolean {
  const fee = appointmentFee(appt);
  if (fee <= 0) return true;
  if (state.money < fee) return false;
  state.money -= fee;
  addFeeSchedule(state, appt.title, fee);
  return true;
}

/** 참가비 지출을 스케줄 로그에 남긴다(time.ts와의 순환 참조를 피해 인라인 — groupBuy.ts 선례). */
function addFeeSchedule(state: GameState, title: string, fee: number): void {
  appendSchedule(state, {
    id: uid("sch"),
    day: state.day,
    title: `${title} 참가비 -${fee.toLocaleString("ko-KR")}원`,
    kind: "system",
  });
}
