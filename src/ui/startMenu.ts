import type { GameContext } from "./context";
import { saveGame, loadGame, deleteSave } from "@/systems/save";
import { createInitialState } from "@/core/state";
import { el } from "@/utils/dom";
import { renderCmdModal } from "./cmd";
import { renderTaskManagerModal } from "./taskManager";

/**
 * 윈도우(시작) 버튼 메뉴 — Win+X 스타일의 다크 목록형 팝오버.
 * 게임 저장/불러오기/새 게임 등 실제 기능을 담는다.
 */
export function renderStartMenu(ctx: GameContext): HTMLElement {
  const close = () => {
    ctx.ui.startMenuOpen = false;
    ctx.refresh();
  };

  function item(label: string, onClick: () => void, chevron = false): HTMLElement {
    return el(
      "button",
      { class: "winx__item", onclick: onClick },
      el("span", { class: "winx__label" }, label),
      chevron ? el("span", { class: "winx__chev" }, "›") : null,
    );
  }

  const sep = () => el("div", { class: "winx__sep" });

  return el(
    "div",
    { class: "popup start-menu winx" },
    // 1) 저장/불러오기
    item("게임 저장", () => {
      const ok = saveGame(ctx.store.getState());
      close();
      ctx.toast(ok ? "저장 완료" : "저장 실패");
    }),
    item("불러오기", () => {
      const loaded = loadGame();
      if (loaded) {
        ctx.store.replace(loaded);
        ctx.toast("불러오기 완료");
      } else {
        ctx.toast("저장된 게임이 없습니다");
      }
      close();
    }),
    sep(),
    // 2) 윈도우 앱(실제 Win+X에도 있는 둘)
    item("작업 관리자", () => {
      close();
      ctx.openModal(renderTaskManagerModal);
    }),
    item("명령 프롬프트", () => {
      close();
      ctx.openModal(renderCmdModal);
    }),
    sep(),
    // 3) 새 게임 / 닫기
    item("새 게임 시작", () => {
      deleteSave();
      ctx.store.replace(createInitialState());
      close();
      ctx.toast("새 게임을 시작했어요");
    }),
    item("데스크톱", close),
  );
}
