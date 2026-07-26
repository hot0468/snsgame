import type { AttributeId, GameState } from "@/core/types";
import { createAccount, getActiveAccount } from "@/core/state";
import { grantAttributeUnlockFloor, syncUnlockedAttributes } from "./attributeUnlock";
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
  // ⚠️ createAccount가 콘셉트 속성을 unlockedAttributes에 이미 넣어 둔 채로 반환하므로
  //    unlockAttribute는 '이미 해금됨'으로 보고 무동작이다. 기준선만 따로 적용한다.
  //    (gaming 콘셉트 계정은 확률 없이 곧바로 게임계 트윗이 열리는 경로다.)
  grantAttributeUnlockFloor(state, attribute);
  state.accounts.push(account);
  // 해금 카테고리는 전 계정 공유 — 새 계정이 기존 해금분을 물려받고, 새 콘셉트 속성도 전 계정에 퍼진다.
  syncUnlockedAttributes(state);
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

/** 특정 계정의 계정명(핸들 아님)을 변경한다. 빈 이름이면 무시. 첫 계정 포함 모든 계정 개명 가능. */
export function renameAccount(state: GameState, accountId: string, name: string): void {
  const acc = state.accounts.find((a) => a.id === accountId);
  const trimmed = name.trim();
  if (acc && trimmed) acc.name = trimmed;
}
