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
