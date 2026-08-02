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
  taxi: "taxi",
  callCenter: "callCenter",
  mlm: "mlm",
  stylist: "stylist",
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

/* ─────────────── 이직해도 남는 경력 ─────────────── */

/**
 * 직업별 **레벨을 정하는 누적치**를 그만둔 뒤에도 보관한다.
 *
 * 왜 필요한가: 레벨은 전부 재직 중인 상태 객체의 카운터에서 나온다(회사원=`perfLevel`,
 * 택시=`totalRides`, 코치=`totalTrainings` …). 그런데 `quitCurrentJob`이 그 객체를 통째로
 * null로 만들어서, **그만두면 경력이 0이 되고 재취업하면 신입부터 다시 시작**했다.
 * 회사원은 직급·월급까지 여기 묶여 있어서(`economy.salaryOf`) 이직 한 번에 사원으로 돌아갔다.
 *
 * ⚠️ **최댓값만 기록한다.** 재취업 후 더 쌓으면 갱신되지만, 짧게 다시 다니다 그만둬도
 *    예전 경력이 깎이지 않는다. 경력은 잊는 게 아니라 쌓이는 것이다.
 *
 * ⚠️ 이 모듈은 여전히 types 말고 아무것도 import 하지 않는다(파일 상단 경고와 짝) —
 *    보관·복원 값은 **호출하는 쪽이 자기 필드에서 읽어** 넘긴다.
 */
export function stashJobCareer(state: GameState, id: string, count: number): void {
  if (!state.jobCareer) state.jobCareer = {};
  if (!Number.isFinite(count) || count <= 0) return;
  state.jobCareer[id] = Math.max(state.jobCareer[id] ?? 0, count);
}

/** 보관된 경력 누적치(없으면 0). 재취업할 때 새 상태 객체의 카운터를 이 값으로 시작한다. */
export function pastJobCareer(state: GameState, id: string): number {
  return state.jobCareer?.[id] ?? 0;
}
