import type { GameState } from "@/core/types";
import { DONATION_TARGETS, type DonationTarget } from "@/data/donation";
import { clampResource } from "./stats";
import { addSchedule } from "./time";

/**
 * 기부 — 돈을 **도덕성**으로 바꾼다.
 *
 * ⚠️ **평판은 안 준다**(사용자 확정). 횟수 제한이 없어서 평판까지 주면 현금으로 무한히
 *    살 수 있고, 평판은 도달 배율 3.3배가 걸린 축이라 트윗·논란 관리가 무의미해진다.
 *    도덕성은 올리는 창구가 여기뿐이라(깎이는 지점은 400곳) 그쪽만 연다.
 */

export function donationTargetById(id: string): DonationTarget | undefined {
  return DONATION_TARGETS.find((t) => t.id === id);
}

/** 이 금액이면 효과 몇 단계인가(상한 적용). 최소액 미만이면 0. */
export function donationSteps(target: DonationTarget, amount: number): number {
  if (amount < target.minAmount) return 0;
  return Math.min(target.maxSteps, Math.max(1, Math.floor(amount / target.perStep)));
}

export type DonateResult = "ok" | "poor" | "tooSmall" | "unknown";

export interface DonationOutcome {
  result: DonateResult;
  /** 실제로 오른 도덕성(성공했을 때만 0 초과) */
  morality: number;
  steps: number;
}

/**
 * 기부한다. 실패하면 **아무것도 바꾸지 않는다**(돈이 빠진 채 실패하는 경로를 두지 않는다).
 */
export function donate(state: GameState, id: string, amount: number): DonationOutcome {
  const miss: DonationOutcome = { result: "unknown", morality: 0, steps: 0 };
  const target = donationTargetById(id);
  if (!target) return miss;
  if (amount < target.minAmount) return { ...miss, result: "tooSmall" };
  if (state.money < amount) return { ...miss, result: "poor" };

  const steps = donationSteps(target, amount);
  const morBefore = state.resources.morality;

  state.money -= amount;
  state.donatedTotal = (state.donatedTotal ?? 0) + amount;
  state.donatedCount = (state.donatedCount ?? 0) + 1;
  state.resources.morality = clampResource(morBefore + target.moralityPerStep * steps);

  addSchedule(state, `${target.name} 기부 -${amount.toLocaleString("ko-KR")}원`, "system");
  return {
    result: "ok",
    // 클램프 후 실제 반영분을 돌려준다 — 선언값을 보여주면 상한에서 거짓말이 된다.
    morality: state.resources.morality - morBefore,
    steps,
  };
}
