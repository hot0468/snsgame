import type { GameContext } from "@/ui/context";
import { resolveHauntVisit } from "@/systems/haunt";
import { el } from "@/utils/dom";

/**
 * 괴담 계정이 심야에 찾아온다(app.ts가 state.hauntVisitNow를 감지해 띄운다 — 취침보다 먼저).
 * '문을 연다'를 누르면 resolveHauntVisit이 결과를 적용하고 두 예약 flag를 모두 클리어한다.
 * 서사(성인/비성인 분기)는 systems가 반환한 문구를 표시만 한다.
 * ⚠️ 모달을 닫으면 hauntVisitNow가 이미 false라 다시 뜨지 않고, 남은 취침 팝업으로 정상 복귀한다.
 */
export function renderHauntModal(ctx: GameContext): HTMLElement {
  // resolveHauntVisit이 성인 정사 서사로 분기하는 조건과 동일 — 그 분기일 때만 분홍.
  const hs = ctx.store.getState();
  const adultBranch = hs.adultMode && !hs.adultNoCoercion;
  const container = el("div", { class: "modal" + (adultBranch ? " modal--adult" : "") });

  function head(title: string): HTMLElement {
    return el("div", { class: "modal__head" }, el("span", { class: "modal__head-title" }, title));
  }

  function showResult(message: string): void {
    container.replaceChildren(
      head("빨간마스크"),
      el(
        "div",
        { class: "modal__body" },
        el("p", { style: "font-size:15px;line-height:1.8;margin:0 0 16px" }, message),
        el("button", { class: "btn", onclick: () => ctx.closeModal() }, "…아침을 맞는다"),
      ),
    );
  }

  container.replaceChildren(
    head("새벽 한 시"),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { class: "compose-hint", style: "margin-top:0;font-size:14px;line-height:1.8" },
        "현관문을 두드리는 소리에 잠에서 깼다. 낮에 좋아요를 눌렀던 그 계정… 정말로 찾아온 걸까. 문 너머에서 인기척이 느껴진다.",
      ),
      el(
        "button",
        {
          class: "event-choice",
          onclick: () => {
            let message = "";
            ctx.update((s) => {
              message = resolveHauntVisit(s).message; // 결과 적용 + 두 flag 클리어
            });
            showResult(message);
          },
        },
        el("b", {}, "문을 연다"),
      ),
    ),
  );

  return container;
}
