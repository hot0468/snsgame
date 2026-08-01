import type { GameState, TaxiJob } from "@/core/types";
import {
  TAXI_ACTION_COST,
  TAXI_BASE_FARE,
  TAXI_DELUXE_CERT,
  TAXI_DELUXE_MULTIPLIER,
  TAXI_NIGHT_MULTIPLIER,
  TAXI_PASSENGERS,
  TAXI_RATING_FARE_MAX,
  TAXI_RATING_FARE_MIN,
  TAXI_RATING_START,
  TAXI_RATING_TIERS,
  TAXI_REQ_CERT,
  type TaxiChoice,
  type TaxiPassenger,
} from "@/data/taxi";
import { LATE_SLOT } from "@/core/state";
import { hasAnyJob, quitCurrentJob } from "./employment";
import { JOB_ID, markJobExperienced } from "./jobExperience";
import { clampMental, clampResource, gainSkill } from "./stats";
import { addSchedule } from "./time";
import { pick } from "@/utils/random";

/**
 * 택시 기사직.
 *
 * - **진입**: 1종 보통 운전면허(`TAXI_REQ_CERT`)가 있으면 달빛운수에 지원할 수 있다.
 *   면허는 그동안 따도 쓸 데가 없던 자격증이었다 — 여기서 처음 값을 한다.
 * - **근무**: '현생 살기 → 일'의 [운행하기]. 슬롯 하나와 행동력을 쓴다.
 * - **수입**: **고정급이 없다.** 운행할 때마다 요금이 그 자리에서 들어온다.
 *   회사(10일)·강사(15일)·AV(26일)·작가(1일)가 전부 월급제라 이 축이 비어 있었다.
 *   안 뛰면 수입이 0이다.
 * - **심야 할증**: 심야 운행은 요금이 1.6배다. 대신 그 슬롯은 트윗 도달이 가장 좋은
 *   시간대라(`data/timing.ts`) 그날 제일 좋은 게시 기회를 파는 셈이다 — 이게 이 직업의 축이다.
 * - **평점**: 운행마다 승객 상황이 하나 뜨고, 응대에 따라 평점이 오르내린다.
 *   평점은 요금 단가에 곱해진다(0.8~1.3배).
 */

/** 1종 보통 면허가 있는지 — 지원 자격. */
export function hasTaxiLicense(state: GameState): boolean {
  return state.certifications.includes(TAXI_REQ_CERT);
}

/** 1종 대형까지 있는지 — 모범택시 승격 조건. */
export function isDeluxeTaxi(state: GameState): boolean {
  return state.certifications.includes(TAXI_DELUXE_CERT);
}

/** 지금 달빛운수에 지원할 수 있는지(이미 기사이거나 면허가 없으면 불가). */
export function canApplyTaxi(state: GameState): boolean {
  return !state.gameOver && !state.taxiJob && hasTaxiLicense(state);
}

/**
 * 달빛운수 입사. 겸직은 안 되므로 기존 직업을 정리하고 들어간다
 * (되돌릴 수 없으니 **호출부가 먼저 확인을 받아야 한다** — 강사 합격 메일과 같은 규칙).
 */
export function joinTaxi(state: GameState): TaxiJob | null {
  if (!canApplyTaxi(state)) return null;
  if (hasAnyJob(state)) quitCurrentJob(state);
  state.taxiJob = {
    hiredDay: state.day,
    totalRides: 0,
    totalEarned: 0,
    rating: TAXI_RATING_START,
  };
  markJobExperienced(state, JOB_ID.taxi);
  addSchedule(state, "달빛운수 입사", "system");
  return state.taxiJob;
}

/** 택시 사직 — `employment.quitCurrentJob`과 짝(문구를 그쪽과 같게 유지할 것). */
export function quitTaxi(state: GameState): void {
  if (!state.taxiJob) return;
  state.taxiJob = null;
  addSchedule(state, "달빛운수 퇴사", "system");
}

/* ─────────────────── 요금 ─────────────────── */

/** 평점(0~100) → 요금 배율(0.8~1.3). 선형. */
export function ratingFareMultiplier(rating: number): number {
  const r = Number.isFinite(rating) ? Math.max(0, Math.min(100, rating)) : TAXI_RATING_START;
  return TAXI_RATING_FARE_MIN + (r / 100) * (TAXI_RATING_FARE_MAX - TAXI_RATING_FARE_MIN);
}

