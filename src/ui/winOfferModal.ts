import type { GameContext } from "./context";
import { WIN_FOLLOWERS, declineWinEnding, finishWithEnding } from "@/systems/winEnding";
import { totalFollowers } from "@/systems/economy";
import { el, formatNumber } from "@/utils/dom";

/**
 * 팔로워 100만 달성 축하 팝업.
 *
 * 예전엔 100만을 찍는 순간 곧장 엔딩 화면이 떴다. 목표를 이룬 화면을 볼 새도 없이
 * 끝나버리는 게 아쉬워서, 이제 여기서 고른다:
 *  - **엔딩 보기**: 그 자리에서 엔딩(gameOver)으로.
 *  - **아직이야**: 팝업만 닫고 **박제 상태**로 남는다 — 화면은 둘러볼 수 있지만
 *    행동·시간이 전부 멈추고(`systems/winEnding.isFrozen`), 남은 선택지는 '엔딩 보기'뿐이다.
 *
 * ⚠️ 닫기(✕) 버튼을 두지 않는다. 여기서 나가는 길은 두 버튼뿐이어야 한다.
 */
export function renderWinOfferModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  return el(
    "div",
    { class: "modal win-offer" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🎉 팔로워 100만 달성!"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { class: "win-offer__count" },
        `${formatNumber(Math.max(totalFollowers(s), WIN_FOLLOWERS))}명`,
      ),
      el(
        "p",
        { class: "win-offer__lead" },
        "목표했던 숫자에 닿았습니다. 여기서 이야기를 매듭지어도 좋고, " +
          "이 화면을 조금 더 눈에 담아도 좋습니다.",
      ),
      el(
        "p",
        { class: "win-offer__note" },
        "‘아직이야’를 고르면 시간이 멈춘 채 화면만 둘러볼 수 있어요. 엔딩은 언제든 볼 수 있습니다.",
      ),
      el(
        "div",
        { class: "compose-actions", style: "gap:10px" },
        el(
          "button",
          {
            class: "btn btn--ghost",
            onclick: () => {
              ctx.update((g) => declineWinEnding(g));
              ctx.closeModal();
              ctx.toast("시간이 멈췄어요. 준비되면 '엔딩 보기'를 누르세요");
            },
          },
          "아직이야",
        ),
        el(
          "button",
          { class: "btn", onclick: () => ctx.update((g) => finishWithEnding(g)) },
          "엔딩 보기",
        ),
      ),
    ),
  );
}
