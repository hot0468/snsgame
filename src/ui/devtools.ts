import type { GameContext } from "./context";
import { DEVTOOLS_CONSOLE_PW } from "@/data/dstory";
import { el, mount } from "@/utils/dom";
import { winTitlebar } from "./components";

/**
 * 가짜 크롬 개발자 도구 — 주소창 ⋮ 메뉴의 `개발자 도구  F12`로만 열린다.
 *
 * ⚠️ **게임 상태를 읽지도 쓰지도 않는다.** 내용은 전부 아래 고정 상수다 —
 *    언제 열어도 똑같이 보인다. ctx는 winTitlebar(닫기)에만 쓴다.
 *    진짜 DOM·진짜 네트워크를 비추려는 유혹을 참아라. 여긴 소품이다.
 *
 * ⚠️ **F12 키를 바인딩하지 마라.** "F12"는 크롬 메뉴처럼 항목 옆에 붙는 라벨일 뿐이고,
 *    d스토리 글1의 힌트 "F12"는 "눌러라"가 아니라 "F12라고 적힌 걸 찾아라"는 뜻이다.
 *    keydown을 걸면 게임 밖 진짜 브라우저의 개발자 도구가 열려 몰입이 깨진다(사용자 확정).
 *
 * ⚠️ 기본 탭은 반드시 Elements다 — Console을 기본으로 열면 비밀번호가 공짜로 보인다.
 */

const TAB_IDS = ["Elements", "Console", "Sources", "Network"] as const;
type DevTab = (typeof TAB_IDS)[number];

/* ===================== Elements ===================== */

// 고정 문자열이라 html 주입이 안전하다(외부 입력이 섞이지 않는다).
// dt-t=태그 / dt-a=속성명 / dt-v=속성값 / dt-x=텍스트
const ELEMENTS_HTML = `
<div class="dt-node"><span class="dt-doctype">&lt;!DOCTYPE html&gt;</span></div>
<div class="dt-node">&lt;<span class="dt-t">html</span> <span class="dt-a">lang</span>=<span class="dt-v">"ko"</span>&gt;</div>
<div class="dt-node dt-i1">&lt;<span class="dt-t">head</span>&gt;<span class="dt-x">…</span>&lt;/<span class="dt-t">head</span>&gt;</div>
<div class="dt-node dt-i1">&lt;<span class="dt-t">body</span>&gt;</div>
<div class="dt-node dt-i2">&lt;<span class="dt-t">div</span> <span class="dt-a">id</span>=<span class="dt-v">"app"</span>&gt;</div>
<div class="dt-node dt-i3">&lt;<span class="dt-t">header</span> <span class="dt-a">class</span>=<span class="dt-v">"masthead"</span>&gt;<span class="dt-x">…</span>&lt;/<span class="dt-t">header</span>&gt;</div>
<div class="dt-node dt-i3 dt-node--sel">&lt;<span class="dt-t">main</span> <span class="dt-a">class</span>=<span class="dt-v">"content"</span>&gt;</div>
<div class="dt-node dt-i4">&lt;<span class="dt-t">h1</span>&gt;<span class="dt-x">d스토리</span>&lt;/<span class="dt-t">h1</span>&gt;</div>
<div class="dt-node dt-i4">&lt;<span class="dt-t">ul</span> <span class="dt-a">class</span>=<span class="dt-v">"post-list"</span>&gt;<span class="dt-x">…</span>&lt;/<span class="dt-t">ul</span>&gt;</div>
<div class="dt-node dt-i3">&lt;/<span class="dt-t">main</span>&gt;</div>
<div class="dt-node dt-i3">&lt;<span class="dt-t">footer</span> <span class="dt-a">class</span>=<span class="dt-v">"footer"</span>&gt;<span class="dt-x">…</span>&lt;/<span class="dt-t">footer</span>&gt;</div>
<div class="dt-node dt-i2">&lt;/<span class="dt-t">div</span>&gt;</div>
<div class="dt-node dt-i2">&lt;<span class="dt-t">script</span> <span class="dt-a">src</span>=<span class="dt-v">"/assets/main.js"</span>&gt;&lt;/<span class="dt-t">script</span>&gt;</div>
<div class="dt-node dt-i1">&lt;/<span class="dt-t">body</span>&gt;</div>
<div class="dt-node">&lt;/<span class="dt-t">html</span>&gt;</div>
`;

function elementsPanel(): HTMLElement {
  return el(
    "div",
    { class: "dt-elements" },
    el("div", { class: "dt-tree", html: ELEMENTS_HTML }),
    el(
      "div",
      { class: "dt-styles" },
      el("div", { class: "dt-styles__head" }, "Styles"),
      el(
        "div",
        { class: "dt-rule" },
        el("span", { class: "dt-sel" }, ".content"),
        " {",
        el("div", { class: "dt-decl" }, "max-width: ", el("span", { class: "dt-val" }, "760px")),
        el("div", { class: "dt-decl" }, "margin: ", el("span", { class: "dt-val" }, "0 auto")),
        el("div", { class: "dt-decl" }, "padding: ", el("span", { class: "dt-val" }, "24px 16px")),
        "}",
      ),
    ),
  );
}

/* ===================== Console ===================== */

