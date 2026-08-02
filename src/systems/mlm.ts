import type { GameState, MlmJob } from "@/core/types";
import {
  COLD_BASE_CHANCE,
  COLD_FAIL_LINES,
  COLD_MENTAL_COST,
  COLD_REPUTATION_WEIGHT,
  COLD_SOCIABILITY_GAIN,
  COLD_SOCIABILITY_WEIGHT,
  COLD_SUCCESS_LINES,
  COLD_TARGETS,
  KNOWN_AFFINITY_COST,
  KNOWN_AFFINITY_COST_SIGNED,
  KNOWN_AFFINITY_WEIGHT,
  KNOWN_BASE_CHANCE,
  KNOWN_BURNED_AT,
  KNOWN_BURNED_LINE,
  KNOWN_FAIL_LINES,
  KNOWN_SIZE_MULTIPLIER,
  KNOWN_SUCCESS_LINES,
  MLM_ACCEPT_LINE,
  MLM_COMMISSION,
  MLM_COMPANY,
  MLM_DECLINE_LINE,
  MLM_TITLE,
  type ColdTarget,
} from "@/data/mlm";
import { MORNING_SLOT, getActiveAccount } from "@/core/state";
import { RELATIONSHIP_CHARS, getRelChar } from "@/data/relationships";
import { isWeekday } from "./calendar";
import { hasAnyJob, quitCurrentJob } from "./employment";
import { JOB_ID, markJobExperienced, pastJobCareer } from "./jobExperience";
import { mutableRelOf, relStateOf } from "./relationship";
import { clampMental, clampResource, gainSkill, skillTo100 } from "./stats";
import { recordMission } from "./missions";
import { maybeQueueJobScene } from "./jobAdult";
import { addSchedule } from "./time";
import { chance, pick, uid } from "@/utils/random";

/**
 * 다단계 사업자직.
 *
 * - **입사**: 채용 사이트가 없다. 다단계 계정(이스터에그 `pyramid` 트윗 좋아요)에서 오는
 *   **이사님 DM의 제의를 수락**하는 것이 유일한 경로다 — AV배우 제의와 같은 방식.
 * - **근무**: 주5일 평일 낮 **강제 출근**(회사원·코치와 같은 취급 — app이 영업 모달을 띄운다).
 * - **급여**: 고정급이 **없다**. 오히려 매월 10일 재고 매입비가 **빠져나간다**(economy.ts).
 *   판매 수당만이 수입이고, 안 팔면 순손실이다. 그 압박이 지인을 태우게 만든다.
 * - **영업 선택**: 출근하면 둘 중 하나를 고른다.
 *   - **지인 판매**: 성사율이 높다(호감도에 비례). 대신 **그 사람의 호감도를 태운다.**
 *     0이 되면 연락이 끊겨 권유 대상에서 영구히 빠지고, 관계 서사도 함께 막힌다.
 *   - **길거리 홍보**: 성사율이 낮다(친화력·평판). 대신 아무도 잃지 않고 친화력이 오른다.
 *
 * ⚠️ 지인은 **유한한 자원**이다. 그게 이 직업의 전부다 — 관계(relationships)를 자원으로
 *    태우는 유일한 직업이고, 다 태우면 길거리 홍보만 남는다.
 */

/** 지금 출근 시간인지(평일 낮). 등록 당일은 쉬고 익일부터 — 코치와 같은 규칙. */
export function isMlmWorkNow(state: GameState): boolean {
  if (!state.mlmJob || state.gameOver) return false;
  if (state.day <= state.mlmJob.hiredDay) return false;
  return isWeekday(state.day) && state.slot === MORNING_SLOT;
}

/** 자격 조건 없음 — 이미 사업자인 경우만 막는다. */
export function canJoinMlm(state: GameState): boolean {
  return !state.gameOver && !state.mlmJob;
}

