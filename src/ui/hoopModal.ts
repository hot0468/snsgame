import type { GameContext } from "./context";
import { HOOP_INTRO, HOOP_MISS_LINES, HOOP_SCORE_LINES } from "@/data/basketball";
import { pick } from "@/utils/random";
import {
  HOOP_COST,
  HOOP_DURATION_MS,
  finishHoop,
  payHoop,
  type HoopResult,
} from "@/systems/basketball";
import { renderArcadePickModal } from "./arcadePickModal";
import { el, formatNumber } from "@/utils/dom";

/**
 * 오락실 농구 슛 — 기계 선택 화면(arcadePickModal)에서만 진입한다.
 *
 * ⚠️ **판정은 물리다.** 공이 림을 통과했는지는 ui/hoopScene.ts의 Phaser + Matter가
 *    정한다. 이 파일은 기계 껍데기와 동전·타이머, 그리고 씬이 알려준 최종 점수를
 *    게임 상태에 반영하는 일만 한다(인형뽑기 arcadeModal.ts와 같은 역할 분담).
 *
 * ⚠️ Phaser는 **동적 import**한다 — 정적으로 붙이면 1.1MB가 첫 화면 번들에 들어간다.
 *    그래서 캔버스는 비동기로 뒤늦게 붙고, 그 전에 모달이 닫힐 수 있다(아래 `alive` 가드).
 *
 * ⚠️ 모달이 닫힐 때 `game.destroy(true)`를 반드시 거친다. 씬 안에서 타이머가 계속
 *    돌기 때문에, 안 지우면 닫힌 뒤에도 배경에서 판이 진행된다.
 */

