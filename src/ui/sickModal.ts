import type { GameContext } from "./context";
import { el } from "@/utils/dom";
import { resolveSickDay } from "@/systems/health";
import { SICK_TITLE, SICK_LINES } from "@/data/health";
import { pick } from "@/utils/random";

/**
 * 질병 강제 모달(dawnPending 패턴).
 * 체력이 바닥나 앓아누운 날 — 아무것도 못 하고 하루를 넘긴다.
 * 닫기 버튼 없음(강제): 유일한 버튼이 resolveSickDay로 하루를 소모하고 sickPending을 클리어한다.
 * 본문 문구는 열릴 때 한 번 고정(재렌더에 흔들리지 않게 모듈 밖이 아닌 함수 진입 시 pick).
 */
export function renderSickModal(ctx: GameContext): HTMLElement {
  const line = pick(SICK_LINES);
  return el(
    "div",
    { class: "modal modal--dawn" },
    el(
      "div",
      { class: "modal__body dawn__body" },
      el("p", { class: "dawn__line" }, SICK_TITLE),
      el("p", { class: "dawn__rest" }, line),
      el(
        "div",
        { class: "compose-actions dawn__actions" },
        el(
          "button",
          {
            class: "btn dawn__btn",
            onclick: () => {
              ctx.update((s) => resolveSickDay(s));
              ctx.closeModal();
            },
          },
          "하루 종일 앓았다",
        ),
      ),
    ),
  );
}