/**
 * 사업자 등록. 겸직 불가라 기존 직업을 정리한다(호출부가 먼저 확인을 받아야 한다).
 *
 * ⚠️ 화면에서 직접 부르지 마라 — 입사 경로는 DM 제의뿐이므로 `acceptMlmOffer`를 쓴다.
 */
export function joinMlm(state: GameState): MlmJob | null {
  if (!canJoinMlm(state)) return null;
  if (hasAnyJob(state)) quitCurrentJob(state);
  state.mlmJob = {
    hiredDay: state.day,
    contracts: pastJobCareer(state, JOB_ID.mlm), // 이직해도 경력이 이어진다(jobExperience.pastJobCareer)
    totalCommission: 0,
    burnedContacts: [],
    lastSalaryMonth: -1,
  };
  markJobExperienced(state, JOB_ID.mlm);
  addSchedule(state, `${MLM_COMPANY} ${MLM_TITLE} 등록`, "system");
  return state.mlmJob;
}

/** 사업자 그만두기 — `employment.quitCurrentJob`과 짝(문구를 그쪽과 같게 유지할 것). */
export function quitMlm(state: GameState): void {
  if (!state.mlmJob) return;
  state.mlmJob = null;
  addSchedule(state, `${MLM_COMPANY} 탈퇴`, "system");
}

/* ─────────────────── 이사님 DM 제의 ─────────────────── */

/** 제의 스레드를 찾아 플래그를 내리고, 이사님의 마지막 말을 덧붙인다. */
function closeOffer(state: GameState, threadId: string, line: string): void {
  const thread = getActiveAccount(state).dms.find((t) => t.id === threadId);
  if (!thread) return;
  thread.mlmOffer = false;
  thread.messages.push({ id: uid("dmm"), from: "partner", text: line, day: state.day });
  thread.unread = true;
}

/**
 * 이사님 제의 수락 → 사업자 등록. 이 직업의 유일한 입사 경로다.
 *
 * ⚠️ **기존 직업이 있으면 아무것도 하지 않는다** — UI가 전환 여부를 물어
 *    `switchToMlm`을 호출한다(직업 배타, AV배우와 같은 규칙).
 */
export function acceptMlmOffer(state: GameState, threadId: string): void {
  if (hasAnyJob(state)) return;
  if (!joinMlm(state)) return;
  closeOffer(state, threadId, MLM_ACCEPT_LINE);
}

/** 기존 직업을 그만두고 다단계로 갈아탄다(UI 전환 확정 시). */
export function switchToMlm(state: GameState, threadId: string): void {
  quitCurrentJob(state);
  acceptMlmOffer(state, threadId);
}

/** 제의 거절 → 플래그만 내린다(재제의 없음). */
export function declineMlmOffer(state: GameState, threadId: string): void {
  closeOffer(state, threadId, MLM_DECLINE_LINE);
}

/* ─────────────────── 지인 판매 ─────────────────── */

/**
 * 지금 권할 수 있는 지인 목록.
 *
 * 조건: **이미 아는 사이여야 하고**(호감도 > 0), 연락이 끊기지 않았어야 한다.
 * 호감도 0인 캐릭터는 애초에 '지인'이 아니므로 목록에 안 뜬다 — 모르는 사람에게
 * 권하는 건 길거리 홍보다.
 */
export function knownContacts(state: GameState): typeof RELATIONSHIP_CHARS {
  const burned = state.mlmJob?.burnedContacts ?? [];
  return RELATIONSHIP_CHARS.filter((c) => {
    if (burned.includes(c.id)) return false;
    return relStateOf(state, c.id).affinity > KNOWN_BURNED_AT;
  });
}

/** 그 지인에게 권했을 때의 성사율(0~1). 친할수록 거절하기 어렵다. */
export function knownChance(state: GameState, charId: string): number {
  const affinity = relStateOf(state, charId).affinity;
  const p = KNOWN_BASE_CHANCE + (affinity / 100) * KNOWN_AFFINITY_WEIGHT;
  return Math.max(0.15, Math.min(0.95, p));
}

