import type { GameContext } from "./context";
import { currentHosts, saveHosts } from "@/systems/hosts";
import { el, mount } from "@/utils/dom";

/**
 * 윈도우 메모장(소품). 작업표시줄 메모장 버튼으로 열린다.
 *
 * ⚠️ **게임 상태를 읽지도 쓰지도 않는다.** 처음엔 빈 문서이고, [파일 > 열기]로 hosts를
 *    불러오면 그 내용(HOSTS_LINES)만 textarea에 채운다. ctx는 창 닫기(closeModal)에만 쓴다.
 *
 * ⚠️ **모달 노드는 app.ts가 캐시한다**(ui.modal이 같으면 재생성하지 않음) — 즉 ctx.refresh로는
 *    이 함수가 다시 불리지 않는다. 그래서 내부 상태(문서 내용·타이틀·메뉴/대화상자 개폐)는
 *    devtools.ts처럼 **모달 로컬 변수 + 직접 DOM 교체(mount)**로 관리한다. ctx.refresh를 부르지 마라.
 *
 * ## hosts 퍼즐(⚠️ data/dstory 헤더와 함께 읽어라)
 * [열기] 대화상자는 진짜 윈도우처럼 동작한다: 기본 필터 `텍스트 문서 (*.txt)`에서는 확장자 없는
 * hosts가 목록에 안 보이고, `모든 파일 (*.*)`로 바꿔야 hosts가 나타난다. hosts를 열면 그 안의
 * `127.0.0.1  dstory.local` 줄이 글3(hosts 힌트)의 비밀번호를 드러낸다.
 *
 * ## hosts 편집 → goedam.kr (⚠️ systems/hosts)
 * hosts는 **편집·저장이 가능하다.** 사용자가 `127.0.0.1  goedam.kr` 줄을 넣고 [파일>저장]하면
 * `saveHosts`가 state.hostsFile에 영속화하고, 주소창에서 goedam.kr가 괴담 사이트로 해석된다.
 * hosts 내용은 `currentHosts`로 읽는다(편집본 없으면 기본 HOSTS_LINES) — 여기 하드코딩하지 마라.
 */

/** etc 폴더에 실재하는(척하는) 파일 — 확장자 없는 hosts는 *.txt 필터에서 숨는다. */
const HOSTS_FILE = "hosts";