/**
 * 가짜 로그.
 * ⚠️ 비밀번호 줄은 **중간**에 둔다 — 맨 위·맨 아래에 한 줄만 덩그러니 있으면 티가 난다.
 *    값은 반드시 data/dstory.ts의 상수를 쓴다(하드코딩하면 퍼즐이 조용히 깨진다).
 */
const CONSOLE_LINES: { text: string; level?: "warn" | "error" }[] = [
  { text: "[vite] connecting..." },
  { text: "[vite] connected." },
  { text: "GET /api/posts 200 (14ms)" },
  { text: "DevTools failed to load source map: Could not load content for /assets/vendor.js.map", level: "warn" },
  { text: "session restored: guest" },
  { text: `pw:${DEVTOOLS_CONSOLE_PW}` },
  { text: "[analytics] disabled in development" },
  { text: "Uncaught (in promise) TypeError: Cannot read properties of null (reading 'dataset')", level: "error" },
  { text: "    at onReady (main.js:118:22)", level: "error" },
  { text: "render complete in 42ms" },
];

function consolePanel(): HTMLElement {
  return el(
    "div",
    { class: "dt-console" },
    ...CONSOLE_LINES.map((l) =>
      el("div", { class: "dt-log" + (l.level ? ` dt-log--${l.level}` : "") }, l.text),
    ),
    // 입력 줄은 장식이다(치는 곳이 아니다 — cmd가 그 역할을 한다).
    el("div", { class: "dt-console__input" }, el("span", { class: "dt-caret" }, ">")),
  );
}

/* ===================== Sources ===================== */

const SOURCE_FILES = ["index.html", "main.js", "style.css", "vendor.js"];

const SOURCE_CODE = [
  "const list = document.querySelector('.post-list');",
  "",
  "async function loadPosts() {",
  "  const res = await fetch('/api/posts');",
  "  const posts = await res.json();",
  "  list.innerHTML = posts.map(toItem).join('');",
  "}",
  "",
  "function toItem(p) {",
  "  return `<li><a href=\"/${p.id}\">${p.title}</a></li>`;",
  "}",
  "",
  "loadPosts();",
];

function sourcesPanel(): HTMLElement {
  return el(
    "div",
    { class: "dt-sources" },
    el(
      "div",
      { class: "dt-files" },
      el("div", { class: "dt-files__head" }, "Page"),
      ...SOURCE_FILES.map((f, i) =>
        el("div", { class: "dt-file" + (i === 1 ? " dt-file--on" : "") }, f),
      ),
    ),
    el(
      "div",
      { class: "dt-code" },
      ...SOURCE_CODE.map((line, i) =>
        el(
          "div",
          { class: "dt-code__line" },
          el("span", { class: "dt-code__no" }, String(i + 1)),
          el("span", { class: "dt-code__text" }, line),
        ),
      ),
    ),
  );
}

/* ===================== Network ===================== */

const NETWORK_ROWS: [string, string, string, string, string][] = [
  ["index.html", "200", "document", "3.1 kB", "18 ms"],
  ["style.css", "200", "stylesheet", "12.4 kB", "9 ms"],
  ["main.js", "200", "script", "48.2 kB", "31 ms"],
  ["vendor.js", "200", "script", "134 kB", "76 ms"],
  ["posts", "200", "fetch", "1.8 kB", "14 ms"],
  ["logo.svg", "200", "svg+xml", "2.2 kB", "6 ms"],
  ["favicon.ico", "404", "text/html", "412 B", "5 ms"],
  ["profile.png", "200", "png", "88.7 kB", "52 ms"],
];

function networkPanel(): HTMLElement {
  return el(
    "div",
    { class: "dt-network" },
    el(
      "table",
      { class: "dt-net-table" },
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          ...["Name", "Status", "Type", "Size", "Time"].map((h) => el("th", {}, h)),
        ),
      ),
      el(
        "tbody",
        {},
        ...NETWORK_ROWS.map(([name, status, type, size, time]) =>
          el(
            "tr",
            {},
            el("td", { class: "dt-net__name" }, name),
            el("td", { class: status === "404" ? "dt-net__bad" : "" }, status),
            el("td", {}, type),
            el("td", {}, size),
            el("td", {}, time),
          ),
        ),
      ),
    ),
  );
}

/* ===================== 진입점 ===================== */

const PANELS: Record<DevTab, () => HTMLElement> = {
  Elements: elementsPanel,
  Console: consolePanel,
  Sources: sourcesPanel,
  Network: networkPanel,
};

export function renderDevtools(ctx: GameContext): HTMLElement {
  // 탭 전환은 모달 안의 로컬 변수 + DOM 교체로 끝낸다 — 게임 상태·재렌더와 무관하다.
  let active: DevTab = "Elements";

  const tabbar = el("div", { class: "dt-tabs" });
  const panel = el("div", { class: "dt-panel" });

  function paint(): void {
    mount(
      tabbar,
      ...TAB_IDS.map((t) =>
        el(
          "button",
          {
            class: "dt-tab" + (t === active ? " dt-tab--on" : ""),
            onclick: () => {
              active = t;
              paint();
            },
          },
          t,
        ),
      ),
    );
    mount(panel, PANELS[active]());
  }
  paint();

  return el(
    "div",
    { class: "modal modal--win modal--devtools" },
    winTitlebar(ctx, "개발자 도구"),
    el("div", { class: "devtools" }, tabbar, panel),
  );
}
