import type { GameContext } from "./context";
import type { GachaResult } from "@/systems/gacha";
import { GACHA_COST, canDrawGacha, drawGacha, gachaBragLines } from "@/systems/gacha";
import { enqueueEventTweet } from "@/systems/eventTweets";
import { pick } from "@/utils/random";
import { el, formatNumber } from "@/utils/dom";

/**
 * 포토카드/굿즈 가챠 팝업. 뽑기 → 등급별 결과. SR·SSR은 자랑 트윗 가능.
 */
export function renderGachaModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  function head(): HTMLElement {
    return el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🎴 포토카드 / 굿즈 뽑기"),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    );
  }

  function showIdle(): void {
    const money = ctx.store.getState().money;
    const can = canDrawGacha(ctx.store.getState());
    container.replaceChildren(
      head(),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:14px;line-height:1.7;color:var(--text-muted);margin:0 0 6px" },
          `한 번 ${formatNumber(GACHA_COST)}원 · 확률: 일반 70% · 레어 20% · SR 8% · SSR 2%`,
        ),
        el(
          "p",
          { style: "font-size:13px;color:var(--text-muted);margin:0 0 16px" },
          `보유금 ${formatNumber(money)}원`,
        ),
        el(
          "div",
          { class: "gacha-box" },
          el("div", { class: "gacha-box__q" }, "?"),
        ),
        el(
          "div",
          { style: "text-align:center;margin-top:16px" },
          el(
            "button",
            {
              class: "btn" + (can ? "" : " btn--ghost"),
              disabled: !can,
              onclick: () => {
                if (!can) {
                  ctx.toast(`잔고가 부족해요 (필요 ${formatNumber(GACHA_COST)}원)`);
                  return;
                }
                let res: GachaResult | null = null;
                ctx.update((s) => {
                  res = drawGacha(s);
                });
                if (res) showResult(res);
              },
            },
            can ? `뽑기 (${formatNumber(GACHA_COST)}원)` : "잔고 부족",
          ),
        ),
      ),
    );
  }

  function showResult(res: GachaResult): void {
    const parts: string[] = [];
    if (res.mental) parts.push(`정신력 ${res.mental > 0 ? "+" : ""}${res.mental}`);
    if (res.followers) parts.push(`팔로워 +${res.followers}`);
    container.replaceChildren(
      head(),
      el(
        "div",
        { class: "modal__body" },
        el("div", { class: `gacha-card gacha-card--${res.rarity}` }, el("span", {}, res.label)),
        el("p", { style: "font-size:15px;font-weight:800;text-align:center;margin:12px 0 4px" }, res.name),
        el("p", { style: "font-size:14px;line-height:1.6;text-align:center;margin:0 0 8px" }, res.message),
        parts.length
          ? el("p", { style: "font-size:12.5px;color:var(--text-muted);text-align:center;margin:0" }, parts.join(" · "))
          : null,
        el(
          "div",
          { class: "compose-actions", style: "gap:10px;margin-top:16px" },
          res.brag
            ? el(
                "button",
                {
                  class: "btn btn--ghost",
                  onclick: () => {
                    const text = pick(gachaBragLines(res.name));
                    ctx.update((s) => enqueueEventTweet(s, { source: "가챠", attr: "idol", text }));
                    ctx.toast("📝 트윗 소재를 작성 목록에 저장했어요 · 작성 팝업에서 게시");
                    showIdle();
                  },
                },
                "자랑 트윗하기",
              )
            : null,
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                if (canDrawGacha(ctx.store.getState())) showIdle();
                else ctx.closeModal();
              },
            },
            "한 번 더 / 닫기",
          ),
        ),
      ),
    );
  }

  showIdle();
  return container;
}
