import type { GameContext } from "./context";
import { el, formatNumber } from "@/utils/dom";
import { livingCostToday } from "@/systems/economy";

/**
 * 새 날 아침 딤팝업.
 * 새 날이 시작될 때(systems가 onNewDay에서 dawnPending=true) 가장 먼저 뜬다.
 * 확인 시 dawnPending을 클리어해야 다음 render에서 다시 강제로 뜨지 않는다(필수).
 */
export function renderDawnModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const gain = s.lastRestGain;
  const living = livingCostToday(s);
  const restParts: string[] = [];
  if (gain.action > 0) restParts.push(`행동력 +${gain.action}`);
  if (gain.mental > 0) restParts.push(`정신력 +${gain.mental}`);

  return el(
    "div",
    { class: "modal modal--dawn" },
    el(
      "div",
      { class: "modal__body dawn__body" },
      el("div", { class: "dawn__sun", "aria-hidden": "true" }),
      // 넘어간 순간이 각인되게 며칠차를 크게 얹는다.
      el("div", { class: "dawn__day" }, `${s.day}일차`),
      el("p", { class: "dawn__line" }, "오늘도 또다시 해가 떴다"),
      restParts.length
        ? el("p", { class: "dawn__rest" }, `${restParts.join(" · ")} 회복`)
        : null,
      // 생활비는 onNewDay의 applyDailyCosts에서 이미 차감됐다 — 그 금액을 그대로 보여준다.
      el(
        "p",
        { class: "dawn__rest" },
        living > 0 ? `생활비 -${formatNumber(living)}원` : "생활비 면제(회사 복지)",
      ),
      el(
        "div",
        { class: "compose-actions dawn__actions" },
        el(
          "button",
          {
            class: "btn dawn__btn",
            onclick: () => {
              ctx.update((s) => {
                s.dawnPending = false;
              });
              ctx.closeModal();
            },
          },
          "하루를 시작한다",
        ),
      ),
    ),
  );
}
