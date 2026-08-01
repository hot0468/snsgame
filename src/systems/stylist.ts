import type { GameState, StylistJob } from "@/core/types";
import {
  BOOKING_BASE,
  BOOKING_MAX,
  BOOKING_PER_FOLLOWER,
  BOTCH_REPUTATION,
  CUSTOMERS,
  CUT_BASE_CHANCE,
  CUT_SKILL_WEIGHT,
  CUT_STYLES,
  FAME_CAP_FOLLOWERS,
  FAME_FEE_BONUS_MAX,
  REGULAR_BASE_CHANCE,
  REGULAR_BONUS_MAX,
  REGULAR_FEE_BONUS,
  REGULAR_LOST_ON_FAIL,
  SKILL_FEE_BONUS_MAX,
  STYLIST_BASE_FEE,
  STYLIST_MENTAL_COST,
  STYLIST_REQ_CERT,
  type Customer,
  type CutStyle,
} from "@/data/stylist";
import { accountsTotalFollowers } from "./followers";
import { hasAnyJob, quitCurrentJob } from "./employment";
import { JOB_ID, markJobExperienced } from "./jobExperience";
import { clampMental, clampResource, gainSkill, skillTo100 } from "./stats";
import { addSchedule } from "./time";
import { chance, pick } from "@/utils/random";

/**
 * 헤어디자이너직.
 *
 * ⚠️ **이 직업만 SNS 본편과 협력한다.**
 *    택시는 심야 슬롯을 뺏고(경쟁), 콜센터는 정신력을 깎아 육성을 늦추고(경쟁),
 *    회사원·코치는 낮 슬롯을 가져간다(경쟁). 헤어디자이너는 반대다 —
 *    **팔로워가 예약을 데려오고 단가까지 올린다.** SNS를 키우는 게 그대로 본업 수입이다.
 *
 * - **진입**: 미용사(일반) 자격증. 운전면허처럼 쓸 데 없던 자격증이 여기서 값을 한다.
 * - **근무**: 현생 살기 → 일 → [손님 받기]. 한 타임에 예약 수만큼 손님을 받는다.
 * - **수입**: 시술비 즉시. 팔로워·뷰티 스킬·단골이 단가에 곱해진다.
 * - **단골**: 잘 하면 쌓이고 망치면 떠난다. 보험의 지인이 *태우는* 자원이라면
 *   단골은 *쌓는* 자원이다 — 방향이 반대라 두 직업이 안 겹친다.
 * - **실수의 대가**: 망치면 손님이 SNS에 올린다(평판 -4). 직업 실수가 본편으로 되돌아오는
 *   유일한 직업이다.
 */

/** 미용사 자격증이 있는지 — 취업 자격. */
export function hasStylistLicense(state: GameState): boolean {
  return state.certifications.includes(STYLIST_REQ_CERT);
}

/** 지금 가위손에 취업할 수 있는지. */
export function canApplyStylist(state: GameState): boolean {
  return !state.gameOver && !state.stylistJob && hasStylistLicense(state);
}

/** 입사. 겸직 불가라 기존 직업을 정리한다(호출부가 먼저 확인을 받아야 한다). */
export function joinStylist(state: GameState): StylistJob | null {
  if (!canApplyStylist(state)) return null;
  if (hasAnyJob(state)) quitCurrentJob(state);
  state.stylistJob = { hiredDay: state.day, cuts: 0, totalEarned: 0, regulars: 0, botched: 0 };
  markJobExperienced(state, JOB_ID.stylist);
  addSchedule(state, `${"가위손"} 입사`, "system");
  return state.stylistJob;
}

/** 미용실 퇴사 — `employment.quitCurrentJob`과 짝(문구를 그쪽과 같게 유지할 것). */
export function quitStylist(state: GameState): void {
  if (!state.stylistJob) return;
  state.stylistJob = null;
  addSchedule(state, "가위손 퇴사", "system");
}

/* ─────────────────── 팔로워 → 손님 ─────────────────── */

/**
 * 이번 타임에 잡힌 예약 수. **팔로워가 손님을 데려온다** — 이 직업의 축이다.
 * 계정이 여럿이면 합계로 본다(가게 앞에 붙는 건 사람이지 계정이 아니다).
 */
export function bookingCount(state: GameState): number {
  const followers = accountsTotalFollowers(state);
  return Math.min(BOOKING_MAX, BOOKING_BASE + Math.floor(followers / BOOKING_PER_FOLLOWER));
}

/** 팔로워가 단가에 얹는 배율(1 ~ 1.8). */
export function fameFeeMultiplier(state: GameState): number {
  const f = Math.max(0, accountsTotalFollowers(state));
  return 1 + Math.min(1, f / FAME_CAP_FOLLOWERS) * FAME_FEE_BONUS_MAX;
}

