import type { GameContext } from "./context";
import { jobAdultSceneById, resolveJobScene } from "@/systems/jobAdult";
import { el, formatNumber } from "@/utils/dom";

/**
 * 직업 성인 씬 화면 — 근무를 마친 뒤 `pendingJobAdult`가 세워져 있으면 app이 띄운다.
 *
 * ⚠️ **효과는 '확인'에서 적용한다.** 렌더 중에 `ctx.update`를 부르면 재렌더가 이 함수를
 *    다시 불러 효과가 반복 적용된다(배구부 뒤풀이에서 실제로 낸 버그 —
 *    systems/coachCamp의 같은 경고 참조). `resolveJobScene`은 멱등하지만, 애초에
 *    사용자 액션에서 한 번만 부르는 게 옳다.
 */
export function renderJobAdultModal(ctx: GameContext): HTMLElement {
  const scene = jobAdultSceneById(ctx.store.getState().pendingJobAdult ?? "");
  if (!scene) {
    // 씬 id가 깨졌으면 플래그만 비우고 닫는다(멈춰 있는 것보다 낫다).
    ctx.update((s) => resolveJobScene(s));
    return el("div", { class: "modal" });
  }
  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, scene.title),
    ),
    el(
      "div",
      { class: "modal__body" },
      el("p", { class: "camp__scene" }, scene.text),
      scene.money
        ? el(
            "div",
            { class: "taxi__payout" },
            el("span", { class: "taxi__fare" }, `+${formatNumber(scene.money)}원`),
          )
        : null,
      el(
        "div",
        { class: "compose-actions" },
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              ctx.update((s) => resolveJobScene(s));
              ctx.closeModal();
            },
          },
          "확인",
        ),
      ),
    ),
  );
}
