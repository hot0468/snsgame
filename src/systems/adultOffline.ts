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
import { seedBlackmail } from "./blackmail";
import { applyEffect } from "./events";
import { gainSkill } from "./stats";
import { addSchedule } from "./time";

/**
 * 강압(coercive) 조우의 기본 변태력 문턱.
 * 음란도만 높은 플레이어에게 '당한다' 계열이 굴러오지 않게 하는 게 이 축의 존재 이유다 —
 * 강압은 야한 정도가 아니라 취향의 문제라 별도 축으로 뗐다(사용자 확정).
 */
export const PERVERT_COERCIVE_MIN = 250;

/**
 * 강압·페티쉬 조우를 '받아들였을' 때 오르는 변태력 = 그 선택의 음란 상승분 × 이 비율.
 * ⚠️ 이 경로만으로는 첫 게이트(250)를 못 넘는다 — 게이트가 스탯 성장을 막는 자물쇠가 되기 때문이다.
 *    진입로는 게이트 밖의 전용 육성 수단(성인 도서 감상 · 현생 '취향 탐구')이 담당한다.
 */
export const PERVERT_GAIN_RATIO = 0.5;

/**
 * 이 조우가 요구하는 변태력. 명시된 `minPervert`가 최우선이고,
 * 없으면 강압 조우는 기본 문턱, 일반 조우는 0(변태력 무관 — 음란도만 보면 된다).
 */
function pervertGate(e: { minPervert?: number; coercive?: boolean }): number {
  return e.minPervert ?? (e.coercive ? PERVERT_COERCIVE_MIN : 0);
}

/**
 * `requires`가 요구하는 처지를 지금 만족하는가.
 *
 * ⚠️ **data의 `requires` 유니온에 값을 추가하면 여기 분기도 같이 추가하라.**
 *    빠뜨리면 그 조우는 typecheck를 통과한 채 영영 후보에 안 들어간다
 *    (`adultOffline.test.ts`가 유니온과 이 함수의 짝을 감시한다).
 */
export function meetsRequirement(state: GameState, requires?: "savanna"): boolean {
  if (!requires) return true;
  if (requires === "savanna") return state.savannaJoined;
  return false;
}

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
    if (!meetsRequirement(state, e.requires)) return false;
    // 2축 게이트: 음란(얼마나 야한가)과 변태력(어느 방향인가)을 **둘 다** 넘어야 뜬다.
    if (state.skills.lewd < e.minLewd) return false;
    if (state.skills.pervert < pervertGate(e)) return false;
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
  // 강압·페티쉬 조우에서 '받아들인' 선택을 고르면 변태력도 함께 오른다.
  // ⚠️ 선택지 순서(0번=진행)로 판정하지 마라 — 그건 규약이 아니다.
  //    음란이 오르는 선택 = 그 방향을 받아들인 선택이라는 게 데이터에 이미 있는 유일한 신호다
  //    (거절 선택지는 lewd를 안 올린다). 콘텐츠 20여 개를 손대지 않고도 새 조우에 자동 적용된다.
  const lewdGain = choice.effect.skills?.lewd ?? 0;
  if (lewdGain > 0 && pervertGate(enc) > 0) {
    gainSkill(state, "pervert", Math.round(lewdGain * PERVERT_GAIN_RATIO));
  }
  if (choice.unlockGroup) {
    getActiveAccount(state).groupUnlocked = true;
  }
  // 촬영이 언급된 선택이면 협박의 씨를 심는다 — 며칠 뒤 카톡으로 돌아온다(systems/blackmail).
  if (choice.filmed) seedBlackmail(state, choice.filmed);
  addSchedule(state, `현생 조우: ${enc.title}`, "offline");
  // customKey가 동적 문구를 주면 그쪽 우선(현재 성인 조우는 정적 result 위주)
  if (typeof dynamic === "string" && dynamic.length > 0) return dynamic;
  return choice.result;
}