/** 뷰티 스킬이 단가에 얹는 배율(1 ~ 2.2). 실력이 명성보다 크게 먹는다. */
export function skillFeeMultiplier(state: GameState): number {
  const b = skillTo100(state.skills.beauty) / 100;
  return 1 + Math.min(1, Math.max(0, b)) * SKILL_FEE_BONUS_MAX;
}

/** 단골이 단가에 얹는 배율(1 ~ 1.6). */
export function regularFeeMultiplier(state: GameState): number {
  const n = state.stylistJob?.regulars ?? 0;
  return 1 + Math.min(REGULAR_BONUS_MAX, n * REGULAR_FEE_BONUS);
}

/** 그 시술의 예상 시술비(성공 여부 판정 전). */
export function estimateFee(state: GameState, style: CutStyle): number {
  return Math.round(
    STYLIST_BASE_FEE *
      style.feeMul *
      fameFeeMultiplier(state) *
      skillFeeMultiplier(state) *
      regularFeeMultiplier(state),
  );
}

/* ─────────────────── 시술 ─────────────────── */

/** 그 시술의 성공률(0~1). 뷰티 스킬이 실력이다. */
export function cutChance(state: GameState, style: CutStyle): number {
  const b = skillTo100(state.skills.beauty) / 100;
  const p = CUT_BASE_CHANCE + b * CUT_SKILL_WEIGHT + style.chanceMod;
  return Math.max(0.3, Math.min(0.97, p));
}

/** 이번 손님. **상태를 바꾸지 않는다** — ui가 보여준 뒤 doCut을 부른다. */
export function rollCustomer(): Customer {
  return pick(CUSTOMERS as Customer[]);
}

/** 그 손님이 고를 수 있는 시술 목록(원하는 게 정해진 손님이면 그것만). */
export function stylesFor(customer: Customer): CutStyle[] {
  if (!customer.wants) return CUT_STYLES as CutStyle[];
  const only = CUT_STYLES.find((s) => s.id === customer.wants);
  return only ? [only] : (CUT_STYLES as CutStyle[]);
}

export interface CutResult {
  /** 시술이 잘 나왔는지 */
  ok: boolean;
  /** 받은 시술비(원). 망쳐도 절반은 받는다 */
  fee: number;
  /** 이번 시술로 단골이 됐는지 */
  gainedRegular: boolean;
  /** 이번 시술로 떠난 단골 수 */
  lostRegulars: number;
  /** 화면에 띄울 문구 */
  line: string;
}

/**
 * 시술 1건. **행동력·시간은 호출부(현생 살기)가 타임 시작에 한 번만** 처리한다.
 *
 * ⚠️ 망쳐도 시술비는 절반 받는다. 0원이면 어려운 시술을 시도할 이유가 사라지고,
 *    모두가 '다듬기'만 하게 되어 시술 5종이 죽는다.
 */
export function doCut(state: GameState, style: CutStyle): CutResult | null {
  const job = state.stylistJob;
  if (!job) return null;

  const base = estimateFee(state, style);
  const ok = chance(cutChance(state, style));
  const fee = ok ? base : Math.round(base * 0.5);

  state.money += fee;
  job.cuts += 1;
  job.totalEarned += fee;

  let gainedRegular = false;
  let lostRegulars = 0;
  if (ok) {
    // 실력이 좋을수록 단골이 붙는다.
    const p = REGULAR_BASE_CHANCE + (skillTo100(state.skills.beauty) / 100) * 0.3;
    if (chance(p)) {
      job.regulars += 1;
      gainedRegular = true;
    }
  } else {
    job.botched += 1;
    lostRegulars = Math.min(job.regulars, REGULAR_LOST_ON_FAIL);
    job.regulars -= lostRegulars;
    // 손님이 SNS에 올린다 — 직업 실수가 본편 평판으로 되돌아오는 유일한 지점.
    state.resources.reputation = clampResource(state.resources.reputation + BOTCH_REPUTATION);
  }

  state.resources.mental = clampMental(state, state.resources.mental - STYLIST_MENTAL_COST);
  gainSkill(state, "beauty", ok ? 6 : 3);
  gainSkill(state, "sociability", 2);

  const line =
    (ok ? style.success : style.fail) +
    (gainedRegular ? "\n\n\"다음에도 예약할게요.\" 단골이 한 명 늘었다." : "") +
    (lostRegulars > 0 ? `\n\n소문이 돌았는지 예약 ${lostRegulars}건이 취소됐다.` : "");

  addSchedule(
    state,
    `${style.label} 시술 (+${fee.toLocaleString("ko-KR")}원)${ok ? "" : " — 실수"}`,
    "offline",
  );
  return { ok, fee, gainedRegular, lostRegulars, line };
}
