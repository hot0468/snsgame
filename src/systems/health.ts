import type { GameState } from "@/core/types";
import { SLOTS_PER_DAY } from "@/core/state";
import { SICK_TITLE } from "@/data/health";
import { chance } from "@/utils/random";
import { gainStamina } from "./stats";
// health↔time은 서로를 import하지만(아래 advanceTime/addSchedule, time.onNewDay의 rollDisease)
// 둘 다 '호출 시점'에만 참조하므로 ESM 순환이 안전하다(offline↔time·esthetic 선례).
import { addSchedule, advanceTime } from "./time";

/**
 * 체력·질병·계절 피해 상수 단일 출처.
 * 폭염/한파의 실제 적용은 seasonal.ts가 이 상수들을 import해 처리한다(알림·fire 게이트가 거기 있어서).
 */

/** 이 체력 이하이면 질병 판정 대상 */
export const SICK_THRESHOLD = 100;
/** 조건 충족 시 그날 병에 걸릴 확률 */
export const SICK_CHANCE = 0.35;
/** 하루 앓고 회복하는 체력(재발 무한루프 방지 — 이 회복이 없으면 다음날도 threshold 이하로 재발 가능) */
export const SICK_RECOVER = 50;

/** 운동 1회로 오르는 체력 한계치 */
export const WORKOUT_STAMINA_MAX_GAIN = 8;
/** 운동 1회로 회복하는 현재 체력 */
export const WORKOUT_STAMINA = 8;
/** 쉬기 1회로 회복하는 체력 */
export const REST_STAMINA = 40;
/** 웹툰(작가) 원고 작업 1회로 깎이는 체력 — 장시간 앉아 마감치는 소모 */
export const AUTHOR_WORK_STAMINA = 25;

/** 폭염(에어컨 미소유) 시 깎이는 체력 */
export const HEATWAVE_STAMINA = 60;
/** 폭염(에어컨 미소유) 시 깎이는 정신력 */
export const HEATWAVE_MENTAL = 15;
/** 한파(전기장판 미소유) 시 깎이는 체력 */
export const COLDWAVE_STAMINA = 60;
/** 한파(전기장판 미소유) 시 깎이는 정신력 */
export const COLDWAVE_MENTAL = 15;

/**
 * 체력이 바닥이면 확률적으로 질병을 발생시킨다(time.onNewDay에서 매일 1회 호출).
 * 발병하면 sickPending을 세워 app.ts가 renderSickModal을 강제로 띄우게 한다.
 * @returns 이번에 발병했으면 true.
 */
export function rollDisease(state: GameState): boolean {
  if (state.gameOver) return false;
  if (state.stamina > SICK_THRESHOLD) return false;
  if (!chance(SICK_CHANCE)) return false;
  state.sickPending = true;
  addSchedule(state, SICK_TITLE, "system");
  return true;
}

/**
 * 병에 걸린 하루를 통째로 앓아 넘긴다(spendDayResting 골격 — 남은 슬롯을 advanceTime(1)로
 * 다음날 아침까지 진행). 활동·부수롤은 없다. 하루 앓으며 체력을 소량 회복하고, 강제 팝업
 * 대기를 클리어한다.
 *
 * ⚠️ 무한루프 방지: 남은 슬롯을 넘기는 중 날짜가 바뀌며 onNewDay→rollDisease가 (아직 회복
 *    전이라) sickPending을 다시 세울 수 있다. 그래서 회복과 sickPending=false를 **루프 뒤**에
 *    둔다 — 방금 세워진 재발 플래그를 이 자리에서 지워, 같은 기상에서 병 모달이 연달아 뜨지
 *    않게 한다. SICK_RECOVER 회복은 다음날 즉시 재발 확률을 낮춘다.
 */
export function resolveSickDay(state: GameState): void {
  const remaining = SLOTS_PER_DAY - state.slot;
  for (let i = 0; i < remaining; i++) {
    if (state.gameOver) break;
    advanceTime(state, 1);
  }
  gainStamina(state, SICK_RECOVER);
  state.sickPending = false;
  state.sleepPending = false;
}

/* ═══════════════ 야근 연속 페널티 · 굶주림 ═══════════════
 *
 * 두 개의 독립적인 체력 압박이다. 같은 날 겹칠 수 있다(야근하며 굶으면 둘 다 맞는다 — 의도).
 * 설계서: docs/superpowers/specs/2026-07-29-overtime-hunger-design.md
 */

