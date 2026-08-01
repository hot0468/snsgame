import type { GameState } from "@/core/types";
import { MAX_RESOURCE } from "@/data/stats";
import { clampResource } from "./stats";
import { perkFailMult } from "./milestones";

/**
 * 컨디션(정신력) 판정 — 실패/평소/대성공.
 *
 * ⚠️ 원래 `systems/offline.ts`에 있었다. 배구부 코치 훈련(`systems/coach.ts`)이 같은 판정을 쓰는데
 *    offline이 coach를 부르고(운동 후 섭외) coach가 offline을 부르면 **순환**이라 잎으로 뺐다.
 *    offline은 이 모듈을 그대로 재export하므로 기존 import 경로는 전부 유효하다.
 * ⚠️ 새 활동이 자체 난수 굴림을 만들지 마라. 판정이 정신력의 함수여야 정신력이 육성의 단일 축이 된다.
 */

/**
 * 활동 판정 등급 — 컨디션(정신력)에서 파생된다. 독립 난수 굴림이 아니다.
 * - `fail`   집중이 흐트러져 성과가 거의 없음(획득 스킬 FAIL_SKILL_MULT배)
 * - `normal` 평소대로
 * - `great`  몰입해서 평소보다 크게 얻음(획득 스킬 GREAT_SKILL_MULT배)
 */
export type ActivityGrade = "fail" | "normal" | "great";

/**
 * 정신력이 이 값 이하이면 실패 확률이 최대(FAIL_CHANCE_MAX)다.
 * 이 값과 FAIL_MENTAL_SAFE 사이는 선형 보간.
 */
export const FAIL_MENTAL_FLOOR = 10;
/** 정신력이 이 값 이상이면 실패하지 않는다. */
export const FAIL_MENTAL_SAFE = 60;
/** 정신력이 바닥일 때의 활동 실패 확률. */
export const FAIL_CHANCE_MAX = 0.45;

/** 정신력이 이 값 이상부터 대성공이 뜨기 시작한다. */
export const GREAT_MENTAL_MIN = 75;
/** 정신력 100일 때의 대성공 확률. */
export const GREAT_CHANCE_MAX = 0.3;

/** 실패 시 스킬 획득에 곱하는 배율(감소는 그대로 — applyGradeToGain 주석 참조). */
export const FAIL_SKILL_MULT = 0.25;
/** 대성공 시 스킬 획득에 곱하는 배율. */
export const GREAT_SKILL_MULT = 1.8;

/**
 * 현재 정신력에서 파생한 활동 실패 확률(0 ~ FAIL_CHANCE_MAX).
 * ⚠️ **독립 난수 굴림이 아니다** — 확률 자체가 컨디션의 함수여야 정신력이 육성의 단일 축이 된다.
 *   정신력 60+ → 0% · 40 → 18% · 20 → 32% · 10 이하 → 45% (퍼크 미해금 기준)
 * ④ 마일스톤 퍼크(focus·resilient)가 이 확률을 최대 0.64배까지 줄인다 — 0이 되진 않는다.
 */
export function activityFailChance(state: GameState): number {
  // 정신력 클램프는 activityGreatChance와 같은 이유(음수/100초과 방어).
  const m = clampResource(state.resources.mental);
  if (m >= FAIL_MENTAL_SAFE) return 0;
  const raw =
    m <= FAIL_MENTAL_FLOOR
      ? FAIL_CHANCE_MAX
      : FAIL_CHANCE_MAX * ((FAIL_MENTAL_SAFE - m) / (FAIL_MENTAL_SAFE - FAIL_MENTAL_FLOOR));
  return raw * perkFailMult(state);
}

/**
 * 현재 정신력에서 파생한 대성공 확률(0 ~ GREAT_CHANCE_MAX).
 * 실패와 같은 축의 반대편이라 컨디션을 올릴 이유가 생긴다.
 *   정신력 75 이하 → 0% · 85 → 12% · 100 → 30%
 */
export function activityGreatChance(state: GameState): number {
  // ⚠️ 정신력을 날것으로 읽지 않고 클램프한다(mentalEfficiency와 같은 이유).
  //    상한을 안 걸면 정신력이 100을 넘는 경로가 생겼을 때 GREAT_CHANCE_MAX를 조용히 초과한다.
  const m = clampResource(state.resources.mental);
  if (m <= GREAT_MENTAL_MIN) return 0;
  return GREAT_CHANCE_MAX * ((m - GREAT_MENTAL_MIN) / (MAX_RESOURCE - GREAT_MENTAL_MIN));
}

/**
 * 컨디션 판정 1회. 실패를 먼저 굴리고, 아니면 대성공을 굴린다.
 * 두 구간이 정신력 60~75에서 겹치지 않으므로 순서는 사실상 무관하다(안전하게 배타 처리).
 */
export function rollActivityGrade(state: GameState): ActivityGrade {
  if (Math.random() < activityFailChance(state)) return "fail";
  if (Math.random() < activityGreatChance(state)) return "great";
  return "normal";
}

/**
 * 등급을 스킬 변화량에 반영한다.
 * ⚠️ **양수(획득)에만 배율을 건다** — gainSkill의 "음수는 그대로 통과" 원칙과 같은 이유다.
 *    실패했다고 반대급부 감소까지 1/4로 줄어들면 "실패가 이득"인 구간이 생기고,
 *    대성공이라고 감소가 1.8배로 커지면 컨디션을 올릴수록 손해가 된다. 둘 다 축을 뒤집는다.
 */
export function applyGradeToGain(amount: number, grade: ActivityGrade): number {
  if (amount <= 0) return amount;
  if (grade === "fail") return amount * FAIL_SKILL_MULT;
  if (grade === "great") return amount * GREAT_SKILL_MULT;
  return amount;
}
