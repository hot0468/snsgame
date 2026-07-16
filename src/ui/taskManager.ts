import type { GameContext } from "./context";
import { runCheatExe } from "@/systems/cheat";
import { el, mount } from "@/utils/dom";
import { winTitlebar } from "./components";

/**
 * 작업 관리자 창.
 *
 * 프로세스 탭만 실제로 동작하고 성능·앱 기록은 장식이다.
 * 프로세스 목록에는 Cheat.exe가 섞여 있고 더블클릭하면 실행된다.
 *
 * ⚠️ 게임은 Cheat.exe가 뭔지 설명하지 않는다. 실행하면 그냥 꺼진다.
 *    효과 계산·1회 제한은 전부 systems/cheat.ts가 한다.
 */

const CHEAT_PROC = "Cheat.exe";

interface Proc {
  name: string;
  cpu: string;
  mem: string;
}

/**
 * 프로세스 목록. Cheat.exe는 이미 실행했으면(=종료됐으면) 목록에서 사라진다
 * — '이미 씀' 처리를 따로 하지 않아도 자연스럽게 맞아떨어진다.
 */
function processes(used: boolean): Proc[] {
  const list: Proc[] = [
    { name: "안티맬웨어 서비스 실행 파일", cpu: "4.6%", mem: "210.3MB" },
    { name: "데스크톱 창 관리자", cpu: "2.1%", mem: "94.8MB" },
    { name: "Windows 탐색기", cpu: "1.2%", mem: "68.4MB" },
    { name: "작업 관리자", cpu: "0.8%", mem: "32.1MB" },
    { name: "냥이 트레이 아이콘", cpu: "0.3%", mem: "18.6MB" },
    { name: CHEAT_PROC, cpu: "0.0%", mem: "1.2MB" },
    { name: "런타임 브로커", cpu: "0.2%", mem: "22.4MB" },
    { name: "서비스 호스트: 로컬 시스템", cpu: "0.1%", mem: "12.9MB" },
    { name: "검색 인덱서", cpu: "0.0%", mem: "44.0MB" },
    { name: "오디오 장치 그래프 격리", cpu: "0.0%", mem: "8.7MB" },
    { name: "시스템", cpu: "0.4%", mem: "0.2MB" },
  ];
  return used ? list.filter((p) => p.name !== CHEAT_PROC) : list;
}

type TabId = "proc" | "perf" | "app";

const TABS: { id: TabId; label: string }[] = [
  { id: "proc", label: "프로세스" },
  { id: "perf", label: "성능" },
  { id: "app", label: "앱 기록" },
];

