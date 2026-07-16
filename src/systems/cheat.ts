import type { GameState } from "@/core/types";
import { SKILL_STAT_IDS } from "@/data/stats";
import { clampSkill } from "./stats";

/**
 * 숨겨진 치트 2종. 둘 다 **게임당 1회**(state.cheats)이며 **시간·행동력을 소모하지 않는다**.
 *
 * - 명령 프롬프트에 MONEY_CHEAT_CODE 입력 → 소지금 +100만원
 * - 작업관리자에서 Cheat.exe 실행 → 행동력 상한 +20 · 스킬 전 종 +100
 *
 * ⚠️ UI는 이 코드를 화면 어디에도 힌트로 노출하지 않는다.
 */

/** 명령 프롬프트 소지금 치트 코드(정규화 후 비교하므로 소문자·단일 공백 형태로 적는다) */
export const MONEY_CHEAT_CODE = "show me the money";
/** 소지금 치트로 받는 금액 */
export const MONEY_CHEAT_AMOUNT = 1_000_000;
/** Cheat.exe가 올려주는 행동력 **상한** 증가치 */
export const CHEAT_EXE_ACTION_MAX = 20;
/** Cheat.exe가 스킬 전 종에 더하는 값(999 스케일 — 구 100 스케일의 +10에 해당) */
export const CHEAT_EXE_SKILL_GAIN = 100;

/**
 * 치트 입력 정규화.
 * - 앞뒤 공백 제거, 대소문자 무시 → 오타가 아닌 입력 습관은 관대하게 받는다.
 * - 내부 연속 공백은 하나로 합친다("show  me   the money" 통과).
 *   단어 경계 자체는 요구한다 — "showmethemoney"는 통과하지 않는다(원본 치트의 형태를 지킨다).
 */
export function normalizeCheatInput(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * 입력이 소지금 치트 코드인지(사용 여부와 무관하게 '코드가 맞는지'만 본다).
 * tryMoneyCheat이 false를 반환했을 때 UI가 '틀린 명령'과 '이미 쓴 치트'를 구분하는 데 쓴다.
 */
export function isMoneyCheatCode(input: string): boolean {
  return normalizeCheatInput(input) === MONEY_CHEAT_CODE;
}

/**
 * 명령 프롬프트 소지금 치트를 시도한다.
 * @returns 성공(소지금 지급) 여부. 코드가 틀렸거나 **이미 썼으면** false.
 */
export function tryMoneyCheat(state: GameState, input: string): boolean {
  if (!isMoneyCheatCode(input)) return false;
  if (state.cheats.money) return false;
  state.cheats.money = true;
  state.money += MONEY_CHEAT_AMOUNT;
  return true;
}

/**
 * 작업관리자의 Cheat.exe를 실행한다.
 * 행동력 **상한**을 올리고(현재값은 그대로 — 다음 회복부터 새 상한까지 찬다),
 * 스킬 전 종을 clampSkill(999)로 +CHEAT_EXE_SKILL_GAIN 한다.
 *
 * ⚠️ 스킬은 SKILL_STAT_IDS를 순회한다 — 종류가 늘어도 자동으로 따라간다(하드코딩 금지).
 * @returns 성공 여부. **이미 썼으면** false(아무 상태도 바꾸지 않는다).
 */
export function runCheatExe(state: GameState): boolean {
  if (state.cheats.cheatExe) return false;
  state.cheats.cheatExe = true;
  state.actionMaxBonus += CHEAT_EXE_ACTION_MAX;
  for (const id of SKILL_STAT_IDS) {
    state.skills[id] = clampSkill(state.skills[id] + CHEAT_EXE_SKILL_GAIN);
  }
  return true;
}
