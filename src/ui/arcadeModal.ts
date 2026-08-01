import type { GameContext } from "./context";
import type { ClawScene } from "./arcadeScene";
import { ARCADE_INTRO, CLAW_MISS_LINES, CLAW_SLIP_LINES } from "@/data/arcade";
import { pick } from "@/utils/random";
import { CLAW_COST, collectDoll, payClaw, type ClawResult } from "@/systems/arcade";
import { postTweet } from "@/systems/tweetSystem";
import { renderDexModal } from "./dexModal";
import { el, formatNumber } from "@/utils/dom";

/**
 * 오락실 인형뽑기 — 외출 조우로만 진입한다.
 *
 * ⚠️ **판정은 물리다.** 집게가 인형에 걸리는지, 올라오다 놓치는지는 ui/arcadeScene.ts의
 *    Phaser + Matter 시뮬레이션이 정한다. 이 파일은 기계 껍데기와 버튼, 그리고
 *    씬이 알려준 결과를 게임 상태에 반영하는 일만 한다.
 *
 * ⚠️ **인형을 뽑으면 그 판이 끝난다**(밸런스 축). 성공 뒤에 '집게 내리기'를 다시 열지 마라.
 *
 * ⚠️ Phaser는 **동적 import**한다 — 정적으로 붙이면 1.1MB가 첫 화면 번들에 들어간다.
 *    그래서 캔버스는 비동기로 뒤늦게 붙고, 그 전에 모달이 닫힐 수 있다(아래 `alive` 가드).
 */

