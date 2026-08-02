import type { GameState, InsuranceJob } from "@/core/types";
import {
  COLD_BASE_CHANCE,
  COLD_FAIL_LINES,
  COLD_MENTAL_COST,
  COLD_REPUTATION_WEIGHT,
  COLD_SOCIABILITY_GAIN,
  COLD_SOCIABILITY_WEIGHT,
  COLD_SUCCESS_LINES,
  COLD_TARGETS,
  INSURANCE_COMMISSION,
  KNOWN_AFFINITY_COST,
  KNOWN_AFFINITY_COST_SIGNED,
  KNOWN_AFFINITY_WEIGHT,
  KNOWN_BASE_CHANCE,
  KNOWN_BURNED_AT,
  KNOWN_BURNED_LINE,
  KNOWN_FAIL_LINES,
  KNOWN_SIZE_MULTIPLIER,
  KNOWN_SUCCESS_LINES,
  type ColdTarget,
} from "@/data/insurance";
import { MORNING_SLOT } from "@/core/state";
import { RELATIONSHIP_CHARS, getRelChar } from "@/data/relationships";
import { isWeekday } from "./calendar";
import { hasAnyJob, quitCurrentJob } from "./employment";
import { JOB_ID, markJobExperienced } from "./jobExperience";
import { mutableRelOf, relStateOf } from "./relationship";
import { clampMental, clampResource, gainSkill, skillTo100 } from "./stats";
import { recordMission } from "./missions";
import { addSchedule } from "./time";
import { chance, pick } from "@/utils/random";

/**
 * 보험설계사직.
 *
 * - **근무**: 주5일 평일 낮 **강제 출근**(회사원·코치와 같은 취급 — app이 영업 모달을 띄운다).
 * - **급여**: 소액 고정급(매월 10일) + 계약 수당. 출근을 강제하는 직업이 벌이 0일 수는 없고,
 *   그렇다고 실적이 무의미하면 영업할 이유가 없다 — 회사원(고정급)과 택시(순수 실적) 사이 칸이다.
 * - **영업 선택**: 출근하면 둘 중 하나를 고른다.
 *   - **지인 영업**: 성사율이 높다(호감도에 비례). 대신 **그 사람의 호감도를 태운다.**
 *     0이 되면 연락이 끊겨 영업 대상에서 영구히 빠지고, 관계 서사도 함께 막힌다.
 *   - **무작위 영업**: 성사율이 낮다(친화력·평판). 대신 아무도 잃지 않고 친화력이 오른다.
 *
 * ⚠️ 지인은 **유한한 자원**이다. 그게 이 직업의 전부다 — 관계(relationships)를 자원으로
 *    태우는 첫 직업이고, 다 태우면 무작위 영업만 남는다.
 */

/** 지금 출근 시간인지(평일 낮). 부임 당일은 쉬고 익일부터 — 코치와 같은 규칙. */
export function isInsuranceWorkNow(state: GameState): boolean {
  if (!state.insuranceJob || state.gameOver) return false;
  if (state.day <= state.insuranceJob.hiredDay) return false;
  return isWeekday(state.day) && state.slot === MORNING_SLOT;
}

/** 자격 조건 없음 — 이미 설계사인 경우만 막는다. */
export function canApplyInsurance(state: GameState): boolean {
  return !state.gameOver && !state.insuranceJob;
}

/** 입사. 겸직 불가라 기존 직업을 정리한다(호출부가 먼저 확인을 받아야 한다). */
export function joinInsurance(state: GameState): InsuranceJob | null {
  if (!canApplyInsurance(state)) return null;
  if (hasAnyJob(state)) quitCurrentJob(state);
  state.insuranceJob = {
    hiredDay: state.day,
    contracts: 0,
    totalCommission: 0,
    burnedContacts: [],
    lastSalaryMonth: -1,
  };
  markJobExperienced(state, JOB_ID.insurance);
  addSchedule(state, "한백생명 입사", "system");
  return state.insuranceJob;
}

/** 설계사 사직 — `employment.quitCurrentJob`과 짝(문구를 그쪽과 같게 유지할 것). */
export function quitInsurance(state: GameState): void {
  if (!state.insuranceJob) return;
  state.insuranceJob = null;
  addSchedule(state, "한백생명 퇴사", "system");
}

/* ─────────────────── 지인 영업 ─────────────────── */

/**
 * 지금 영업할 수 있는 지인 목록.
 *
 * 조건: **이미 아는 사이여야 하고**(호감도 > 0), 연락이 끊기지 않았어야 한다.
 * 호감도 0인 캐릭터는 애초에 '지인'이 아니므로 목록에 안 뜬다 — 모르는 사람에게
 * 지인 영업을 거는 건 무작위 영업이다.
 */
