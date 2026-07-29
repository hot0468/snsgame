import type { MarketState } from "@/core/types";

/** 투자 자산 정의(주식/코인). 변동성이 클수록 하루 가격 출렁임이 크다. */
export interface MarketAsset {
  id: string;
  name: string;
  /** 주식 / 코인 / 실물·대체투자(억 단위 고가 자산) */
  kind: "stock" | "coin" | "asset";
  /** 시작가(원) */
  basePrice: number;
  /** 하루 변동 폭(±비율). 0.05 = 최대 ±5% */
  volatility: number;
}

/**
 * ⚠️ **가격대가 곧 이 목록의 존재 이유다.**
 * 주식·코인만 있던 시절엔 최고가가 비트콘 380만이라, 로또 1등(20억)이나 억대 자산을 굴릴 곳이
 * 없어 돈이 그냥 잠겼다(집 최상위 30억 ↔ FIRE 100억 사이가 비어 있다).
 * 아래 `asset` 3종이 그 구간을 메운다 — 지우거나 단가를 낮추면 그 구멍이 되돌아온다.
 *
 * 변동성은 가격에 반비례하게 잡았다. 12억짜리를 ±12%로 흔들면 하루 손익이
 * 집 한 채라 게임이 도박판이 된다.
 */
export const MARKET_ASSETS: MarketAsset[] = [
  { id: "samsong", name: "삼송전자", kind: "stock", basePrice: 70_000, volatility: 0.04 },
  { id: "naenom", name: "네이놈", kind: "stock", basePrice: 210_000, volatility: 0.06 },
  { id: "ktube", name: "케이튜브", kind: "stock", basePrice: 45_000, volatility: 0.08 },
  { id: "doge", name: "도지코인", kind: "coin", basePrice: 500, volatility: 0.18 },
  { id: "bitkorn", name: "비트콘", kind: "coin", basePrice: 3_800_000, volatility: 0.12 },
  // ── 억 단위 대체투자: 목돈이 갈 곳 ──
  { id: "goldbar", name: "골드바 1kg", kind: "asset", basePrice: 130_000_000, volatility: 0.025 },
  { id: "reit", name: "강남타워리츠", kind: "asset", basePrice: 500_000_000, volatility: 0.045 },
  { id: "artpiece", name: "현대미술 원화", kind: "asset", basePrice: 1_200_000_000, volatility: 0.06 },
];

/** 게임 시작 시의 시장 상태(모든 자산을 시작가로, 보유 0) */
export function initialMarket(): MarketState {
  const prices: Record<string, number> = {};
  const holdings: Record<string, number> = {};
  const cost: Record<string, number> = {};
  for (const a of MARKET_ASSETS) {
    prices[a.id] = a.basePrice;
    holdings[a.id] = 0;
    cost[a.id] = 0;
  }
  return { prices, prevPrices: { ...prices }, holdings, cost };
}
