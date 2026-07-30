import type { GameContext } from "./context";
import { CLAW_COST, DOLL_TOTAL, dollCount } from "@/systems/arcade";
import { HOOP_COST } from "@/systems/basketball";
import { renderArcadeModal } from "./arcadeModal";
import { renderHoopModal } from "./hoopModal";
import { el, formatNumber } from "@/utils/dom";

/**
 * 오락실 기계 선택 — 외출 조우로 오락실에 들어오면 여기서 기계를 고른다.
 *
 * ⚠️ **한 방문에 기계를 여러 번 골라도 된다.** 인형뽑기의 '한 방문 1개' 상한은
 *    그 기계 안에서만 유효하고(인형을 뽑으면 그 판이 끝난다), 농구는 소지금이
 *    자연 제동이다. 나가지 않는 한 이 화면으로 계속 돌아올 수 있다.
 *
 * ⚠️ ui/arcadeModal.ts(인형뽑기)는 **건드리지 않는다** — 이 화면이 그 앞에 한 겹
 *    끼는 것뿐이다.
 */

export function renderArcadePickModal(ctx: GameContext): HTMLElement {
  const state = ctx.store.getState();
  const money = state.money;

  const leave = (): void => {
    ctx.closeModal();
    ctx.afterAction("offline");
  };

  /** 기계 카드 하나 */
  const card = (opts: {
    emoji: string;
    name: string;
    desc: string;
    cost: number;
    record: string;
    onPick: () => void;
  }): HTMLElement => {
    const affordable = money >= opts.cost;
    const btn = el(
      "button",
      {
        class: `arcade-pick__card${affordable ? "" : " arcade-pick__card--broke"}`,
        onclick: () => {
          if (!affordable) return;
          opts.onPick();
        },
      },
      el("span", { class: "arcade-pick__emoji" }, opts.emoji),
      el(
        "span",
        { class: "arcade-pick__body" },
        el("span", { class: "arcade-pick__name" }, opts.name),
        el("span", { class: "arcade-pick__desc" }, opts.desc),
        el(
          "span",
          { class: "arcade-pick__meta" },
          el("span", { class: "arcade-pick__cost" }, `1판 ${formatNumber(opts.cost)}원`),
          el("span", { class: "arcade-pick__record" }, opts.record),
        ),
      ),
    ) as HTMLButtonElement;
    btn.disabled = !affordable;
    return btn;
  };

  const body = el(
    "div",
    { class: "modal__body" },
    el(
      "p",
      { class: "arcade-pick__intro" },
      "오락실 안은 동전 떨어지는 소리와 전자음으로 시끄럽다. 어느 기계로 갈까.",
    ),
    el(
      "div",
      { class: "arcade-pick__list" },
      card({
        emoji: "🕹️",
        name: "인형뽑기",
        desc: "집게로 인형을 뽑아 도감에 모은다",
        cost: CLAW_COST,
        record: `도감 ${dollCount(state)}/${DOLL_TOTAL}종`,
        onPick: () => ctx.openModal(renderArcadeModal),
      }),
      card({
        emoji: "🏀",
        name: "농구 슛",
        desc: "30초 안에 몇 골 넣나. 점수만큼 상품을 준다",
        cost: HOOP_COST,
        record: `최고 ${state.hoopBest ?? 0}골`,
        onPick: () => ctx.openModal(renderHoopModal),
      }),
    ),
    money < Math.min(CLAW_COST, HOOP_COST)
      ? el(
          "p",
          { class: "compose-hint" },
          "주머니에 동전이 없다. 오늘은 구경만 하고 나가야겠다.",
        )
      : el("p", { class: "compose-hint" }, "기계를 고르면 동전이 들어갑니다."),
    el(
      "div",
      { class: "compose-actions", style: "gap:10px" },
      el("button", { class: "btn btn--ghost", onclick: leave }, "오락실 나가기"),
    ),
  );

  return el(
    "div",
    { class: "modal modal--arcade-pick" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🎮 오락실"),
      el("button", { class: "popup__close", onclick: leave }, "✕"),
    ),
    body,
  );
}
