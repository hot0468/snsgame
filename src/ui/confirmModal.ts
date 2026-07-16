import type { GameContext } from "./context";
import { el } from "@/utils/dom";

/* ============================================================
 * 구매 확인 딤팝업(공통 헬퍼).
 * 즉시 결제되는 '구매' 버튼 앞에 "구매하시겠습니까?" 확인 단계를
 * 끼워 넣는다. 공통 모달 스킨(.modal / .modal__head / .modal__body /
 * .compose-actions)을 재사용하므로 별도 CSS가 거의 필요 없다.
 * 확인 클릭 시 closeModal 후 onConfirm()을 실행한다.
 * ============================================================ */
export function confirmPurchase(
  ctx: GameContext,
  opts: {
    title?: string; // 기본 "구매 확인"
    itemName?: string; // 살 대상 이름(있으면 표시)
    priceText?: string; // 가격 문구(있으면 표시, 예 "18,390원")
    message?: string; // 기본 "구매하시겠습니까?"
    confirmLabel?: string; // 기본 "구매"
    onConfirm: () => void;
  },
): void {
  const title = opts.title ?? "구매 확인";
  const message = opts.message ?? "구매하시겠습니까?";
  const confirmLabel = opts.confirmLabel ?? "구매";

  ctx.openModal((c) =>
    el(
      "div",
      { class: "modal" },
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, title),
        el("button", { class: "popup__close", onclick: () => c.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        opts.itemName
          ? el("p", { style: "font-size:15px;font-weight:700;margin:0 0 6px" }, opts.itemName)
          : null,
        opts.priceText
          ? el(
              "p",
              { style: "font-size:14px;margin:0 0 10px" },
              el("b", { style: "color:var(--accent)" }, opts.priceText),
            )
          : null,
        el(
          "p",
          { style: "font-size:13.5px;color:var(--text-muted);line-height:1.6;margin:0 0 16px" },
          message,
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el("button", { class: "btn btn--ghost", onclick: () => c.closeModal() }, "취소"),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                c.closeModal();
                opts.onConfirm();
              },
            },
            confirmLabel,
          ),
        ),
      ),
    ),
  );
}