export function knownContacts(state: GameState): typeof RELATIONSHIP_CHARS {
  const burned = state.insuranceJob?.burnedContacts ?? [];
  return RELATIONSHIP_CHARS.filter((c) => {
    if (burned.includes(c.id)) return false;
    return relStateOf(state, c.id).affinity > KNOWN_BURNED_AT;
  });
}

/** 그 지인에게 영업했을 때의 성사율(0~1). 친할수록 거절하기 어렵다. */
export function knownChance(state: GameState, charId: string): number {
  const affinity = relStateOf(state, charId).affinity;
  const p = KNOWN_BASE_CHANCE + (affinity / 100) * KNOWN_AFFINITY_WEIGHT;
  return Math.max(0.15, Math.min(0.95, p));
}

export interface SalesResult {
  /** 계약이 성사됐는지 */
  signed: boolean;
  /** 받은 수당(원). 실패면 0 */
  commission: number;
  /** 화면에 띄울 결과 문구 */
  line: string;
  /** 이번 영업으로 연락이 끊긴 지인 id(없으면 null) */
  burned: string | null;
}

/**
 * 지인 영업 1회.
 *
 * ⚠️ 호감도는 **성사 여부와 무관하게** 깎인다. 물어본 것 자체가 관계에 부담이기 때문이고,
 *    "실패하면 손해가 없다"면 지인을 무한히 긁는 게 지배 전략이 된다.
 */
export function sellToKnown(state: GameState, charId: string): SalesResult | null {
  const job = state.insuranceJob;
  const char = getRelChar(charId);
  if (!job || !char) return null;

  const signed = chance(knownChance(state, charId));
  const rel = mutableRelOf(state, charId);
  const cost = KNOWN_AFFINITY_COST + (signed ? KNOWN_AFFINITY_COST_SIGNED : 0);
  rel.affinity = clampResource(rel.affinity - cost);

  let commission = 0;
  if (signed) {
    commission = Math.round(INSURANCE_COMMISSION * KNOWN_SIZE_MULTIPLIER);
    state.money += commission;
    job.contracts += 1;
    job.totalCommission += commission;
    recordMission(state, "sale"); // 도전과제: **성사된** 계약만 센다(허탕은 실적이 아니다)
  }

  // 호감도가 바닥나면 연락이 끊긴다 — 영업 대상에서도, 관계 서사에서도 빠진다.
  let burned: string | null = null;
  if (rel.affinity <= KNOWN_BURNED_AT && !job.burnedContacts.includes(charId)) {
    job.burnedContacts.push(charId);
    burned = charId;
  }

  const pool = signed ? KNOWN_SUCCESS_LINES : KNOWN_FAIL_LINES;
  const line =
    pick(pool as string[]).replace(/\{name\}/g, char.nickname) +
    (burned ? `\n\n${KNOWN_BURNED_LINE.replace(/\{name\}/g, char.nickname)}` : "");

  addSchedule(
    state,
    signed ? `지인 계약 성사 (+${commission.toLocaleString("ko-KR")}원)` : "지인 영업 실패",
    "offline",
  );
  return { signed, commission, line, burned };
}

/* ─────────────────── 무작위 영업 ─────────────────── */

/** 무작위 영업 성사율(0~1). 친화력·평판이 곧 실력이다. */
export function coldChance(state: GameState): number {
  const soc = skillTo100(state.skills.sociability) / 100;
  const rep = state.resources.reputation / 100;
  const p = COLD_BASE_CHANCE + soc * COLD_SOCIABILITY_WEIGHT + rep * COLD_REPUTATION_WEIGHT;
  return Math.max(0.03, Math.min(0.9, p));
}

/** 이번에 만날 사람. **상태를 바꾸지 않는다** — ui가 보여준 뒤 sellToCold를 부른다. */
export function rollColdTarget(): ColdTarget {
  return pick(COLD_TARGETS as ColdTarget[]);
}

/** 무작위 영업 1회. 아무도 잃지 않는 대신 정신력을 낸다. */
export function sellToCold(state: GameState): SalesResult | null {
  const job = state.insuranceJob;
  if (!job) return null;

  const signed = chance(coldChance(state));
  state.resources.mental = clampMental(state, state.resources.mental - COLD_MENTAL_COST);
  gainSkill(state, "sociability", COLD_SOCIABILITY_GAIN);

  let commission = 0;
  if (signed) {
    commission = INSURANCE_COMMISSION;
    state.money += commission;
    job.contracts += 1;
    job.totalCommission += commission;
    recordMission(state, "sale"); // 도전과제: **성사된** 계약만 센다(허탕은 실적이 아니다)
  }

  addSchedule(
    state,
    signed ? `신규 계약 성사 (+${commission.toLocaleString("ko-KR")}원)` : "영업 허탕",
    "offline",
  );
  return {
    signed,
    commission,
    line: pick((signed ? COLD_SUCCESS_LINES : COLD_FAIL_LINES) as string[]),
    burned: null,
  };
}
