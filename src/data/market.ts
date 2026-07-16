import type { MarketState } from "@/core/types";

/** 투자 자산 정의(주식/코인). 변동성이 클수록 하루 가격 출렁임이 크다. */
export interface MarketAsset {
  id: string;
  name: string;
  kind: "stock" | "coin";
  /** 시작가(원) */
  basePrice: number;
  /** 하루 변동 폭(±비율). 0.05 = 최대 ±5% */
  volatility: number;
}

export const MARKET_ASSETS: MarketAsset[] = [
  { id: "samsong", name: "삼송전자", kind: "stock", basePrice: 70_000, volatility: 0.04 },
  { id: "naenom", name: "네이놈", kind: "stock", basePrice: 210_000, volatility: 0.06 },
  { id: "ktube", name: "케이튜브", kind: "stock", basePrice: 45_000, volatility: 0.08 },
  { id: "doge", name: "도지코인", kind: "coin", basePrice: 500, volatility: 0.18 },
  { id: "bitkorn", name: "비트콘", kind: "coin", basePrice: 3_800_000, volatility: 0.12 },
];

/** 게임 시작 시의 시장 상태(모든 자산을 시작가로, 보유 0) */
export function initialMarket(): MarketState {
  const prices: Record<string, number> = {};
  const holdings: Record<string, number> = {};
  for (const a of MARKET_ASSETS) {
    prices[a.id] = a.basePrice;
    holdings[a.id] = 0;
  }
  return { prices, prevPrices: { ...prices }, holdings };
}