/** 야근 연속 감소량의 상한. 장기 연속에서 한 번에 100씩 깎이는 파탄을 막는다. */
export const OVERTIME_STRAIN_CAP = 36;
/** 굶주림 하루 감소량 계수(3 × 연속일) */
export const HUNGER_DAMAGE_PER_DAY = 3;
/** 굶주림 감소량의 상한 */
export const HUNGER_DAMAGE_CAP = 20;
/**
 * 굶주림이 깎을 수 있는 체력의 하한.
 * ⚠️ 굶주림 **단독으로는 게임오버가 되지 않는다** — 무일푼은 플레이어가 하루아침에
 *    벗어날 수 없는 상태라서다(야근은 안 하면 그만이므로 바닥이 없다).
 *    대신 체력이 바닥이면 rollDisease가 계속 떠서 실질적으로는 충분히 위험하다.
 */
export const HUNGER_STAMINA_FLOOR = 1;

/**
 * 야근 연속일수에 따른 체력 감소량 — **제곱 곡선**.
 * 1일차는 공짜고, 2일차부터 연속일수의 제곱만큼 깎이며 상한(36 = 6일차)에서 멈춘다.
 *   1일 0 · 2일 -4 · 3일 -9 · 4일 -16 · 5일 -25 · 6일+ -36
 * 시작 체력 200 기준 6일 연속이면 누적 -90으로 질병 문턱(100) 아래로 떨어진다.
 */
export function overtimeStrainDamage(streak: number): number {
  if (streak <= 1) return 0;
  return Math.min(OVERTIME_STRAIN_CAP, streak ** 2);
}

/**
 * 굶은 연속일수에 따른 체력 감소량 — 선형, 상한 20.
 * 야근과 달리 **첫날부터** 깎인다(굶는 건 첫날부터 아프다). 대신 곡선이 완만하다.
 */
export function hungerDamage(streak: number): number {
  if (streak <= 0) return 0;
  return Math.min(HUNGER_DAMAGE_CAP, HUNGER_DAMAGE_PER_DAY * streak);
}

/**
 * 오늘 야근했다고 표시한다.
 * 회사 야근 판정(employment)과 너아무튼온 업무 요청 수락(workMessenger) 둘 다 이걸 부른다.
 * ⚠️ 같은 날 여러 번 불려도 연속일수는 1만 오른다(정산이 플래그 하나만 본다).
 */
export function markOvertime(state: GameState): void {
  state.overtimeToday = true;
}

/**
 * 야근 연속을 정산한다(하루 넘김 1회).
 * 야근한 날이면 연속을 올리고 제곱 곡선만큼 체력을 깎는다.
 * 야근 없는 하루가 지나면 연속이 0으로 끊긴다 — 플레이어가 '오늘은 쉬자'로 조절할 수 있어야 한다.
 */
export function settleOvertimeStrain(state: GameState): void {
  if (!state.overtimeToday) {
    state.overtimeStreak = 0;
    return;
  }
  state.overtimeToday = false;
  state.overtimeStreak += 1;

  const damage = overtimeStrainDamage(state.overtimeStreak);
  if (damage <= 0) return; // 1일차는 공짜 — 로그도 남기지 않는다
  gainStamina(state, -damage);
  addSchedule(state, `야근 ${state.overtimeStreak}일 연속 — 체력 -${damage}`, "system");
}

/**
 * 굶주림을 정산한다(하루 넘김 1회).
 * 연속일수는 economy.applyDailyCosts가 이미 갱신했다 — 여기선 체력만 깎는다.
 * ⚠️ 체력을 HUNGER_STAMINA_FLOOR 아래로 깎지 않는다.
 */
export function settleHunger(state: GameState): void {
  const damage = hungerDamage(state.hungerStreak);
  if (damage <= 0) return;

  // 바닥까지 남은 여유만큼만 깎는다(이미 바닥 이하면 0).
  const room = Math.max(0, state.stamina - HUNGER_STAMINA_FLOOR);
  const actual = Math.min(damage, room);
  if (actual <= 0) return;

  gainStamina(state, -actual);
  addSchedule(state, `굶주림 ${state.hungerStreak}일차 — 체력 -${actual}`, "system");
}
