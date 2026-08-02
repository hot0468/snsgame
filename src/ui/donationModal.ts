import type { GameContext } from "./context";
import { DONATION_TARGETS, type DonationTarget } from "@/data/donation";
import { donate, donationSteps } from "@/systems/donation";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 기부 화면 — 돈을 도덕성으로 바꾸는 유일한 창구.
 *
 * ⚠️ **금액 구간을 버튼으로 제시한다.** 자유 입력이면 "얼마부터 효과가 오르나"를 계산기로
 *    풀어야 한다. 각 버튼에 그 금액의 실제 효과를 적어두면 고르는 것만으로 끝난다.
 *
 * ⚠️ 효과가 상한에 걸린 구간은 그렇다고 적는다 — 안 적으면 더 내면 더 오르는 줄 알고
 *    큰 금액을 넣는다(실제 효과는 같다).
 */
export function renderDonationModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  function render(): void {
    const s = ctx.store.getState();
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("heart", { size: 18 }), "기부하기"),
        el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { class: "compose-hint", style: "margin:0 0 12px" },
          `소지금 ${formatNumber(s.money)}원` +
            ((s.donatedTotal ?? 0) > 0
              ? ` · 지금까지 ${formatNumber(s.donatedTotal!)}원 · ${s.donatedCount ?? 0}회`
              : ""),
        ),
        ...DONATION_TARGETS.map((t) => targetCard(t)),
      ),
    );
  }

  /** 기부처 한 칸 — 소개 + 금액 버튼들. */
  function targetCard(t: DonationTarget): HTMLElement {
    const s = ctx.store.getState();
    // 버튼은 **단계 경계**에 놓는다: 최소액(1단계 최저가) · 2단계 · 최대.
    // ⚠️ 예전엔 [최소액, perStep, 최대]였는데 최소액이 이미 1단계를 줘서 **가운데 버튼이
    //    최소액과 효과가 똑같았다**(값만 몇 배 비싼 죽은 버튼). 단계가 서로 다르게 잡아야 한다.
    const amounts = [t.minAmount, t.perStep * 2, t.perStep * t.maxSteps].filter(
      (v, i, a) => a.indexOf(v) === i,
    );

    return el(
      "div",
      { class: "joblv-row", style: "flex-direction:column;align-items:stretch;gap:8px" },
      el("div", { class: "joblv-row__name" }, `${t.emoji} ${t.name}`),
      el("div", { class: "joblv-row__desc" }, t.desc),
      el(
            "div",
            { class: "compose-actions", style: "gap:8px;flex-wrap:wrap" },
            ...amounts.map((amount) => {
              const steps = donationSteps(t, amount);
              const capped = steps >= t.maxSteps;
              const afford = s.money >= amount;
              return el(
                "button",
                {
                  class: "btn" + (afford ? "" : " btn--ghost"),
                  disabled: !afford,
                  style: "flex:1;min-width:150px;font-size:12.5px",
                  onclick: () => {
                    let line = "";
                    ctx.update((st) => {
                      const o = donate(st, t.id, amount);
                      if (o.result === "ok") {
                        line =
                          `${t.name}에 ${formatNumber(amount)}원을 보냈다. 도덕성 +${o.morality}`;
                      }
                    });
                    if (line) {
                      ctx.toast(line);
                      ctx.openModal(() => thanksScreen(t));
                      return;
                    }
                    render();
                  },
                },
                `${formatNumber(amount)}원`,
                el(
                  "span",
                  { style: "display:block;opacity:.85;font-weight:400" },
                  `도덕 +${t.moralityPerStep * steps}` + (capped ? " (상한)" : ""),
                ),
              );
            }),
          ),
    );
  }

  /** 기부 뒤 한 장 — 숫자만 던지면 기부가 정산이 된다. */
  function thanksScreen(t: DonationTarget): HTMLElement {
    return el(
      "div",
      { class: "modal" },
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("heart", { size: 18 }), t.name),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.8;margin:0 0 16px;white-space:pre-wrap" },
          t.thanks,
        ),
        el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
      ),
    );
  }

  render();
  return container;
}
