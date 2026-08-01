import type { GameState } from "@/core/types";

/**
 * '해본 직업' 기록 — 직업 도감(`systems/jobLevels.ts`)의 해금 근거.
 *
 * ⚠️ **이 모듈은 types 말고 아무것도 import 하지 않는다.** 직업 시스템들(employment·avJob·
 *    author·killer·lecturer)이 전부 이걸 부르는데, 여기서 그쪽을 다시 참조하면 순환이 된다.
 *
 * 왜 별도 기록이 필요한가: 회사·AV·강사는 그만두면 상태가 통째로 지워진다(`quitCurrentJob`).
 * 상태로만 판정하면 "한 번 해봤는데 도감이 다시 잠기는" 그림이 나온다 — 도감은 잊으면 안 된다.
 * 알바(누적 카운터)와 청부업(그만두는 개념 없음)은 상태가 곧 이력이라 기록이 필요 없지만,
 * 판정을 한 곳에 모으려고 전부 같은 함수를 통과시킨다.
 */

/** 직업 도감 id — 카탈로그(`JOB_CATALOG`)와 철자가 같아야 한다. */
export const JOB_ID = {
  office: "office",
  lecturer: "lecturer",
  author: "author",
  av: "av",
  killer: "killer",
  coach: "coach",
} as const;

/** 이 직업을 해본 것으로 기록한다(중복 호출은 무해). */
export function markJobExperienced(state: GameState, id: string): void {
  if (!Array.isArray(state.jobsExperienced)) state.jobsExperienced = [];
  if (!state.jobsExperienced.includes(id)) state.jobsExperienced.push(id);
}

/** 이 직업을 해본 적 있는지. */
export function hasJobExperience(state: GameState, id: string): boolean {
  return Array.isArray(state.jobsExperienced) && state.jobsExperienced.includes(id);
}
