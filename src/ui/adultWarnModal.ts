import type { GameContext } from "./context";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/* ============================================================
 * 성인물 보기 경고 딤팝업.
 * '성인물 보기'를 **켜기 직전에만** 끼운다(끌 때는 확인 없이 바로 꺼진다).
 * 확인하면 onConfirm()이 실행돼 실제로 adultMode가 켜진다.
 *
 * 공통 모달 스킨(.modal / .modal__head / .modal__body / .compose-actions / .btn)을
 * 재사용하므로 전용 CSS는 경고 목록 여백 한 줄뿐이다(main.css의 .adult-warn__list).
 * ============================================================ */

/** 켜기 전에 고지하는 성인 콘텐츠 유형. 문구를 바꾸려면 여기만 고친다. */
const WARN_ITEMS = [
  "성적인 텍스트·이미지 묘사",
  "성기 등 신체 부위에 대한 직접적 언급",
  "페티시, 합의되지 않은 관계 등에 대한 묘사",
];

export function renderAdultWarnModal(ctx: GameContext, onConfirm: () => void): HTMLElement {
  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el(
        "span",
        { class: "modal__head-title" },
        icon("shield", { size: 18 }),
        "성인물 보기 안내",
      ),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { style: "font-size:13.5px;color:var(--text-muted);line-height:1.6;margin:0 0 10px" },
        "성인물 보기를 켜면 아래와 같은 성인 콘텐츠가 노출될 수 있어요.",
      ),
      el(
        "ul",
        { class: "adult-warn__list" },
        ...WARN_ITEMS.map((t) => el("li", {}, t)),
      ),
      el(
        "p",
        { style: "font-size:13.5px;color:var(--text-muted);line-height:1.6;margin:12px 0 16px" },
        "계속하시겠어요?",
      ),
      el(
        "div",
        { class: "compose-actions", style: "gap:10px" },
        el("button", { class: "btn btn--ghost", onclick: () => ctx.closeModal() }, "취소"),
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              ctx.closeModal();
              onConfirm();
            },
          },
          "확인했어요",
        ),
      ),
    ),
  );
}
