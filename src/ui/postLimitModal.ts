import type { GameContext } from "./context";
import { el } from "@/utils/dom";
import { icon } from "./icons";
import { renderComposeModal } from "./sns/composeModal";
import { remainingPostSlots } from "@/systems/eggs";
import { canSpendDay, spendDayResting } from "@/systems/offline";

/**
 * 게시 한도 초과 안내 모달 — 오늘 게시 가능 개수가 0이면 작성 팝업 대신 이걸 띄운다.
 * '하루 그냥 넘기기'로 다음날로 넘어가면 다시 작성할 수 있다(offlineModal의 restDaySection과 동일 동작).
 * 공통 모달 스킨(.modal / .modal__head / .modal__body / .compose-actions / .btn) 재사용.
 */
export function renderPostLimitModal(ctx: GameContext): HTMLElement {
  const can = canSpendDay(ctx.store.getState());
  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("pen", { size: 18 }), "게시 한도 초과"),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { style: "font-size:14px;line-height:1.6;margin:0 0 8px;font-weight:700" },
        "오늘 게시할 수 있는 트윗 개수를 초과하였습니다.",
      ),
      el(
        "p",
        { style: "font-size:13.5px;color:var(--text-muted);line-height:1.6;margin:0 0 16px" },
        "시간을 소모하여 다음날로 넘어가면 작성 가능합니다.",
      ),
      el(
        "div",
        { class: "compose-actions", style: "gap:10px" },
        el("button", { class: "btn btn--ghost", onclick: () => ctx.closeModal() }, "닫기"),
        el(
          "button",
          {
            class: "btn",
            disabled: !can,
            onclick: () => {
              if (!can) return;
              let gain = { action: 0, mental: 0 };
              ctx.update((st) => {
                gain = spendDayResting(st);
              });
              ctx.toast(`남은 하루를 쉬었다 · 행동력 +${gain.action} 정신력 +${gain.mental}`);
              ctx.closeModal();
            },
          },
          icon("bed", { size: 16 }),
          "하루 그냥 넘기기",
        ),
      ),
    ),
  );
}

/**
 * 게시 슬롯 증가 안내 모달 — 팔로워 티어가 올라 오늘 게시 가능 트윗 수가 늘면 강제 팝업으로 띄운다.
 * 확인 시 감지 플래그(state.postSlotIncreasedTo)를 클리어해 다시 뜨지 않게 한다.
 */
export function renderPostSlotModal(ctx: GameContext, count: number): HTMLElement {
  const close = () => {
    ctx.update((s) => {
      s.postSlotIncreasedTo = null;
    });
    ctx.closeModal();
  };
  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("pen", { size: 18 }), "게시 한도 상승"),
      el("button", { class: "popup__close", onclick: close }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { style: "font-size:15px;line-height:1.7;margin:0 0 16px" },
        `팔로워가 늘어 오늘 게시할 수 있는 트윗이 ${count}개로 늘었어요!`,
      ),
      el("button", { class: "btn", onclick: close }, "확인"),
    ),
  );
}

/** 게시하기 진입점 — 오늘 게시 슬롯이 남았으면 작성 팝업, 없으면 한도 안내 팝업. */
export function openComposeModal(ctx: GameContext): void {
  if (remainingPostSlots(ctx.store.getState()) <= 0) {
    ctx.openModal(renderPostLimitModal);
  } else {
    ctx.openModal(renderComposeModal);
  }
}