/** 평점 → 표시용 등급 문구. */
export function ratingLabel(rating: number): string {
  const r = Number.isFinite(rating) ? rating : TAXI_RATING_START;
  return (TAXI_RATING_TIERS.find((t) => r >= t.min) ?? TAXI_RATING_TIERS[TAXI_RATING_TIERS.length - 1]).label;
}

/** 지금 슬롯이 심야인지 — 할증 판정. */
export function isNightShift(state: GameState): boolean {
  return state.slot === LATE_SLOT;
}

/**
 * 승객 응대 **전**의 예상 요금(기본 × 심야 × 모범 × 평점).
 * 승객 선택지의 `fareMul`은 여기 곱하지 않는다 — 굴림 전이라 알 수 없다.
 * (`systems/stats.ts`의 projectSkillGain이 등급 배율을 안 곱하는 것과 같은 이유.)
 */
export function estimateFare(state: GameState): number {
  const job = state.taxiJob;
  if (!job) return 0;
  let fare = TAXI_BASE_FARE;
  if (isNightShift(state)) fare *= TAXI_NIGHT_MULTIPLIER;
  if (isDeluxeTaxi(state)) fare *= TAXI_DELUXE_MULTIPLIER;
  fare *= ratingFareMultiplier(job.rating);
  return Math.round(fare);
}

/** 지금 운행할 수 있는지(재직 중 + 행동력). 슬롯 소모는 호출부(현생 살기)가 처리한다. */
export function canDrive(state: GameState): boolean {
  return !!state.taxiJob && !state.gameOver && state.resources.action >= TAXI_ACTION_COST;
}

/* ─────────────────── 운행 ─────────────────── */

/**
 * 이번 운행에 붙을 승객 상황을 뽑는다. 심야 전용(`nightOnly`)은 낮에 안 나온다.
 * **상태를 바꾸지 않는다** — ui가 먼저 상황을 보여주고, 유저가 고른 뒤 `resolveRide`를 부른다.
 */
export function rollPassenger(state: GameState): TaxiPassenger {
  const night = isNightShift(state);
  const pool = TAXI_PASSENGERS.filter((p) => night || !p.nightOnly);
  return pick(pool as TaxiPassenger[]);
}

export interface RideResult {
  /** 이번 운행으로 받은 요금(원) */
  fare: number;
  /** 평점 증감(실제 반영분) */
  ratingDelta: number;
  /** 반영 후 평점 */
  rating: number;
  /** 이번 운행이 심야였는지(할증 표시용) */
  night: boolean;
}

/**
 * 운행 1회를 정산한다. **행동력과 슬롯 소모는 호출부(현생 살기)가 처리한다** —
 * 여기서는 요금·평점·스탯만 만진다(`doLecture`와 같은 분담).
 */
export function resolveRide(state: GameState, choice: TaxiChoice): RideResult | null {
  const job = state.taxiJob;
  if (!job) return null;

  const night = isNightShift(state);
  // ⚠️ 평점을 **먼저** 반영하면 이번 요금이 이번 응대의 영향을 받는다. 요금은 '탈 때 정해진
  //    미터기'이므로 응대 전 평점으로 계산하고, 평점 변화는 다음 운행부터 먹는다.
  const base = estimateFare(state);
  const fare = Math.round(base * (choice.fareMul ?? 1));

  const before = job.rating;
  job.rating = clampResource(before + choice.rating);
  const ratingDelta = job.rating - before;

  job.totalRides += 1;
  job.totalEarned += fare;
  state.money += fare;

  if (choice.mental) state.resources.mental = clampMental(state, state.resources.mental + choice.mental);
  if (choice.morality) {
    state.resources.morality = clampResource(state.resources.morality + choice.morality);
  }
  // 종일 사람을 상대하는 일이다 — 친화력이 조금 오른다.
  gainSkill(state, "sociability", 4);

  addSchedule(state, `택시 운행 (+${fare.toLocaleString("ko-KR")}원)`, "offline");
  return { fare, ratingDelta, rating: job.rating, night };
}

/** 표시용 — 지금 운행하면 뜰 상황과 예상 요금(ui가 확인 화면에 쓴다). */
export function taxiStatusLine(state: GameState): string {
  const job = state.taxiJob;
  if (!job) return "";
  const night = isNightShift(state);
  return (
    `${ratingLabel(job.rating)} · 예상 요금 ${estimateFare(state).toLocaleString("ko-KR")}원` +
    (night ? " (심야 할증)" : "")
  );
}

