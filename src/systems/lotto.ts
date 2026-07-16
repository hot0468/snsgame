import type { GameState } from "@/core/types";
import { dayOfWeek } from "./calendar";
import { addSchedule } from "./time";

/**
 * 네이놈 로또.
 * - 복권을 사면 '다음 토요일'이 추첨일로 잡힌다.
 * - 추첨일(토요일) 이후 다시 확인하면 당첨 여부가 결정된다.
 * - 당첨되면 20억 지급.
 */

/** 복권 1장 가격 */
export const LOTTO_PRICE = 5_000;
/** 1등 당첨금(20억) */
export const LOTTO_PRIZE = 2_000_000_000;
/** 당첨 확률 */
export const LOTTO_WIN_CHANCE = 0.005;

const SATURDAY = 6;

/** 오늘 이후 가장 가까운 토요일의 day(오늘이 토요일이면 다음 주 토요일). */
export function nextSaturday(day: number): number {
  let d = day + 1;
  while (dayOfWeek(d) !== SATURDAY) d += 1;
  return d;
}

/** 복권을 살 수 있는지(미보유 + 잔고 충분) */
export function canBuyLotto(state: GameState): boolean {
  return !state.lotto && state.money >= LOTTO_PRICE;
}

/** 복권을 산다. 다음 토요일이 추첨일로 잡힌다. @returns 샀으면 true */
export function buyLotto(state: GameState): boolean {
  if (!canBuyLotto(state)) return false;
  state.money -= LOTTO_PRICE;
  state.lotto = { drawDay: nextSaturday(state.day) };
  addSchedule(state, "복권 구입", "system");
  return true;
}

export interface LottoStatus {
  /** 상태: 미보유 / 추첨 대기(추첨일 전) / 추첨 가능(추첨일 이후) */
  kind: "none" | "waiting" | "ready";
  drawDay?: number;
}

/** 현재 복권 상태(구입 여부·추첨 가능 여부) */
export function lottoStatus(state: GameState): LottoStatus {
  const l = state.lotto;
  if (!l) return { kind: "none" };
  if (state.day < l.drawDay) return { kind: "waiting", drawDay: l.drawDay };
  return { kind: "ready", drawDay: l.drawDay };
}

export interface LottoDraw {
  won: boolean;
  prize: number;
}

/** 추첨 결과를 확인한다(추첨일 이후에만 유효). 결과 확인 시 복권은 소멸. */
export function drawLotto(state: GameState): LottoDraw {
  const won = Math.random() < LOTTO_WIN_CHANCE;
  state.lotto = null;
  if (won) {
    state.money += LOTTO_PRIZE;
    addSchedule(state, `복권 1등 당첨! +${LOTTO_PRIZE.toLocaleString("ko-KR")}원`, "system");
    return { won: true, prize: LOTTO_PRIZE };
  }
  addSchedule(state, "복권 낙첨", "system");
  return { won: false, prize: 0 };
}
