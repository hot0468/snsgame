import type { GameState, KakaoLoanOffer } from "@/core/types";
import { LOAN_DEFAULT_ENDING_REASON, LOAN_DEFAULT_ENDING_REASON_ADULT } from "@/core/state";
import { pick } from "@/utils/random";
import { pushKakao } from "./kakao";

/**
 * 대부(사채) 시스템.
 * - 소지금이 마이너스가 되면 대부업체가 카톡으로 대출을 제안한다.
 * - 수락하면 즉시 원금을 받고, 기한 내에 이자까지 갚아야 한다.
 * - 못 갚으면 3일간 잡혀가고, 취업 중이면 성과가 대폭 하락한다.
 * - 잡혀갈 때마다 빚은 '몸으로 때워' 소멸하지만 연체 횟수는 누적된다.
 *   3회째엔 엔딩(월세 3연체 퇴거와 같은 스트라이크 구조).
 */

/** 대출 원금 */
export const LOAN_PRINCIPAL = 1_000_000;
/** 갚아야 할 금액(원금+이자) */
export const LOAN_REPAY = 1_200_000;
/** 상환 기한(일) */
export const LOAN_TERM_DAYS = 14;
/** 못 갚았을 때 잡혀가는 기간(일) */
export const CAPTURE_DAYS = 3;
/** 이 횟수만큼 연체(잡혀감)하면 엔딩 */
export const LOAN_DEFAULT_ENDING_STREAK = 3;

const LENDER_NAME = "든든머니 대부";

const LENDER_OPENERS = [
  "고객님, 급전 필요하지 않으세요? 💰 무심사 즉시 100만원! 딱 2주만 쓰고 120만원으로 갚으시면 돼요~",
  "잔고가 마이너스시네요? 저희가 바로 100만원 넣어드립니다. 2주 뒤 120만원, 아주 간단하죠?",
  "지금 힘드시죠? 한 통이면 100만원이 들어와요. 2주 후 120만원만 갚으시면 끝!",
];

/**
 * 대부업체 대출 제안 카톡을 보낸다(제안 플래그를 세운다).
 * economy.applyDailyCosts에서 소지금이 마이너스일 때 호출된다.
 */
export function offerLoan(state: GameState): void {
  const thread = pushKakao(state, LENDER_NAME, [pick(LENDER_OPENERS)], { hue: 280 });
  thread.loanOffer = {
    principal: LOAN_PRINCIPAL,
    repayAmount: LOAN_REPAY,
    termDays: LOAN_TERM_DAYS,
  };
  state.loanOffered = true;
}

/** 대출을 수락한다: 즉시 원금을 받고, 기한 내 상환 의무가 생긴다. */
export function acceptLoan(state: GameState, offer: KakaoLoanOffer): void {
  state.loan = {
    principal: offer.principal,
    repayAmount: offer.repayAmount,
    dueDay: state.day + offer.termDays,
  };
  state.money += offer.principal;
}

/** 오늘이 상환 마감일(또는 지났는지) */
export function isLoanDue(state: GameState): boolean {
  return state.loan != null && state.day >= state.loan.dueDay;
}

/** 상환 가능한지 */
export function canRepayLoan(state: GameState): boolean {
  return state.loan != null && state.money >= state.loan.repayAmount;
}

/** 빚을 갚는다(상환 가능할 때). */
export function repayLoan(state: GameState): number {
  const loan = state.loan;
  if (!loan) return 0;
  const amount = loan.repayAmount;
  state.money -= amount;
  state.loan = null;
  state.loanOffered = false;
  return amount;
}

export interface CaptureResult {
  /** 취업 중이라 성과가 크게 깎였는지 */
  performanceHit: boolean;
  /** 이번 잡혀감을 포함한 누적 연체 횟수 */
  defaultStreak: number;
  /** 3회 연체로 엔딩이 확정됐으면 그 사유. 아니면 null */
  endingReason: string | null;
}

/**
 * 빚을 못 갚아 잡혀갈 때의 페널티를 적용한다(정신력↓, 취업 중이면 성과 대폭↓).
 * 빚은 '몸으로 때워' 소멸한다. 시간(3일) 소모는 UI에서 advanceTime으로 처리한다.
 * 3회째 연체면 gameOver를 세운다 — 성인 모드는 실종, 아니면 부모님에게 들켜 강제 귀향.
 */
export function applyCapturePenalty(state: GameState): CaptureResult {
  state.resources.mental = Math.max(0, state.resources.mental - 30);
  let performanceHit = false;
  if (state.employment) {
    state.employment.performance = Math.max(0, state.employment.performance - 40);
    performanceHit = true;
  }
  state.loan = null;
  state.loanOffered = false;
  // 잡혀간 사흘 사이 계좌까지 털린다 — 소지금은 0(마이너스였어도 0으로 정리).
  state.money = 0;
  state.loanDefaultStreak += 1;

  let endingReason: string | null = null;
  if (!state.gameOver && state.loanDefaultStreak >= LOAN_DEFAULT_ENDING_STREAK) {
    endingReason = state.adultMode
      ? LOAN_DEFAULT_ENDING_REASON_ADULT
      : LOAN_DEFAULT_ENDING_REASON;
    state.gameOver = endingReason;
  }
  return { performanceHit, defaultStreak: state.loanDefaultStreak, endingReason };
}
