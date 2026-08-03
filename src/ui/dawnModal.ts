import type { GameContext } from "./context";
import { el, formatNumber } from "@/utils/dom";
import { livingCostToday } from "@/systems/economy";
import { clearCdLotteryResult } from "@/systems/cdLottery";

/**
 * 새 날 아침 딤팝업.
 * 새 날이 시작될 때(systems가 onNewDay에서 dawnPending=true) 가장 먼저 뜬다.
 * 확인 시 dawnPending을 클리어해야 다음 render에서 다시 강제로 뜨지 않는다(필수).
 *
 * 음원CD 추첨 결과(`state.cdLotteryResult`)도 같은 확인 버튼 한 번으로 함께 닫는다 —
 * 추첨은 onNewDay가 이미 돌려놓은 하루짜리 결과라, 아침 팝업과 생애주기가 같다.
 */
export function renderDawnModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const gain = s.lastRestGain;
  const living = livingCostToday(s);
  const restParts: string[] = [];
  if (gain.action > 0) restParts.push(`행동력 +${gain.action}`);
  if (gain.mental > 0) restParts.push(`정신력 +${gain.mental}`);
  const cdResult = s.cdLotteryResult;

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
      cdResult
        ? el(
            "p",
            { class: "dawn__rest" },
            cdResult.won
              ? `🎉 음원CD 응모 당첨! (${cdResult.entries}장 응모) — 「${cdResult.eventTitle}」 ${cdResult.eventDay}일차에 잡혔어요`
              : `음원CD 응모 결과: 낙첨 (${cdResult.entries}장 응모)`,
          )
        : null,
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
                if (s.cdLotteryResult) clearCdLotteryResult(s);
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
