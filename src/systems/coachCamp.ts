import type { GameState } from "@/core/types";
import {
  ALUMNI_SCENE,
  CAMP_AFTERPARTY,
  CAMP_DAYS,
  CAMP_MONTH,
  CAMP_RESULT_LINES,
  CAMP_SKILL_GAIN,
  CAMP_STAMINA_COST,
  CAMP_TEAM_GAIN,
  NATIONAL_AFTERPARTY,
  SCENE_LEWD_MIN,
  SCENE_PERVERT_MIN,
  type CampAdultScene,
} from "@/data/coachCamp";
import { COACH_STAT_TARGET, MEET_DATE, NATIONAL_MEET_MONTH } from "./coach";
import { SLOTS_PER_DAY } from "@/core/state";
import { dateOf, dateOfMonth } from "./calendar";
import { clampMental, clampResource, clampStamina, gainSkill } from "./stats";
import { addSchedule } from "./time";
import { pick } from "@/utils/random";

/**
 * 배구부 여름 합숙훈련과 뒤풀이 성인 이벤트.
 *
 * - **합숙**: 8월 대회 다음 날 감독이 제안한다. 가면 일주일이 통째로 지나가고
 *   행동력·정신력이 0이 되며 체력이 크게 깎이는 대신, 팀 완성도가 한 번에 크게 오른다.
 *   시즌 내내 훈련하는 것과 맞먹는 한 방이라 "이번 시즌을 여기 건다"는 선택이 된다.
 * - **성인 씬**: 성인 모드일 때만 뜬다. 합숙 마지막 날 / 전국체전 직후 / 이듬해 2월.
 *   음란만 높으면 1:1, 변태력까지 높으면 다인 씬이 나온다.
 *
 * ⚠️ **씬 등장인물은 전부 성인이다**(감독·코치진·학부모·졸업생). 선수는 나오지 않는다 —
 *    콘텐츠(`data/coachCamp.ts`)의 같은 경고와 짝이다.
 *
 * ⚠️ 여기서 시간을 직접 돌리지 않는다. `advanceTime`은 ui가 부른다(coachModal과 같은 규칙) —
 *    systems가 시간을 만지면 박제 상태 가드(`winEnding.isFrozen`)를 우회하게 된다.
 */

/** 합숙이 며칠치 슬롯인지 — ui가 advanceTime에 넘길 값. */
export const CAMP_SLOTS = CAMP_DAYS * SLOTS_PER_DAY;

/** 지금 합숙 제안이 떠야 하는지 — 8월 대회 **다음 날**, 그 해 아직 안 갔을 때. */
export function isCampOfferDay(state: GameState): boolean {
  const job = state.coachJob;
  if (!job || state.gameOver) return false;
  const d = dateOf(state.day);
  if (d.getMonth() + 1 !== CAMP_MONTH) return false;
  if (dateOfMonth(state.day) !== MEET_DATE + 1) return false;
  return (job.campYear ?? -1) !== d.getFullYear();
}

/**
 * 합숙을 다녀온다. **연도 도장을 먼저 찍어** 중복 실행을 막는다.
 *
 * ⚠️ 행동력·정신력은 0으로 **눌러 놓는다**. 합숙에서 돌아온 직후가 가장 비어 있는 상태여야
 *    "일주일을 갈아 넣었다"가 성립한다. 시간 진행(ui의 advanceTime)이 하루치 회복을 얹으므로
 *    호출 순서는 **이 함수 → advanceTime**이다(반대로 하면 회복분이 0으로 지워진다).
 */
export function goToCamp(state: GameState): void {
  const job = state.coachJob;
  if (!job) return;
  job.campYear = dateOf(state.day).getFullYear();

  job.teamStat = Math.min(COACH_STAT_TARGET, job.teamStat + CAMP_TEAM_GAIN);
  state.resources.action = 0;
  state.resources.mental = 0;
  state.stamina = clampStamina(state, state.stamina - CAMP_STAMINA_COST);
  for (const [k, v] of Object.entries(CAMP_SKILL_GAIN)) {
    gainSkill(state, k as keyof typeof CAMP_SKILL_GAIN, v);
  }
  addSchedule(state, `여름 합숙 훈련 (완성도 +${CAMP_TEAM_GAIN})`, "system");
}

/** 합숙을 안 가고 넘긴다 — 도장만 찍어 그 해엔 다시 안 묻는다. */
export function skipCamp(state: GameState): void {
  const job = state.coachJob;
  if (!job) return;
  job.campYear = dateOf(state.day).getFullYear();
}

/* ─────────────────── 성인 씬 선택 ─────────────────── */

/**
 * 후보 중 지금 조건에 맞는 씬 하나. 없으면 null.
 *
 * ⚠️ 후보 배열은 **강도가 높은 순**으로 놓는다(다인 → 1:1). 위에서부터 첫 매치를 쓰므로
 *    순서가 뒤집히면 변태력이 아무리 높아도 1:1만 나온다.
 */
