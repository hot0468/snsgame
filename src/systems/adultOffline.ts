/**
 * 현생 살기 성인 조우 — 후보 필터·가중 추첨·선택 적용.
 * 데이터는 data/adultOffline.ts, UI는 offlineModal이 호출한다.
 */
import type { GameState } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import {
  ADULT_OFFLINE_CHANCE,
  ADULT_OFFLINE_ENCOUNTERS,
  getAdultOfflineEncounter,
  type AdultOfflineEncounterId,
  type OfflineActivityId,
} from "@/data/adultOffline";
import { applyEffect } from "./events";
import { addSchedule } from "./time";

/**
 * 현재 상태·활동에 맞는 성인 조우 하나를 확률적으로 고른다.
 * 성인 모드가 아니거나 후보/확률 실패 시 null.
 */
export function rollAdultOfflineEncounter(
  state: GameState,
  activityId: string,
  wasLate: boolean,
): AdultOfflineEncounterId | null {
  if (!state.adultMode) return null;

  const candidates = ADULT_OFFLINE_ENCOUNTERS.filter((e) => {
    if (!e.activities.includes(activityId as OfflineActivityId)) return false;
    if (state.skills.lewd < e.minLewd) return false;
    if (e.lateOnly && !wasLate) return false;
    // '강압/범죄 안 보기' 켜면 비합의 조우는 후보에서 제외
    if (e.coercive && state.adultNoCoercion) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  if (Math.random() >= ADULT_OFFLINE_CHANCE) return null;

  const total = candidates.reduce((sum, e) => sum + (e.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const e of candidates) {
    roll -= e.weight ?? 1;
    if (roll <= 0) return e.id;
  }
  return candidates[candidates.length - 1].id;
}

/**
 * 조우 선택지를 확정한다. EventEffect 적용 + (선택) 그룹 해금 + 스케줄.
 * @returns 결과 서사 문구
 */
export function resolveAdultOfflineEncounter(
  state: GameState,
  encounterId: AdultOfflineEncounterId,
  choiceIndex: number,
): string {
  const enc = getAdultOfflineEncounter(encounterId);
  if (!enc) return "";
  const choice = enc.choices[choiceIndex];
  if (!choice) return "";

  const dynamic = applyEffect(state, choice.effect);
  if (choice.unlockGroup) {
    getActiveAccount(state).groupUnlocked = true;
  }
  addSchedule(state, `현생 조우: ${enc.title}`, "offline");
  // customKey가 동적 문구를 주면 그쪽 우선(현재 성인 조우는 정적 result 위주)
  if (typeof dynamic === "string" && dynamic.length > 0) return dynamic;
  return choice.result;
}
