import type { GameState } from "@/core/types";
import type { Recipe } from "@/data/grocery";
import { RECIPES } from "@/data/grocery";
import { gainSkill, clampResource } from "./stats";
import { addSchedule } from "./time";

/**
 * 요리 도감 — 마켓걸리버에서 완성한 레시피를 모은다(크리처 도감 patterns 미러링).
 * 등록은 `ui/grocery.ts`의 주문 성공 경로에서만 일어난다(요리 실패·레몬Z는 등록되지 않는다).
 */

/** 처음 만든 요리 1종당 창작 상승분(0~999 스케일 · ×5 관례) */
export const DISH_FIRST_CREATIVITY = 8;
/** 도감을 전부 채웠을 때 1회 보너스로 회복하는 정신력 */
export const DEX_COMPLETE_MENTAL = 15;
/** 도감을 전부 채웠을 때 1회 보너스로 오르는 창작 */
export const DEX_COMPLETE_CREATIVITY = 60;

/** 도감 전체 종수 */
export const DISH_TOTAL = RECIPES.length;

/** 도감에 등록된 종수 */
export function cookedCount(state: GameState): number {
  return state.cookedDishes.length;
}

/** 이미 도감에 있는 요리인지 */
export function isCooked(state: GameState, recipeId: string): boolean {
  return state.cookedDishes.includes(recipeId);
}

/** 완성한 요리를 도감에 등록했을 때 UI에 알릴 결과. 이미 있던 요리면 null. */
export interface CookingRecord {
  /** 이번에 처음 등록된 요리 이름 */
  name: string;
  /** 실제 반영된 창작 상승분(감쇠·상한 반영) */
  creativity: number;
  /** 이 등록으로 도감이 완성됐는지(전종 수집) */
  completed: boolean;
}

/**
 * 완성한 요리를 도감에 등록한다.
 * 처음 만든 요리면 창작이 오르고, 그 등록으로 전종을 채웠으면 1회 완성 보너스가 붙는다.
 * 이미 등록된 요리면 아무 일도 하지 않는다(중복 방지 — collectCreature와 같은 계약).
 */
export function recordCooking(state: GameState, recipe: Recipe): CookingRecord | null {
  if (isCooked(state, recipe.id)) return null;
  state.cookedDishes.push(recipe.id);
  const creativity = gainSkill(state, "creativity", DISH_FIRST_CREATIVITY);
  addSchedule(state, `요리 도감 등록: ${recipe.name}`, "system");

  const completed = state.cookedDishes.length >= DISH_TOTAL;
  if (completed) {
    state.resources.mental = clampResource(state.resources.mental + DEX_COMPLETE_MENTAL);
    gainSkill(state, "creativity", DEX_COMPLETE_CREATIVITY);
    addSchedule(state, `요리 도감 완성! (${DISH_TOTAL}종)`, "system");
  }
  return { name: recipe.name, creativity, completed };
}