export function renderHoopModal(ctx: GameContext): HTMLElement {
  const stage = el("div", { class: "hoop-stage" });
  const status = el("p", { class: "hoop__status" }, HOOP_INTRO);
  const actions = el("div", { class: "compose-actions", style: "gap:10px" });

  /** 모달이 아직 살아 있는지 — 늦게 도착한 Phaser가 죽은 모달에 캔버스를 붙이지 않게 한다 */
  let alive = true;
  let game: { destroy: (removeCanvas: boolean) => void } | null = null;
  /** 판이 끝나 정산까지 마쳤는지 */
  let done = false;

  const setActions = (...children: (HTMLElement | null)[]): void => {
    actions.replaceChildren(...children.filter((c): c is HTMLElement => c !== null));
  };

  /** 씬을 정리한다. 여러 번 불려도 안전해야 한다(닫기·정산이 둘 다 부른다). */
  const teardown = (): void => {
    alive = false;
    game?.destroy(true);
    game = null;
  };

  const leave = (): void => {
    teardown();
    ctx.closeModal();
    ctx.afterAction("offline");
  };

  /** 기계 선택 화면으로 돌아간다 — 한 방문에 여러 판을 해도 된다(소지금이 자연 제동) */
  const backToPick = (): void => {
    teardown();
    ctx.openModal(renderArcadePickModal);
  };

  const scoreLabel = el("span", { class: "hoop-machine__score" }, "0골");
  const timeLabel = el("span", { class: "hoop-machine__time" }, "30초");

  const machine = el(
    "div",
    { class: "hoop-machine" },
    el(
      "div",
      { class: "hoop-machine__marquee" },
      // ⚠️ span으로 감싸야 CSS가 글자 뒤에 판을 깔아 전구와 겹침을 막을 수 있다.
      el("span", {}, "🏀 3POINT SHOOTOUT"),
    ),
    el("div", { class: "hoop-machine__cage" }, stage),
    el(
      "div",
      { class: "hoop-machine__panel" },
      timeLabel,
      el("span", { class: "hoop-machine__coin" }, `1판 ${formatNumber(HOOP_COST)}원`),
      scoreLabel,
    ),
  );

  /**
   * 제한시간이 끝났다 — 정산 결과를 못 박아 보여준다.
   * 상태 문구만 바꾸면 "끝난 건가?"가 된다(인형뽑기 showWin과 같은 판단).
   */
  const showResult = (r: HoopResult): void => {
    const rows: HTMLElement[] = [];
    if (r.prize.money > 0) {
      rows.push(
        el("p", { class: "hoop-win__gain" }, `소지금 +${formatNumber(r.prize.money)}원`),
      );
    }
    for (const gain of r.skillGains) {
      rows.push(el("p", { class: "hoop-win__gain" }, `${gain.label} +${gain.delta}`));
    }
    if (r.prize.mental > 0) {
      rows.push(el("p", { class: "hoop-win__gain" }, `정신력 +${r.prize.mental}`));
    }
    if (r.isBest) {
      rows.push(el("p", { class: "hoop-win__best" }, `🏆 신기록! 최고 ${r.best}골`));
    } else {
      rows.push(el("p", { class: "hoop-win__note" }, `최고 기록 ${r.best}골`));
    }

    const canReplay = ctx.store.getState().money >= HOOP_COST;

    const finish = el(
      "div",
      { class: "hoop-finish" },
      el(
        "div",
        { class: "hoop-win" },
        el("div", { class: "hoop-win__title" }, `${r.score}골`),
        el("div", { class: "hoop-win__label" }, r.prize.label),
        el("p", { class: "hoop-win__result" }, r.prize.result),
        ...rows,
        el(
          "div",
          { class: "hoop-win__actions" },
          canReplay
            ? (el(
                "button",
                { class: "btn", onclick: backToPick },
                "기계 고르기",
              ) as HTMLElement)
            : null,
          el("button", { class: "btn btn--ghost", onclick: leave }, "오락실 나가기"),
        ),
      ),
    );
    root.appendChild(finish);
  };

  /** 한 판을 정산한다(씬이 시간 종료를 알렸을 때 딱 한 번) */
  const settle = (score: number): void => {
    if (done) return;
    done = true;
    teardown();

    let result: HoopResult | null = null;
    ctx.update((s) => {
      result = finishHoop(s, score);
    });
    const r = result as HoopResult | null;
    if (r) {
      status.textContent = `종료! ${r.score}골`;
      setActions();
      showResult(r);
    }
  };

  setActions(el("button", { class: "btn btn--ghost", onclick: leave }, "그만하기"));

  // 동전을 먼저 넣는다 — 성공하든 말든 돈은 나간다(오락실이다).
  let paid = false;
  ctx.update((s) => {
    paid = payHoop(s);
  });

  if (!paid) {
    status.textContent = `주머니를 뒤졌지만 동전이 없다. 한 판에 ${formatNumber(HOOP_COST)}원은 있어야 한다.`;
    setActions(el("button", { class: "btn btn--ghost", onclick: backToPick }, "돌아가기"));
  } else {
    // Phaser는 무거우므로 농구기를 실제로 연 지금에서야 받아온다.
    void import("./hoopScene").then(({ mountHoopGame }) => {
      if (!alive) return;
      const mounted = mountHoopGame(
        stage,
        {
          onScore: (total) => {
            if (done) return;
            scoreLabel.textContent = `${total}골`;
            status.textContent = pick(HOOP_SCORE_LINES);
          },
          onMiss: () => {
            if (done) return;
            status.textContent = pick(HOOP_MISS_LINES);
          },
          onTick: (remainMs) => {
            if (done) return;
            timeLabel.textContent = `${Math.ceil(remainMs / 1000)}초`;
          },
          onEnd: (score) => settle(score),
        },
        HOOP_DURATION_MS,
      );
      game = mounted.game;
    });
  }

  const root = el(
    "div",
    { class: "modal modal--hoop" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🏀 오락실 농구 슛"),
      el("button", { class: "popup__close", onclick: leave }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      machine,
      el(
        "p",
        { class: "compose-hint" },
        "화면을 눌러 끌면 당긴 방향이 보입니다. 손을 떼면 그 반대로 공이 날아갑니다. 30초 동안 몇 골이나 넣을 수 있을까요?",
      ),
      status,
      actions,
    ),
  );
  return root;
}
