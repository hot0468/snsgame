import type { AttributeId, GameState } from "@/core/types";
import { createAccount, getActiveAccount } from "@/core/state";
import { addSchedule } from "./time";

/** 최대 보유 계정 수 */
export const MAX_ACCOUNTS = 5;

export function canCreateAccount(state: GameState): boolean {
  return state.accounts.length < MAX_ACCOUNTS;
}

/**
 * 새 계정을 만들고 즉시 활성화한다.
 * 핸들이 비었거나 중복이면 자동 보정한다.
 */
export function createNewAccount(
  state: GameState,
  name: string,
  handle: string,
  attribute: AttributeId,
): void {
  const safeName = name.trim() || "새 계정";
  let safeHandle = handle.trim().replace(/[^a-zA-Z0-9_]/g, "") || "user";
  // 핸들 중복 방지
  const existing = new Set(state.accounts.map((a) => a.handle));
  let candidate = safeHandle;
  let n = 1;
  while (existing.has(candidate)) candidate = `${safeHandle}${n++}`;
  safeHandle = candidate;

  const account = createAccount(safeName, safeHandle, attribute);
  state.accounts.push(account);
  state.activeAccountId = account.id;
  addSchedule(state, `새 계정 개설: @${safeHandle}`, "system");
}

/** 계정 전환 */
export function switchAccount(state: GameState, accountId: string): void {
  if (state.accounts.some((a) => a.id === accountId)) {
    state.activeAccountId = accountId;
  }
}

/** 계정 삭제(최소 1개는 남긴다). 활성 계정을 지우면 첫 계정으로 전환. */
export function deleteAccount(state: GameState, accountId: string): boolean {
  if (state.accounts.length <= 1) return false;
  const idx = state.accounts.findIndex((a) => a.id === accountId);
  if (idx === -1) return false;
  state.accounts.splice(idx, 1);
  if (state.activeAccountId === accountId) {
    state.activeAccountId = state.accounts[0].id;
  }
  return true;
}

/** 활성 계정의 이름/핸들 재설정(닉네임 변경 등) */
export function renameActiveAccount(state: GameState, name: string): void {
  const account = getActiveAccount(state);
  account.name = name.trim() || account.name;
}
