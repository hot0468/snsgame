import type { GameContext } from "./context";
import { isMoneyCheatCode, tryMoneyCheat, MONEY_CHEAT_AMOUNT } from "@/systems/cheat";
import { el, formatNumber } from "@/utils/dom";
import { winTitlebar } from "./components";

/**
 * 명령 프롬프트(cmd.exe) 창.
 *
 * 진짜 cmd처럼 검은 화면·고정폭 글씨·배너·프롬프트 재출력만 한다.
 * 숨겨진 치트가 하나 있지만 **화면 어디에도 힌트를 노출하지 않는다**
 * (help 목록에도 넣지 않는다 — 아는 사람만 치는 게 맛이다).
 *
 * 치트 판정·지급은 전부 systems/cheat.ts가 한다. 여기선 호출하고 문구만 고른다.
 * ⚠️ tryMoneyCheat은 '코드 틀림'과 '이미 씀'에 똑같이 false를 주므로,
 *    두 경우를 나누려면 isMoneyCheatCode로 먼저 코드 여부를 본다.
 */

const WIN_VERSION = "10.0.26100.2605";
const PROMPT = "C:\\Users\\user>";

/** 화면에 표시할 명령 도움말(치트는 당연히 없다) */
const HELP_LINES = [
  "CLS       화면을 지웁니다.",
  "ECHO      메시지를 표시합니다.",
  "EXIT      CMD.EXE 프로그램(명령 인터프리터)을 종료합니다.",
  "HELP      Windows 명령에 대한 도움말 정보를 제공합니다.",
  "VER       Windows 버전을 표시합니다.",
];

export function renderCmdModal(ctx: GameContext): HTMLElement {
  const screen = el("div", { class: "cmd-screen" });

  const input = el("input", {
    class: "cmd-input",
    type: "text",
    spellcheck: "false",
    autocomplete: "off",
    autocapitalize: "off",
  });

  const inputLine = el(
    "div",
    { class: "cmd-line cmd-line--input" },
    el("span", { class: "cmd-prompt" }, PROMPT),
    input,
  );

  /** 출력 한 줄(빈 문자열이면 빈 줄) — 항상 입력 줄 위에 쌓인다. */
  function print(text = ""): void {
    screen.insertBefore(el("div", { class: "cmd-line" }, text), inputLine);
  }

  function scrollToBottom(): void {
    screen.scrollTop = screen.scrollHeight;
  }

  function clear(): void {
    for (const node of [...screen.children]) {
      if (node !== inputLine) node.remove();
    }
  }

  /** 소지금 치트. 성공/이미 씀/오타를 구분해 문구를 고른다. */
  function handleMoneyCheat(raw: string): void {
    let ok = false;
    ctx.update((s) => {
      ok = tryMoneyCheat(s, raw);
    });
    if (ok) {
      // 스타크래프트의 치트 성공 메시지 결을 살짝 얹는다.
      print("Cheat enabled.");
      print(`${formatNumber(MONEY_CHEAT_AMOUNT)}원이 입금되었습니다.`);
      ctx.toast(`+${formatNumber(MONEY_CHEAT_AMOUNT)}원`);
    } else {
      print("Cheat disabled.");
      print("이미 사용한 명령입니다.");
    }
  }

  function run(raw: string): void {
    const line = raw.trim();
    if (line === "") return;

    const head = line.split(/\s+/)[0].toLowerCase();

    // 코드가 맞으면(썼든 안 썼든) 치트 분기로 — 오타는 아래 '알 수 없는 명령'으로 떨어진다.
    if (isMoneyCheatCode(line)) {
      handleMoneyCheat(line);
      return;
    }

    switch (head) {
      case "help":
        print("특정 명령어에 대한 자세한 내용은 HELP 명령어 이름을 입력하십시오.");
        print();
        for (const l of HELP_LINES) print(l);
        print();
        break;
      case "cls":
        clear();
        break;
      case "ver":
        print();
        print(`Microsoft Windows [Version ${WIN_VERSION}]`);
        print();
        break;
      case "echo": {
        const rest = line.slice(4).trim();
        print(rest === "" ? "ECHO is on." : rest);
        break;
      }
      case "exit":
        ctx.closeModal();
        return;
      default:
        print(
          `'${head}'은(는) 내부 또는 외부 명령, 실행할 수 있는 프로그램, 또는`,
        );
        print("배치 파일이 아닙니다.");
        break;
    }
  }

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const raw = input.value;
    input.value = "";
    // 입력한 줄을 프롬프트째로 화면에 남긴다(진짜 cmd처럼).
    print(`${PROMPT}${raw}`);
    run(raw);
    scrollToBottom();
  });

  // 화면 아무 곳이나 누르면 입력으로 포커스(cmd 창을 클릭한 느낌).
  // 단 출력 텍스트를 드래그로 선택하는 중이면 가로채지 않는다.
  screen.addEventListener("click", () => {
    if (!window.getSelection()?.isCollapsed) return;
    input.focus();
  });

  screen.append(inputLine);
  print(`Microsoft Windows [Version ${WIN_VERSION}]`);
  print("(c) Microsoft Corporation. All rights reserved.");
  print();

  // 노드가 DOM에 붙은 뒤에 포커스가 먹는다.
  setTimeout(() => input.focus(), 0);

  return el(
    "div",
    { class: "modal modal--win modal--cmd" },
    winTitlebar(ctx, "명령 프롬프트"),
    screen,
  );
}