export interface SalesResult {
  /** 판매가 성사됐는지 */
  signed: boolean;
  /** 받은 수당(원). 실패면 0 */
  commission: number;
  /** 화면에 띄울 결과 문구 */
  line: string;
  /** 이번 권유로 연락이 끊긴 지인 id(없으면 null) */
  burned: string | null;
}

/**
 * 지인 판매 1회.
 *
 * ⚠️ 호감도는 **성사 여부와 무관하게** 깎인다. 물어본 것 자체가 관계에 부담이기 때문이고,
 *    "실패하면 손해가 없다"면 지인을 무한히 긁는 게 지배 전략이 된다.
 */
export function sellToKnown(state: GameState, charId: string): SalesResult | null {
  const job = state.mlmJob;
  const char = getRelChar(charId);
  if (!job || !char) return null;

  const signed = chance(knownChance(state, charId));
  const rel = mutableRelOf(state, charId);
  const cost = KNOWN_AFFINITY_COST + (signed ? KNOWN_AFFINITY_COST_SIGNED : 0);
  rel.affinity = clampResource(rel.affinity - cost);

  let commission = 0;
  if (signed) {
    commission = Math.round(MLM_COMMISSION * KNOWN_SIZE_MULTIPLIER);
    state.money += commission;
    job.contracts += 1;
    job.totalCommission += commission;
    recordMission(state, "sale"); // 도전과제: **성사된** 판매만 센다(허탕은 실적이 아니다)
    maybeQueueJobScene(state, "mlm");
  }

  // 호감도가 바닥나면 연락이 끊긴다 — 권유 대상에서도, 관계 서사에서도 빠진다.
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
    signed ? `지인 판매 성사 (+${commission.toLocaleString("ko-KR")}원)` : "지인 권유 실패",
    "offline",
  );
  return { signed, commission, line, burned };
}

/* ─────────────────── 길거리 홍보 ─────────────────── */

/** 길거리 홍보 성사율(0~1). 친화력·평판이 곧 실력이다. */
export function coldChance(state: GameState): number {
  const soc = skillTo100(state.skills.sociability) / 100;
  const rep = state.resources.reputation / 100;
  const p = COLD_BASE_CHANCE + soc * COLD_SOCIABILITY_WEIGHT + rep * COLD_REPUTATION_WEIGHT;
  return Math.max(0.03, Math.min(0.9, p));
}

/** 이번에 붙잡을 사람. **상태를 바꾸지 않는다** — ui가 보여준 뒤 sellToCold를 부른다. */
export function rollColdTarget(): ColdTarget {
  return pick(COLD_TARGETS as ColdTarget[]);
}

/** 길거리 홍보 1회. 아무도 잃지 않는 대신 정신력을 낸다. */
export function sellToCold(state: GameState): SalesResult | null {
  const job = state.mlmJob;
  if (!job) return null;

  const signed = chance(coldChance(state));
  state.resources.mental = clampMental(state, state.resources.mental - COLD_MENTAL_COST);
  gainSkill(state, "sociability", COLD_SOCIABILITY_GAIN);

  let commission = 0;
  if (signed) {
    commission = MLM_COMMISSION;
    state.money += commission;
    job.contracts += 1;
    job.totalCommission += commission;
    recordMission(state, "sale"); // 도전과제: **성사된** 판매만 센다(허탕은 실적이 아니다)
    maybeQueueJobScene(state, "mlm");
  }

  addSchedule(
    state,
    signed ? `신규 판매 성사 (+${commission.toLocaleString("ko-KR")}원)` : "홍보 허탕",
    "offline",
  );
  return {
    signed,
    commission,
    line: pick((signed ? COLD_SUCCESS_LINES : COLD_FAIL_LINES) as string[]),
    burned: null,
  };
}
