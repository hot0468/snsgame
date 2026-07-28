import type { GameState } from "@/core/types";
import { MARKET_ASSETS } from "@/data/market";
import { getActiveAccount } from "@/core/state";
import { ATTRIBUTES } from "@/data/attributes";
import { unlockAttribute } from "./attributeUnlock";
import { addSchedule } from "./time";

/**
 * 투자 시장 시스템 — 매일 시세가 랜덤 워크로 출렁이고, 소지금으로 사고팔 수 있다.
 */

/** 가격 하한 배수(시작가 대비) */
const MIN_FACTOR = 0.1;

/** 하루가 지날 때 모든 자산 시세를 갱신한다. */
export function updateMarket(state: GameState): void {
  const m = state.market;
  m.prevPrices = { ...m.prices };
  for (const a of MARKET_ASSETS) {
    const cur = m.prices[a.id] ?? a.basePrice;
    const pct = (Math.random() * 2 - 1) * a.volatility;
    const floor = Math.round(a.basePrice * MIN_FACTOR);
    m.prices[a.id] = Math.max(floor, Math.round(cur * (1 + pct)));
  }
}

export function assetPrice(state: GameState, id: string): number {
  return state.market.prices[id] ?? 0;
}

export function holdingOf(state: GameState, id: string): number {
  return state.market.holdings[id] ?? 0;
}

/** 보유분의 매수 원가 합계(원). 보유가 없으면 0. */
export function costOf(state: GameState, id: string): number {
  return state.market.cost?.[id] ?? 0;
}

/** 평단가(원). 보유가 없으면 0 — 나눗셈 전에 반드시 이 함수를 거쳐라. */
export function avgCostOf(state: GameState, id: string): number {
  const held = holdingOf(state, id);
  return held > 0 ? costOf(state, id) / held : 0;
}

export interface AssetProfit {
  /** 현재 평가액(보유량 × 현재가) */
  value: number;
  /** 평가손익(원). 평가액 - 매수 원가 */
  profit: number;
  /** 수익률(%). 원가가 0이면 0 */
  pct: number;
}

/** 종목별 평가손익. 보유가 없으면 전부 0. */
export function assetProfit(state: GameState, id: string): AssetProfit {
  const value = holdingOf(state, id) * assetPrice(state, id);
  const cost = costOf(state, id);
  const profit = value - cost;
  return { value, profit, pct: cost > 0 ? (profit / cost) * 100 : 0 };
}

/** 전 종목 합산 평가손익(히어로 카드용) */
export function totalProfit(state: GameState): AssetProfit {
  let value = 0;
  let cost = 0;
  for (const a of MARKET_ASSETS) {
    value += holdingOf(state, a.id) * assetPrice(state, a.id);
    cost += costOf(state, a.id);
  }
  const profit = value - cost;
  return { value, profit, pct: cost > 0 ? (profit / cost) * 100 : 0 };
}

/** 전일 대비 등락률(%) */
export function dayChangePct(state: GameState, id: string): number {
  const prev = state.market.prevPrices[id] ?? state.market.prices[id] ?? 0;
  const cur = state.market.prices[id] ?? 0;
  if (!prev) return 0;
  return ((cur - prev) / prev) * 100;
}

/** 보유 자산 평가액 합계 */
export function portfolioValue(state: GameState): number {
  return MARKET_ASSETS.reduce(
    (sum, a) => sum + holdingOf(state, a.id) * assetPrice(state, a.id),
    0,
  );
}

/**
 * 첫 매매를 하면 재테크계(finance) 트윗 속성을 즉시 해금한다.
 * 직접 굴려봤으니 이제 주식 얘기를 트윗한다는 흐름 — 교양 랜덤과 별개의 확정 경로.
 * unlockAttribute가 멱등이라 매 거래마다 불러도 최초 1회만 실제로 열린다.
 */
function unlockFinanceOnTrade(state: GameState): void {
  const account = getActiveAccount(state);
  if (unlockAttribute(state, account, "finance")) {
    addSchedule(state, `새 트윗 속성 해금: ${ATTRIBUTES.finance.label}`, "system");
  }
}

/** 지정 수량 매수. 잔고가 부족하면 아무것도 하지 않는다. @returns 실제 매수 수량 */
export function buyAsset(state: GameState, id: string, shares: number): number {
  if (shares <= 0) return 0;
  const cost = assetPrice(state, id) * shares;
  if (state.money < cost) return 0;
  state.money -= cost;
  state.market.holdings[id] = holdingOf(state, id) + shares;
  // 원가는 실제 지불액을 그대로 누적한다(이동평균법의 분자).
  state.market.cost[id] = costOf(state, id) + cost;
  unlockFinanceOnTrade(state);
  return shares;
}

/** 지정 수량 매도(보유량 한도). @returns 실제 매도 수량 */
export function sellAsset(state: GameState, id: string, shares: number): number {
  const held = holdingOf(state, id);
  const n = Math.min(shares, held);
  if (n <= 0) return 0;
  state.money += assetPrice(state, id) * n;
  state.market.holdings[id] = held - n;
  // 판 만큼의 원가를 덜어낸다(평단가는 유지). 전량 매도면 정확히 0이 되게 남은 비율로 곱한다 —
  // 평단가 × n으로 빼면 부동소수 오차가 쌓여 '보유 0인데 원가가 남는' 상태가 된다.
  state.market.cost[id] = held - n === 0 ? 0 : costOf(state, id) * ((held - n) / held);
  unlockFinanceOnTrade(state);
  return n;
}
