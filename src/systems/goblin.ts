import type { GameState, SkillStatId } from "@/core/types";
import type { GoblinItem } from "@/data/goblin";
import { monthKey } from "./calendar";
import { gainSkill } from "./stats";
import { addSchedule } from "./time";

/**
 * 도깨비 상점 접속/구매 로직.
 * - 접속은 한 달(monthKey)에 한 번만.
 * - 레어 아이템은 비싸지만 세부 스탯을 크게 올린다(아이템당 1회 구매).
 */

/** 이번 달에 아직 도깨비 상점에 들어가지 않았는지 */
export function canEnterGoblinShop(state: GameState): boolean {
  return state.goblinShopMonth !== monthKey(state.day);
}

/** 도깨비 상점에 입장(이번 달 접속 소진). */
export function enterGoblinShop(state: GameState): void {
  state.goblinShopMonth = monthKey(state.day);
  addSchedule(state, "도깨비 상점 방문", "offline");
}

/** 이미 산 레어 아이템인지 */
export function isGoblinOwned(state: GameState, id: string): boolean {
  return state.ownedItems.includes(id);
}

/** 구매 가능한지(미보유 + 잔고 충분) */
export function canBuyGoblin(state: GameState, item: GoblinItem): boolean {
  return !isGoblinOwned(state, item.id) && state.money >= item.price;
}

/** 레어 아이템을 산다(세부 스탯 대폭 상승). @returns 샀으면 true */
export function buyGoblinItem(state: GameState, item: GoblinItem): boolean {
  if (!canBuyGoblin(state, item)) return false;
  state.money -= item.price;
  // flat: 상점 표기로 확정 고지되고 값을 이미 치렀다(shop.buyItem과 동일 근거).
  // sellOwnedItem의 회수도 선언값 기준이라 액면 지급이어야 대칭이 유지된다.
  for (const [skill, amount] of Object.entries(item.boosts)) {
    const key = skill as SkillStatId;
    gainSkill(state, key, amount ?? 0, { flat: true });
  }
  state.ownedItems.push(item.id);
  addSchedule(state, `도깨비 상점: ${item.name} 구매`, "system");
  return true;
}
