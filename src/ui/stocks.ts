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
import { getActiveAccount } from "@/core/state";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

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
            el("span", { class: `stock-row__tag stock-row__tag--${a.kind}` }, a.kind === "coin" ? "코인" : "주식"),
          ),
          el(
            "div",
            { class: "stock-row__hold" },
            held > 0 ? `보유 ${formatNumber(held)}주 · ${formatNumber(held * price)}원` : "미보유",
          ),
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
    ),
    el("div", { class: "stocks__hint" }, "시세는 매일 바뀌어요. 싸게 사서 비싸게 파세요. (원금 손실 주의)"),
    el("div", { class: "stocks__list" }, ...MARKET_ASSETS.map(assetRow)),
  );
}
