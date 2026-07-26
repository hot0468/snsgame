import type { GameContext } from "./context";
import { createInitialState, CELEBRATORY_ENDING_TITLES } from "@/core/state";
import { winEndingTitle } from "@/systems/winEnding";
import { deleteSave } from "@/systems/save";
import { dateLabel } from "@/systems/time";
import { el, formatNumber } from "@/utils/dom";
import { getActiveAccount } from "@/core/state";

/**
 * 게임이 끝났을 때 뜨는 종료 화면(닫을 수 없는 오버레이).
 * 축하 엔딩(파이어·데뷔·작가 등)은 각 제목으로, 그 외(퇴거 등)는 GAME OVER로 표시.
 */
export function renderGameOver(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const reason = s.gameOver ?? "게임 오버";
  const account = getActiveAccount(s);
  const endingTitle = CELEBRATORY_ENDING_TITLES[reason] ?? winEndingTitle(reason);

  return el(
    "div",
    { class: "gameover-backdrop" },
    el(
      "div",
      { class: "gameover" },
      el("h2", { class: "gameover__title" }, endingTitle ?? "GAME OVER"),
      el("p", { class: "gameover__reason" }, reason),
      el(
        "div",
        { class: "gameover__stats" },
        `${dateLabel(s.day)}까지 버팀 · 최고 팔로워 ${formatNumber(account.followers)}명`,
      ),
      el(
        "button",
        {
          class: "btn",
          style: "margin-top:18px",
          onclick: () => {
            // 남아 있던 모달/메뉴를 정리하고 새 게임으로.
            ctx.ui.modal = null;
            ctx.ui.startMenuOpen = false;
            ctx.ui.calendarOpen = false;
            deleteSave();
            ctx.store.replace(createInitialState());
            ctx.toast("새 게임을 시작합니다");
          },
        },
        "새 게임 시작",
      ),
    ),
  );
}
