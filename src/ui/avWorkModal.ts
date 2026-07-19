import type { GameContext } from "@/ui/context";
import { resolveAvWork, rollCondomlessOffer } from "@/systems/avJob";
import { el } from "@/utils/dom";
import { icon } from "@/ui/icons";

/**
 * 심야 AV 촬영 진입 모달.
 * 노콘 제안 여부는 진입 시 1회만 굴리고(재렌더로 다시 굴리지 않는다),
 * 촬영 결과 서사는 systems(resolveAvWork)가 만든 문자열을 표시만 한다.
 */
export function renderAvWorkModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal modal--adult" });

  function head(title: string): HTMLElement {
    return el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("bed", { size: 18 }), title),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    );
  }

  const condomlessOffer = rollCondomlessOffer(ctx.store.getState());

  function work(accept: boolean): void {
    let msg = "";
    ctx.update((s) => {
      msg = resolveAvWork(s, accept);
    });
    showResult(msg);
  }

  function showIntro(): void {
    // 노콘 제안이 없으면 바로 촬영한다.
    if (!condomlessOffer) {
      work(false);
      return;
    }
    container.replaceChildren(
      head("AV 심야 촬영"),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.7;margin:0 0 12px" },
          "감독이 은근히 제안한다. 실삽입·노콘으로 찍으면 이번 달 월급을 30만원 올려주겠다고 한다. (한 달 안에서만 누적, 26일에 리셋)",
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el(
            "button",
            { class: "btn btn--ghost", onclick: () => work(false) },
            "콘돔 착용으로 찍는다",
          ),
          el(
            "button",
            { class: "btn", onclick: () => work(true) },
            "실삽입·노콘 촬영 (이번 달 월급 +30만)",
          ),
        ),
      ),
    );
  }

  function showResult(message: string): void {
    container.replaceChildren(
      head("촬영 종료"),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.8;margin:0 0 16px;white-space:pre-wrap" },
          message,
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el("button", { class: "btn", onclick: () => ctx.closeModal() }, "닫기"),
        ),
      ),
    );
  }

  showIntro();
  return container;
}