export function renderNotepad(ctx: GameContext): HTMLElement {
  // ── 창 내부 로컬 상태(위 주석 참조: ctx.refresh로 재생성되지 않으므로 직접 관리) ──
  // 현재 편집 중인 문서가 hosts인지(저장 대상 판정용). "none"이면 빈 새 문서.
  let currentFile: "none" | "hosts" = "none";
  const titleSpan = el("span", { class: "win-titlebar__title" }, "제목 없음 - 메모장");
  const textarea = el("textarea", {
    class: "np-text",
    spellcheck: "false",
    wrap: "off",
  }) as HTMLTextAreaElement;

  // 메뉴/대화상자를 얹는 오버레이. 빈 상태에선 pointer-events:none이라 textarea 입력을 막지 않는다.
  const overlay = el("div", { class: "np-overlay" });
  const closeOverlay = (): void => overlay.replaceChildren();

  function setTitle(name: string): void {
    titleSpan.textContent = `${name} - 메모장`;
  }

  function loadHosts(): void {
    // 편집·저장된 내용이 있으면 그걸, 없으면 기본 hosts를 보여준다.
    textarea.value = currentHosts(ctx.store.getState());
    setTitle(HOSTS_FILE);
    currentFile = "hosts";
    closeOverlay();
  }

  function newFile(): void {
    textarea.value = "";
    setTitle("제목 없음");
    currentFile = "none";
    closeOverlay();
  }

  function saveCurrent(): void {
    closeOverlay();
    // hosts 문서만 저장 대상이다. 저장하면 편집 내용이 영속화되고,
    // `127.0.0.1  goedam.kr`를 넣었다면 그때부터 주소창에서 goedam.kr가 열린다.
    if (currentFile === "hosts") {
      const text = textarea.value;
      ctx.update((s) => saveHosts(s, text));
      ctx.toast("hosts 파일을 저장했어요");
    } else {
      ctx.toast("저장할 파일이 없어요. [파일 > 열기]로 파일을 먼저 여세요.");
    }
  }

  /* ===================== 열기 대화상자 ===================== */
  function openDialog(): void {
    let filter: "txt" | "all" = "txt";
    let selected: string | null = null;

    const fileList = el("div", { class: "np-dlg__files" });
    const nameInput = el("input", {
      class: "np-dlg__name",
      type: "text",
      value: "",
      spellcheck: "false",
    }) as HTMLInputElement;

    // etc 폴더: *.txt면 확장자 없는 hosts가 안 보이고, 모든 파일이면 hosts가 보인다.
    const visibleFiles = (): string[] => (filter === "all" ? [HOSTS_FILE] : []);

    function paintFiles(): void {
      const files = visibleFiles();
      if (files.length === 0) {
        mount(fileList, el("div", { class: "np-dlg__empty" }, ""));
        return;
      }
      mount(
        fileList,
        ...files.map((f) =>
          el(
            "div",
            {
              class: "np-dlg__file" + (selected === f ? " np-dlg__file--on" : ""),
              onclick: () => {
                selected = f;
                nameInput.value = f;
                paintFiles();
              },
              ondblclick: () => {
                if (f === HOSTS_FILE) loadHosts();
              },
            },
            el("span", { class: "np-dlg__file-ico" }, "📄"),
            el("span", { class: "np-dlg__file-name" }, f),
          ),
        ),
      );
    }
    paintFiles();

    const typeSelect = el(
      "select",
      {
        class: "np-dlg__type",
        onchange: (e: Event) => {
          filter = (e.target as HTMLSelectElement).value as "txt" | "all";
          selected = null;
          paintFiles();
        },
      },
      el("option", { value: "txt" }, "텍스트 문서 (*.txt)"),
      el("option", { value: "all" }, "모든 파일 (*.*)"),
    ) as HTMLSelectElement;

    const openBtn = el(
      "button",
      {
        class: "np-dlg__btn np-dlg__btn--primary",
        onclick: () => {
          // 목록에서 hosts를 골랐거나, 파일 이름에 정확히 hosts를 적었으면 연다.
          if (selected === HOSTS_FILE || nameInput.value.trim() === HOSTS_FILE) loadHosts();
        },
      },
      "열기(O)",
    );

    const dialog = el(
      "div",
      { class: "np-dlg" },
      el(
        "div",
        { class: "np-dlg__titlebar" },
        el("span", { class: "np-dlg__titlebar-text" }, "열기"),
        el("button", { class: "np-dlg__titlebar-x", onclick: closeOverlay }, "✕"),
      ),
      el(
        "div",
        { class: "np-dlg__loc" },
        el("span", { class: "np-dlg__loc-label" }, "찾는 위치(I):"),
        el("span", { class: "np-dlg__loc-path" }, "📁 etc"),
      ),
      fileList,
      el(
        "div",
        { class: "np-dlg__field" },
        el("span", { class: "np-dlg__field-label" }, "파일 이름(N):"),
        nameInput,
        openBtn,
      ),
      el(
        "div",
        { class: "np-dlg__field" },
        el("span", { class: "np-dlg__field-label" }, "파일 형식(T):"),
        typeSelect,
        el("button", { class: "np-dlg__btn", onclick: closeOverlay }, "취소"),
      ),
    );

    mount(overlay, el("div", { class: "np-modal-backdrop" }, dialog));
  }

  /* ===================== 파일 메뉴 ===================== */
  function openFileMenu(): void {
    const action = (label: string, fn: () => void): HTMLElement =>
      el("button", { class: "np-menu__item", onclick: fn }, label);
    const dim = (label: string): HTMLElement =>
      el("span", { class: "np-menu__item np-menu__item--dim" }, label);

    const menu = el(
      "div",
      { class: "np-menu" },
      action("새로 만들기", newFile),
      action("열기...", openDialog),
      action("저장", saveCurrent),
      dim("다른 이름으로 저장..."),
      el("div", { class: "np-menu__sep" }),
      action("끝내기", () => ctx.closeModal()),
    );

    // 바깥을 누르면 닫히는 투명 백드롭 + 메뉴(파일 아래에 절대배치).
    mount(overlay, el("div", { class: "np-menu-backdrop", onclick: closeOverlay }), menu);
  }

  /* ===================== 조립 ===================== */
  const titlebar = el(
    "div",
    { class: "win-titlebar" },
    titleSpan,
    el(
      "div",
      { class: "win-titlebar__btns" },
      el("button", { class: "win-btn", tabindex: "-1" }, "─"),
      el("button", { class: "win-btn", tabindex: "-1" }, "☐"),
      el("button", { class: "win-btn win-btn--close", onclick: () => ctx.closeModal() }, "✕"),
    ),
  );

  const menubar = el(
    "div",
    { class: "np-menubar" },
    el("button", { class: "np-menubar__item", onclick: openFileMenu }, "파일"),
    el("span", { class: "np-menubar__item np-menubar__item--dim" }, "편집"),
    el("span", { class: "np-menubar__item np-menubar__item--dim" }, "서식"),
    el("span", { class: "np-menubar__item np-menubar__item--dim" }, "보기"),
    el("span", { class: "np-menubar__item np-menubar__item--dim" }, "도움말"),
  );

  return el(
    "div",
    { class: "modal modal--win modal--notepad" },
    titlebar,
    menubar,
    el("div", { class: "np-body" }, textarea, overlay),
  );
}