export function renderTaskManagerModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal modal--win modal--tm" });

  let tab: TabId = "proc";
  let selected: string | null = null;
  /** Cheat.exe 실행 연출 중인지(창이 잠깐 떴다 꺼진다) */
  let flashing = false;

  /** Cheat.exe 더블클릭 — 창이 뜨는 듯하다 바로 꺼지고, 프로세스가 사라진다. */
  function launchCheat(): void {
    if (flashing) return;
    flashing = true;
    draw();
    window.setTimeout(() => {
      flashing = false;
      let ok = false;
      ctx.update((s) => {
        ok = runCheatExe(s);
      });
      selected = null;
      draw();
      // 왜 꺼졌는지, 뭐가 달라졌는지는 알려주지 않는다.
      if (ok) ctx.toast("Cheat.exe이(가) 작동을 멈췄습니다.");
    }, 700);
  }

  function procRow(p: Proc): HTMLElement {
    const on = selected === p.name;
    return el(
      "div",
      {
        class: "tm-row" + (on ? " tm-row--on" : ""),
        onclick: () => {
          selected = p.name;
          draw();
        },
        ondblclick: () => {
          // 다른 프로세스는 더블클릭해도 아무 일도 없다.
          if (p.name === CHEAT_PROC) launchCheat();
        },
      },
      el("span", { class: "tm-cell tm-cell--name" }, p.name),
      el("span", { class: "tm-cell tm-cell--num" }, p.cpu),
      el("span", { class: "tm-cell tm-cell--num" }, p.mem),
    );
  }

  function procTab(): HTMLElement {
    const list = processes(ctx.store.getState().cheats.cheatExe);
    return el(
      "div",
      { class: "tm-body" },
      el(
        "div",
        { class: "tm-row tm-row--head" },
        el("span", { class: "tm-cell tm-cell--name" }, "이름"),
        el("span", { class: "tm-cell tm-cell--num" }, "CPU"),
        el("span", { class: "tm-cell tm-cell--num" }, "메모리"),
      ),
      el("div", { class: "tm-list" }, ...list.map(procRow)),
    );
  }

  /** 성능 탭 — 장식. 실제 수치와 연동되지 않는다. */
  function perfCard(label: string, sub: string, pct: number): HTMLElement {
    return el(
      "div",
      { class: "tm-perf__card" },
      el(
        "div",
        { class: "tm-perf__head" },
        el("span", { class: "tm-perf__label" }, label),
        el("span", { class: "tm-perf__val" }, `${pct}%`),
      ),
      el(
        "div",
        { class: "tm-graph" },
        el("div", { class: "tm-graph__fill", style: `width:${pct}%` }),
      ),
      el("div", { class: "tm-perf__sub" }, sub),
    );
  }

  function perfTab(): HTMLElement {
    return el(
      "div",
      { class: "tm-body tm-perf" },
      perfCard("CPU", "Intel Core i5-9400 · 2.90GHz", 11),
      perfCard("메모리", "8.0GB 중 4.6GB 사용 중", 57),
      perfCard("디스크 0 (C:)", "SSD · 활성 시간", 3),
      perfCard("이더넷", "보내기 0.2Mbps · 받기 1.4Mbps", 2),
    );
  }

  /** 앱 기록 탭 — 장식. */
  function appTab(): HTMLElement {
    const rows: [string, string, string][] = [
      ["그리터", "3:24:11", "812.4MB"],
      ["너튜브", "1:08:52", "1,204.9MB"],
      ["메디북스", "0:41:07", "96.2MB"],
      ["마켓걸리버", "0:12:33", "48.8MB"],
      ["설정", "0:01:19", "2.1MB"],
    ];
    return el(
      "div",
      { class: "tm-body" },
      el(
        "div",
        { class: "tm-row tm-row--head" },
        el("span", { class: "tm-cell tm-cell--name" }, "이름"),
        el("span", { class: "tm-cell tm-cell--num" }, "CPU 시간"),
        el("span", { class: "tm-cell tm-cell--num" }, "네트워크"),
      ),
      el(
        "div",
        { class: "tm-list" },
        ...rows.map(([name, cpu, net]) =>
          el(
            "div",
            { class: "tm-row" },
            el("span", { class: "tm-cell tm-cell--name" }, name),
            el("span", { class: "tm-cell tm-cell--num" }, cpu),
            el("span", { class: "tm-cell tm-cell--num" }, net),
          ),
        ),
      ),
    );
  }

  function tabBar(): HTMLElement {
    return el(
      "div",
      { class: "tm-tabs" },
      ...TABS.map((t) =>
        el(
          "button",
          {
            class: "tm-tab" + (tab === t.id ? " tm-tab--on" : ""),
            onclick: () => {
              tab = t.id;
              draw();
            },
          },
          t.label,
        ),
      ),
    );
  }

  function draw(): void {
    const body = tab === "proc" ? procTab() : tab === "perf" ? perfTab() : appTab();
    mount(
      container,
      winTitlebar(ctx, "작업 관리자"),
      tabBar(),
      body,
      el(
        "div",
        { class: "tm-foot" },
        el(
          "button",
          {
            class: "tm-endbtn",
            disabled: !selected,
            // 실제로 끝낼 수 있는 프로세스는 없다(윈도우답게 거부한다).
            // Cheat.exe도 마찬가지 — 끄는 게 아니라 실행하는 것만 된다.
            onclick: () => ctx.toast("액세스가 거부되었습니다."),
          },
          "작업 끝내기",
        ),
      ),
      // 실행되는 듯하더니 바로 꺼지는 창.
      flashing
        ? el(
            "div",
            { class: "cheat-flash" },
            el(
              "div",
              { class: "cheat-flash__win" },
              el("div", { class: "cheat-flash__bar" }, CHEAT_PROC),
              el("div", { class: "cheat-flash__body" }),
            ),
          )
        : null,
    );
  }

  draw();
  return container;
}
