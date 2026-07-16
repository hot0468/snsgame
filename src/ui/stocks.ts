import type { GameContext } from "./context";
import type { MarketAsset } from "@/data/market";
import { MARKET_ASSETS } from "@/data/market";
import {
  assetPrice,
  buyAsset,
  dayChangePct,
  holdingOf,
  portfolioValue,
  sellAsset,
} from "@/systems/market";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/** 증권/코인 투자 탭. 매일 시세가 바뀌며 소지금으로 매매한다. */
export function renderStocks(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();

  function trade(id: string, shares: number, sell: boolean): void {
    let done = 0;
    ctx.update((st) => {
      done = sell ? sellAsset(st, id, shares) : buyAsset(st, id, shares);
    });
    if (!done) ctx.toast(sell ? "보유 수량이 없어요" : "소지금이 부족해요");
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

  function assetRow(a: MarketAsset): HTMLElement {
    const price = assetPrice(s, a.id);
    const change = dayChangePct(s, a.id);
    const held = holdingOf(s, a.id);
    const dir = change > 0 ? "up" : change < 0 ? "down" : "flat";
    const changeText = `${change > 0 ? "▲" : change < 0 ? "▼" : "-"} ${Math.abs(change).toFixed(1)}%`;

    return el(
      "div",
      { class: "stock-row" },
      el(
        "div",
        { class: "stock-row__head" },
        el(
          "div",
          {},
          el("span", { class: "stock-row__name" }, a.name),
          el("span", { class: `stock-row__tag stock-row__tag--${a.kind}` }, a.kind === "coin" ? "코인" : "주식"),
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
        { class: "stock-row__foot" },
        el(
          "div",
          { class: "stock-row__hold" },
          held > 0
            ? `보유 ${formatNumber(held)} · 평가 ${formatNumber(held * price)}원`
            : "보유 없음",
        ),
        el(
          "div",
          { class: "stock-row__btns" },
          tradeBtn(a.id, 1, false),
          tradeBtn(a.id, 10, false),
          tradeBtn(a.id, 1, true),
          tradeBtn(a.id, 10, true),
        ),
      ),
    );
  }

  return el(
    "div",
    { class: "stocks" },
    el(
      "div",
      { class: "stocks__bar" },
      el("div", { class: "stocks__logo" }, icon("coin", { size: 20 }), "하나로 투자"),
      el(
        "div",
        { class: "stocks__summary" },
        el("span", {}, `보유현금 ${formatNumber(s.money)}원`),
        el("span", {}, `평가자산 ${formatNumber(portfolioValue(s))}원`),
      ),
    ),
    el("div", { class: "stocks__hint" }, "시세는 매일 바뀝니다. 싸게 사서 비싸게 파세요. (원금 손실 주의)"),
    el("div", { class: "stocks__list" }, ...MARKET_ASSETS.map(assetRow)),
  );
}
