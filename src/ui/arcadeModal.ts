import type { GameContext } from "./context";
import { ARCADE_INTRO } from "@/data/arcade";
import { CLAW_COST, playClaw, type ClawResult } from "@/systems/arcade";
import { postTweet } from "@/systems/tweetSystem";
import { renderDollDexModal } from "./dollDexModal";
import { el, formatNumber } from "@/utils/dom";

/**
 * 오락실 인형뽑기 — 외출 조우로만 진입한다.
 *
 * ⚠️ **인형을 뽑으면 그 판이 끝난다.** 꽝·슬립일 때만 계속 시도할 수 있다.
 *    이 상한이 밸런스 축이라 "멈춰!" 버튼을 win 뒤에 다시 띄우면 안 된다.
 *
 * 마커는 requestAnimationFrame으로 좌우 왕복하고, 클릭 시점의 위치(0~1)를 systems에 넘긴다.
 * 판정은 전부 systems/arcade.ts가 한다 — 여기선 위치만 만든다.
 */

/** 마커가 한쪽 끝에서 반대쪽 끝까지 가는 데 걸리는 시간(ms) */
const SWEEP_MS = 1_400;

export function renderArcadeModal(ctx: GameContext): HTMLElement {
  const marker = el("div", { class: "claw__marker" });
  const status = el("p", { class: "claw__status" }, ARCADE_INTRO);
  const actions = el("div", { class: "compose-actions", style: "gap:10px" });

  let raf = 0;
  let running = false;
  let pos = 0;

  /** 애니메이션을 멈춘다(판 종료·모달 닫힘 공통) */
  const stopSweep = (): void => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const startSweep = (): void => {
    if (running) return;
    running = true;
    const t0 = performance.now();
    const step = (now: number): void => {
      if (!running) return;
      // 삼각파: 0→1→0 왕복
      const phase = ((now - t0) % (SWEEP_MS * 2)) / SWEEP_MS;
      pos = phase <= 1 ? phase : 2 - phase;
      marker.style.left = `${pos * 100}%`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  /** 버튼 줄을 통째로 다시 그린다 */
  const setActions = (...children: (HTMLElement | null)[]): void => {
    actions.replaceChildren(...children.filter((c): c is HTMLElement => c !== null));
  };

  const leave = (): void => {
    stopSweep();
    ctx.closeModal();
    ctx.afterAction("offline");
  };

  /** 뽑기 성공 — 판을 끝내고 자랑 트윗 기회를 준다 */
  const showWin = (r: ClawResult): void => {
    stopSweep();
    const doll = r.doll;
    if (!doll) return;

    const parts = [r.line];
    if (r.duplicate) parts.push("이미 있는 인형이라 서랍에 넣었다. 피망마켓에 팔 수 있다.");
    if (r.mental > 0) parts.push(`정신력 +${r.mental}`);
    if (r.completed) parts.push("인형 도감 완성! 창작이 크게 올랐다.");
    parts.push("오늘은 여기까지. 인형을 안고 오락실을 나왔다.");
    status.textContent = parts.join(" ");

    setActions(
      el("button", { class: "btn btn--ghost", onclick: leave }, "나가기"),
      el(
        "button",
        { class: "btn btn--ghost", onclick: () => ctx.openModal(renderDollDexModal) },
        "도감 보기",
      ),
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            ctx.update((s) => {
              postTweet(s, "daily", doll.brag, false);
            });
            ctx.toast(`${doll.emoji} 자랑 트윗을 올렸어요`);
            leave();
          },
        },
        "자랑 트윗 올리기",
      ),
    );
  };

  /** 다음 판을 기다리는 상태 */
  const renderIdle = (): void => {
    startSweep();
    setActions(
      el("button", { class: "btn btn--ghost", onclick: leave }, "그만하기"),
      el(
        "button",
        { class: "btn btn--ghost", onclick: () => ctx.openModal(renderDollDexModal) },
        "도감",
      ),
      el(
        "button",
        { class: "btn", onclick: () => tryOnce() },
        `멈춰! (${formatNumber(CLAW_COST)}원)`,
      ),
    );
  };

  /** 한 판 굴리기 */
  function tryOnce(): void {
    if (!running) return; // 이미 판정 중이면 중복 클릭 무시
    const s = ctx.store.getState();
    if (s.money < CLAW_COST) {
      status.textContent = `주머니를 뒤졌지만 동전이 없다. 한 판에 ${formatNumber(CLAW_COST)}원은 있어야 한다.`;
      return;
    }
    const at = pos;
    stopSweep();

    let result: ClawResult | null = null;
    ctx.update((st) => {
      result = playClaw(st, at);
    });
    const r = result as ClawResult | null;
    if (!r) return;

    if (r.outcome === "win") {
      showWin(r);
      return;
    }
    // 꽝·슬립 — 계속 시도할 수 있다
    status.textContent = r.line;
    renderIdle();
  }

  renderIdle();

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🕹️ 오락실 인형뽑기"),
      el("button", { class: "popup__close", onclick: leave }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "div",
        { class: "claw__rail" },
        el("div", { class: "claw__zone claw__zone--common" }),
        el("div", { class: "claw__zone claw__zone--rare" }),
        marker,
      ),
      el(
        "p",
        { class: "compose-hint" },
        "가운데로 갈수록 좋은 인형이에요. 집게 힘이 약해서 잡았다가 놓치기도 합니다.",
      ),
      status,
      actions,
    ),
  );
}
