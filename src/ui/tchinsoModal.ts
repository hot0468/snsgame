import type { GameContext } from "./context";
import type { TchinsoResult } from "@/systems/tchin";
import { canPostTchinso, postTchinso } from "@/systems/tchin";
import { el } from "@/utils/dom";

/**
 * 트친소(트친 소개) 모달 — 확인 후 게시하면 응답 계정 목록(트친 진행도 선채움)을 보여준다.
 * gachaModal 패턴(showIdle/showResult, container.replaceChildren)을 따른다:
 * openModal은 이 함수의 identity로 노드를 캐시하므로, 전체 앱 재렌더에도 이 지역 상태(단계)가 살아남는다.
 */
export function renderTchinsoModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  function head(): HTMLElement {
    return el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🤝 트친소 올리기"),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    );
  }

  function showIdle(): void {
    const can = canPostTchinso(ctx.store.getState());
    container.replaceChildren(
      head(),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { class: "compose-hint", style: "margin-top:0" },
          "트친소 트윗을 올려 새 트친을 모집할까요? 반응한 계정과는 트친 진행도가 미리 채워져요.",
        ),
        !can ? el("div", { class: "compose-hint" }, "이번 주엔 이미 올렸어요.") : null,
        el(
          "div",
          { class: "compose-actions" },
          el("button", { class: "btn btn--ghost", onclick: () => ctx.closeModal() }, "취소"),
          el(
            "button",
            {
              class: "btn",
              disabled: !can,
              onclick: () => {
                if (!can) return;
                let res: TchinsoResult | null = null;
                ctx.update((s) => {
                  res = postTchinso(s);
                });
                if (res) showResult(res);
              },
            },
            "올리기",
          ),
        ),
      ),
    );
  }

  function showResult(res: TchinsoResult): void {
    const list = res.responders.length
      ? el(
          "ul",
          { class: "tchinso-resp-list" },
          ...res.responders.map((r) =>
            el(
              "li",
              { class: "tchinso-resp" },
              el(
                "div",
                { class: "tchinso-resp__info" },
                el("span", { class: "tchinso-resp__name" }, r.name),
                el("span", { class: "tchinso-resp__handle" }, `@${r.handle}`),
              ),
              el(
                "span",
                { class: "tchinso-resp__remaining" },
                r.remaining > 0 ? `트친까지 ${r.remaining}번` : "트친 성사!",
              ),
            ),
          ),
        )
      : el("div", { class: "empty" }, "아직 반응이 없어요...");

    container.replaceChildren(
      head(),
      el(
        "div",
        { class: "modal__body" },
        el("p", { class: "compose-hint", style: "margin-top:0" }, "트친소 트윗에 이런 계정들이 반응했어요!"),
        list,
        el(
          "div",
          { class: "compose-actions" },
          el("button", { class: "btn", onclick: () => ctx.closeModal() }, "닫기"),
        ),
      ),
    );
  }

  showIdle();
  return container;
}
