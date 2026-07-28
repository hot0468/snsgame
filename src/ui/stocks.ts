import type { GameContext } from "./context";
import type { MarketAsset } from "@/data/market";
import { MARKET_ASSETS } from "@/data/market";
import {
  assetPrice,
  assetProfit,
  avgCostOf,
  buyAsset,
  dayChangePct,
  holdingOf,
  portfolioValue,
  sellAsset,
  totalProfit,
} from "@/systems/market";
import { getActiveAccount } from "@/core/state";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/** 종목 종류 배지 라벨. MarketAsset.kind가 늘면 여기도 채워야 컴파일된다. */
const KIND_LABELS: Record<MarketAsset["kind"], string> = {
  stock: "주식",
  coin: "코인",
  asset: "실물",
};

/** 증권/코인 투자 탭. 매일 시세가 바뀌며 소지금으로 매매한다. */
export function renderStocks(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();

  function trade(id: string, shares: number, sell: boolean): void {
    // 첫 매매 시 재테크계 해금(systems가 처리). 새로 열렸으면 토스트로 알린다.
    const wasLocked = !getActiveAccount(ctx.store.getState()).unlockedAttributes.includes("finance");
    let done = 0;
    ctx.update((st) => {
      done = sell ? sellAsset(st, id, shares) : buyAsset(st, id, shares);
    });
    if (!done) {
      ctx.toast(sell ? "보유 수량이 없어요" : "소지금이 부족해요");
      return;
    }
    if (wasLocked && getActiveAccount(ctx.store.getState()).unlockedAttributes.includes("finance")) {
      ctx.toast("📈 재테크계 트윗 속성 해금! 이제 주식 얘기를 쓸 수 있어요", "good");
    }
  }

  function tradeBtn(id: string, shares: number, sell: boolean): HTMLElement {
    return el(
      "button",
      {
        class: "stock-btn" + (sell ? " stock-btn--sell" : " stock-btn--buy"),
        onclick: () => trade(id, shares, sell),
      },
      `${sell ? "매도" : "매수"} ${shares}`,
    );
  }

  /** 부호 있는 금액 문자열(+1,000원 / -1,000원). 0은 부호 없이. */
  function signedWon(n: number): string {
    const r = Math.round(n);
    return `${r > 0 ? "+" : r < 0 ? "-" : ""}${formatNumber(Math.abs(r))}원`;
  }

  /** 종목 한 줄의 평가손익 표시(평가액 · 손익 · 수익률). 색은 손익 부호를 따른다. */
  function profitLine(id: string): HTMLElement {
    const { value, profit, pct } = assetProfit(s, id);
    const dir = profit > 0 ? "up" : profit < 0 ? "down" : "flat";
    return el(
      "div",
      { class: "stock-row__pl" },
      el("span", { class: "stock-row__pl-value" }, `평가 ${formatNumber(Math.round(value))}원`),
      el(
        "span",
        { class: `stock-row__pl-delta stock-row__pl-delta--${dir}` },
        `${signedWon(profit)} (${pct > 0 ? "+" : pct < 0 ? "-" : ""}${Math.abs(pct).toFixed(1)}%)`,
      ),
    );
  }

  function assetRow(a: MarketAsset): HTMLElement {
    const price = assetPrice(s, a.id);
    const change = dayChangePct(s, a.id);
    const held = holdingOf(s, a.id);
    const dir = change > 0 ? "up" : change < 0 ? "down" : "flat";
    const changeText = `${change > 0 ? "+" : change < 0 ? "-" : ""}${Math.abs(change).toFixed(1)}%`;

    return el(
      "div",
      { class: "stock-row" },
      el(
        "div",
        { class: "stock-row__main" },
        // 토스식 원형 종목 아이콘 — 종목명 첫 글자, 종류별 색.
        el("div", { class: `stock-row__icon stock-row__icon--${a.kind}` }, a.name.slice(0, 1)),
        el(
          "div",
          { class: "stock-row__info" },
          el(
            "div",
            { class: "stock-row__name-line" },
            el("span", { class: "stock-row__name" }, a.name),
            el("span", { class: `stock-row__tag stock-row__tag--${a.kind}` }, KIND_LABELS[a.kind]),
          ),
          held > 0
            ? el(
                "div",
                { class: "stock-row__hold" },
                `보유 ${formatNumber(held)}주 · 평단 ${formatNumber(Math.round(avgCostOf(s, a.id)))}원`,
              )
            : el("div", { class: "stock-row__hold" }, "미보유"),
          // 평가손익은 보유 중일 때만. 원가 대비 금액과 수익률을 함께 보여준다.
          held > 0 ? profitLine(a.id) : null,
        ),
        el(
          "div",
          { class: "stock-row__price" },
          el("div", { class: "stock-row__now" }, `${formatNumber(price)}원`),
          el("div", { class: `stock-row__chg stock-row__chg--${dir}` }, changeText),
        ),
      ),
      el(
        "div",
        { class: "stock-row__btns" },
        tradeBtn(a.id, 1, false),
        tradeBtn(a.id, 10, false),
        tradeBtn(a.id, 1, true),
        tradeBtn(a.id, 10, true),
      ),
    );
  }

  const total = s.money + portfolioValue(s);
  const totalPl = totalProfit(s);

  return el(
    "div",
    { class: "stocks" },
    // 토스식 상단 바 + 총자산 히어로 카드
    el(
      "div",
      { class: "stocks__top" },
      el("div", { class: "stocks__logo" }, icon("coin", { size: 18 }), "토스증권"),
    ),
    el(
      "div",
      { class: "stocks__hero" },
      el("div", { class: "stocks__hero-label" }, "내 투자 자산"),
      el("div", { class: "stocks__hero-total" }, `${formatNumber(total)}원`),
      el(
        "div",
        { class: "stocks__hero-sub" },
        el("span", {}, `보유 현금 ${formatNumber(s.money)}원`),
        el("span", { class: "stocks__hero-dot" }, "·"),
        el("span", {}, `평가 자산 ${formatNumber(portfolioValue(s))}원`),
      ),
      // 전 종목 합산 손익 — 보유가 있을 때만.
      totalPl.value > 0
        ? el(
            "div",
            {
              class:
                "stocks__hero-pl stocks__hero-pl--" +
                (totalPl.profit > 0 ? "up" : totalPl.profit < 0 ? "down" : "flat"),
            },
            `총 평가손익 ${signedWon(totalPl.profit)} (${totalPl.pct > 0 ? "+" : totalPl.pct < 0 ? "-" : ""}${Math.abs(totalPl.pct).toFixed(1)}%)`,
          )
        : null,
    ),
    el("div", { class: "stocks__hint" }, "시세는 매일 바뀌어요. 싸게 사서 비싸게 파세요. (원금 손실 주의)"),
    el("div", { class: "stocks__list" }, ...MARKET_ASSETS.map(assetRow)),
  );
}