export function pickScene(state: GameState, pool: readonly CampAdultScene[]): CampAdultScene | null {
  if (!state.adultMode) return null;
  for (const s of pool) {
    if (state.skills.lewd < s.minLewd) continue;
    if (state.skills.pervert < (s.minPervert ?? 0)) continue;
    return s;
  }
  return null;
}

/** 합숙 마지막 날 뒤풀이 씬(없으면 null — ui가 담백한 문구로 대체한다). */
export function campAfterpartyScene(state: GameState): CampAdultScene | null {
  return pickScene(state, CAMP_AFTERPARTY);
}

/** 전국체전 직후 뒤풀이 씬. */
export function nationalAfterpartyScene(state: GameState): CampAdultScene | null {
  return pickScene(state, NATIONAL_AFTERPARTY);
}

/** 씬의 효과를 적용한다(스킬·정신력·도덕성). */
export function applyScene(state: GameState, scene: CampAdultScene): void {
  if (scene.lewdGain) gainSkill(state, "lewd", scene.lewdGain);
  if (scene.pervertGain) gainSkill(state, "pervert", scene.pervertGain);
  state.resources.mental = clampMental(state, state.resources.mental + scene.mentalDelta);
  state.resources.morality = clampResource(state.resources.morality + scene.moralityDelta);
  addSchedule(state, scene.title.replace("🔞 ", ""), "offline");
}

/* ─────────────────── 전국체전 직후 ─────────────────── */

/**
 * 오늘이 전국체전 **다음 날**인지(대회 당일은 대회 처리가 차지한다).
 *
 * ⚠️ 연 1회 도장(`nationalPartyYear`)을 함께 본다. 도장이 없으면 그날 하루 동안 재렌더마다
 *    씬 효과가 다시 적용된다 — 실제로 그 구조로 짰다가 음란·변태력이 무한히 오르는 걸 발견했다.
 */
export function isNationalAfterDay(state: GameState): boolean {
  const job = state.coachJob;
  if (!job || state.gameOver) return false;
  const d = dateOf(state.day);
  if (d.getMonth() + 1 !== NATIONAL_MEET_MONTH) return false;
  if (dateOfMonth(state.day) !== MEET_DATE + 1) return false;
  return (job.nationalPartyYear ?? -1) !== d.getFullYear();
}

/**
 * 전국체전 뒤풀이를 겪는다(연 1회 도장 + 효과). 씬이 없으면 도장만 찍는다.
 *
 * ⚠️ **멱등해야 한다.** 도장을 찍기만 하고 검사를 안 하면 두 번째 호출에서 효과가 또 붙는다
 *    (실제로 그렇게 짰다가 테스트가 잡았다). ui가 조건으로 막더라도 여기서 한 번 더 막는다.
 */
export function holdNationalParty(state: GameState): void {
  const job = state.coachJob;
  if (!job) return;
  const year = dateOf(state.day).getFullYear();
  if ((job.nationalPartyYear ?? -1) === year) return;
  job.nationalPartyYear = year;
  const scene = nationalAfterpartyScene(state);
  if (scene) applyScene(state, scene);
}

/* ─────────────────── 졸업생 모임(이듬해 2월) ─────────────────── */

/** 졸업생 모임이 열리는 달. */
export const ALUMNI_MONTH = 2;

/**
 * 지금 졸업생 모임이 떠야 하는지.
 *
 * 조건: 코치이고, **대회를 치른 해가 지나 다음 해 2월**이고, 그 해엔 아직 안 겪었고,
 * 성인 모드에 변태력이 문턱을 넘었다. 대회를 한 번도 안 치렀으면 아는 졸업생이 없다.
 */
export function isAlumniDay(state: GameState): boolean {
  const job = state.coachJob;
  if (!job || state.gameOver || !state.adultMode) return false;
  const d = dateOf(state.day);
  if (d.getMonth() + 1 !== ALUMNI_MONTH) return false;
  const year = d.getFullYear();
  if ((job.alumniYear ?? -1) === year) return false;
  const meetYear = job.lastMeetYear ?? -1;
  if (meetYear < 0 || meetYear >= year) return false; // 대회를 치른 '다음 해'여야 한다
  if (state.skills.lewd < SCENE_LEWD_MIN) return false;
  return state.skills.pervert >= SCENE_PERVERT_MIN;
}

/** 졸업생 모임을 겪는다(연 1회 도장). `holdNationalParty`와 같은 이유로 멱등하다. */
export function holdAlumniMeet(state: GameState): CampAdultScene | null {
  const job = state.coachJob;
  if (!job) return null;
  const year = dateOf(state.day).getFullYear();
  if ((job.alumniYear ?? -1) === year) return null;
  job.alumniYear = year;
  applyScene(state, ALUMNI_SCENE);
  return ALUMNI_SCENE;
}

/** 합숙 결과 문구 하나. */
export function campResultLine(): string {
  return pick(CAMP_RESULT_LINES as string[]);
}