export function renderArcadeModal(ctx: GameContext): HTMLElement {
  const stage = el("div", { class: "claw-stage" });
  const status = el("p", { class: "claw__status" }, ARCADE_INTRO);
  const actions = el("div", { class: "compose-actions", style: "gap:10px" });

  /** 모달이 아직 살아 있는지 — 늦게 도착한 Phaser가 죽은 모달에 캔버스를 붙이지 않게 한다 */
  let alive = true;
  let game: { destroy: (removeCanvas: boolean) => void } | null = null;
  let sceneOf: (() => ClawScene | undefined) | null = null;
  /** 이번 방문에서 이미 인형을 가져갔는지(판 종료) */
  let done = false;

  const setActions = (...children: (HTMLElement | null)[]): void => {
    actions.replaceChildren(...children.filter((c): c is HTMLElement => c !== null));
  };

  const leave = (): void => {
    alive = false;
    game?.destroy(true);
    game = null;
    ctx.closeModal();
    ctx.afterAction("offline");
  };

  /** 조작 버튼(누르고 있는 동안 이동) */
  const moveBtn = (dir: -1 | 1, label: string): HTMLButtonElement => {
    const b = el("button", { class: "claw-machine__move" }, label) as HTMLButtonElement;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      sceneOf?.()?.setMove(dir);
    });
    // 버튼 밖에서 손을 떼도 멈춰야 한다 — up/leave/cancel 전부 받는다.
    for (const evName of ["pointerup", "pointerleave", "pointercancel"]) {
      b.addEventListener(evName, () => sceneOf?.()?.setMove(0));
    }
    return b;
  };
  const dropBtn = el(
    "button",
    { class: "claw-machine__press", onclick: () => sceneOf?.()?.drop() },
    "집게 내리기",
  ) as HTMLButtonElement;

  const machine = el(
    "div",
    { class: "claw-machine" },
    el("div", { class: "claw-machine__marquee" }),
    el("div", { class: "claw-machine__glass" }, stage, el("div", { class: "claw-machine__shine" })),
    el(
      "div",
      { class: "claw-machine__panel" },
      moveBtn(-1, "◀"),
      moveBtn(1, "▶"),
      el("span", { class: "claw-machine__coin" }, `1판 ${formatNumber(CLAW_COST)}원`),
      dropBtn,
      el("span", { class: "claw-machine__lamp claw-machine__lamp--red" }),
    ),
  );

  /**
   * 뽑기 성공 — **판이 끝났다는 걸 팝업으로 못 박는다.**
   * 상태 문구만 바꾸면 "왜 집게 내리기가 안 눌리지?"가 된다(한 방문 1개가 이 기능의 밸런스 축이라
   * 성공 = 종료인데, 그게 화면에서 안 보이면 버그로 읽힌다).
   */
  const showWin = (r: ClawResult): void => {
    done = true;
    dropBtn.disabled = true;
    dropBtn.textContent = "오늘은 여기까지";
    status.textContent = r.line;

    const rows: HTMLElement[] = [];
    if (r.duplicate) {
      rows.push(el("p", { class: "claw-win__note" }, "이미 있는 인형이라 서랍행 — 피망마켓에 팔 수 있어요."));
    } else {
      rows.push(el("p", { class: "claw-win__note" }, "도감에 새로 등록했어요!"));
    }
    if (r.mental > 0) rows.push(el("p", { class: "claw-win__gain" }, `정신력 +${r.mental}`));
    if (r.completed) {
      rows.push(el("p", { class: "claw-win__gain" }, "🏆 인형 도감 완성! 창작이 크게 올랐다"));
    }

    const finish = el(
      "div",
      { class: "claw-finish" },
      el(
        "div",
        { class: "claw-win" },
        el("div", { class: "claw-win__title" }, "뽑았다!"),
        el("div", { class: "claw-win__emoji" }, r.doll.emoji),
        el("div", { class: "claw-win__name" }, r.doll.name),
        ...rows,
        el(
          "p",
          { class: "claw-win__end" },
          "오늘은 여기까지. 인형을 안고 오락실을 나왔다.",
        ),
        el(
          "div",
          { class: "claw-win__actions" },
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                ctx.update((s) => {
                  postTweet(s, "daily", r.doll.brag, false);
                });
                ctx.toast(`${r.doll.emoji} 자랑 트윗을 올렸어요`);
                leave();
              },
            },
            "자랑 트윗 올리기",
          ),
          el(
            "button",
            { class: "btn btn--ghost", onclick: () => ctx.openModal((c) => renderDexModal(c, "doll")) },
            "도감 보기",
          ),
          el("button", { class: "btn btn--ghost", onclick: leave }, "나가기"),
        ),
      ),
    );
    root.appendChild(finish);
  };

  setActions(
    el("button", { class: "btn btn--ghost", onclick: leave }, "그만하기"),
    el(
      "button",
      { class: "btn btn--ghost", onclick: () => ctx.openModal((c) => renderDexModal(c, "doll")) },
      "도감",
    ),
  );

  // Phaser는 무거우므로 오락실을 실제로 연 지금에서야 받아온다.
  void import("./arcadeScene").then(({ mountClawGame }) => {
    if (!alive) return;
    const mounted = mountClawGame(stage, {
      canPay: () => !done && ctx.store.getState().money >= CLAW_COST,
      onDrop: () => {
        ctx.update((s) => {
          payClaw(s);
        });
      },
      onStatus: (text) => {
        if (!done) status.textContent = text;
      },
      onCollect: (dollId) => {
        let r: ClawResult | null = null;
        ctx.update((s) => {
          r = collectDoll(s, dollId);
        });
        const res = r as ClawResult | null;
        if (res) showWin(res);
      },
      onFail: (reason) => {
        if (done) return;
        const broke = ctx.store.getState().money < CLAW_COST;
        status.textContent = broke
          ? `주머니를 뒤졌지만 동전이 없다. 한 판에 ${formatNumber(CLAW_COST)}원은 있어야 한다.`
          : pick(reason === "slip" ? CLAW_SLIP_LINES : CLAW_MISS_LINES);
      },
    });
    game = mounted.game;
    sceneOf = mounted.scene;
  });

  const root = el(
    "div",
    { class: "modal modal--claw" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🕹️ 오락실 인형뽑기"),
      el("button", { class: "popup__close", onclick: leave }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      machine,
      el(
        "p",
        { class: "compose-hint" },
        "◀ ▶ 로 집게를 옮기고 내리세요(방향키·스페이스도 됩니다). 무거운 인형일수록 올라오다 미끄러집니다.",
      ),
      status,
      actions,
    ),
  );
  return root;
}
