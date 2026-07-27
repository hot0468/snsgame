import type { GameContext } from "./context";
import type { HairGrade, HairQuestion } from "@/data/hairSalon";
import { HAIR_QUESTIONS } from "@/data/hairSalon";
import {
  SALON_ACTION,
  SALON_COST,
  applyHairResult,
  pickSalonGame,
  talkGrade,
  type SalonOutcome,
} from "@/systems/hairSalon";
import { sample } from "@/utils/random";
import { el, formatNumber } from "@/utils/dom";

/**
 * 미용실 미니게임 모달. 입장할 때 두 종 중 하나가 랜덤으로 정해진다.
 *
 * - **타이밍**: 염색약 게이지가 좌우로 움직인다. 완벽 구간(가운데)에서 STOP하면 인생머리,
 *   지나치면 머리가 상한다. `requestAnimationFrame`으로 굴리고, 모달이 닫히면 반드시 멈춘다.
 * - **대화**: 3문항 선택. 점수 합(0~6)이 등급이 된다(판정은 systems/hairSalon).
 *
 * 결제·행동력·시간은 **결과 확정 시점**에 systems가 한 번에 처리한다 — 중간에 닫으면 아무 일도 없다.
 */
export function renderHairSalonModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal modal--salon" });
  const game = pickSalonGame();
  /** rAF 루프 id — 결과로 넘어가거나 모달이 사라지면 반드시 취소한다(누수·유령 프레임 방지). */
  let raf = 0;

  function head(title: string): HTMLElement {
    return el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, `✂️ ${title}`),
      el(
        "button",
        {
          class: "popup__close",
          onclick: () => {
            cancelAnimationFrame(raf);
            ctx.closeModal();
          },
        },
        "✕",
      ),
    );
  }

  /* ─────────────── 타이밍 게이지 ─────────────── */

  /** 완벽 판정 구간(%) — 가운데 8%p 폭 */
  const PERFECT_MIN = 62;
  const PERFECT_MAX = 70;
  /** 무난 판정 구간(%) — 완벽 구간 앞쪽 */
  const GOOD_MIN = 40;

  function timingGrade(pos: number): HairGrade {
    if (pos >= PERFECT_MIN && pos <= PERFECT_MAX) return "perfect";
    if (pos >= GOOD_MIN && pos < PERFECT_MIN) return "good";
    return "bad"; // 너무 이르거나(40 미만) 완벽 구간을 지나침(70 초과)
  }

  function showTiming(): void {
    let pos = 0;
    let stopped = false;
    const fill = el("div", { class: "salon-gauge__fill", style: "width:0%" });
    const marker = el("div", { class: "salon-gauge__marker", style: "left:0%" });
    const readout = el("div", { class: "salon-gauge__readout" }, "0%");

    const stop = (): void => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      finish(timingGrade(pos));
    };

    const step = (): void => {
      if (stopped) return;
      // 프레임당 0.5%p ≈ 초당 30%p — 전체 3.3초, 완벽 구간(8%p) 통과에 약 0.27초가 주어진다.
      // 더 빠르게 하면(0.9) 사람이 못 맞추고, 더 느리면 긴장이 사라진다.
      pos += 0.5;
      if (pos >= 100) {
        // 끝까지 방치하면 약을 태운 것 — 자동으로 최악 판정.
        pos = 100;
        stop();
        return;
      }
      fill.style.width = `${pos}%`;
      marker.style.left = `${pos}%`;
      readout.textContent = `${Math.round(pos)}%`;
      raf = requestAnimationFrame(step);
    };

    container.replaceChildren(
      head("염색 타이밍"),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { class: "compose-hint", style: "margin-top:0" },
          "약이 스며드는 중이에요. 초록 구간에서 멈추면 인생머리, 지나치면 머리가 상해요.",
        ),
        el(
          "div",
          { class: "salon-gauge" },
          el("div", { class: "salon-gauge__track" }, fill),
          el("div", {
            class: "salon-gauge__zone",
            style: `left:${PERFECT_MIN}%;width:${PERFECT_MAX - PERFECT_MIN}%`,
          }),
          marker,
        ),
        readout,
        el(
          "div",
          { class: "compose-actions", style: "margin-top:14px" },
          el("button", { class: "btn salon-stop", onclick: stop }, "STOP!"),
        ),
      ),
    );
    raf = requestAnimationFrame(step);
  }

  /* ─────────────── 대화 견디기 ─────────────── */

  function showTalk(questions: HairQuestion[], idx: number, score: number): void {
    const q = questions[idx];
    container.replaceChildren(
      head(`미용사와의 대화 (${idx + 1}/${questions.length})`),
      el(
        "div",
        { class: "modal__body" },
        el("p", { class: "salon-talk__ask" }, `“${q.ask}”`),
        el(
          "div",
          { class: "salon-talk__options" },
          ...q.options.map((opt) =>
            el(
              "button",
              {
                class: "salon-talk__opt",
                onclick: () => {
                  const next = score + opt.score;
                  if (idx + 1 < questions.length) showTalk(questions, idx + 1, next);
                  else finish(talkGrade(next));
                },
              },
              opt.text,
            ),
          ),
        ),
      ),
    );
  }

  /* ─────────────── 결과 ─────────────── */

  function finish(grade: HairGrade): void {
    const out: { result: SalonOutcome | null } = { result: null };
    ctx.update((s) => {
      out.result = applyHairResult(s, game, grade);
    });
    const r = out.result;
    if (!r) return;
    const badge = r.grade === "perfect" ? "인생머리" : r.grade === "good" ? "무난" : "망함";
    container.replaceChildren(
      head("미용실 결과"),
      el(
        "div",
        { class: "modal__body" },
        el("div", { class: `salon-result salon-result--${r.grade}` }, badge),
        el("p", { class: "salon-result__msg" }, r.message),
        // ⚠️ 델타 0은 표시하지 않는다 — 미용이 이미 0인데 감소분이 clamp되면 "미용 +0"이 떠서
        //    고장으로 보인다(offlineModal의 같은 규칙과 맞춘다).
        el(
          "p",
          { class: "salon-result__delta" },
          [
            r.beauty !== 0 ? `미용 ${r.beauty > 0 ? "+" : ""}${r.beauty}` : null,
            r.mental !== 0 ? `정신력 ${r.mental > 0 ? "+" : ""}${r.mental}` : null,
            `${formatNumber(SALON_COST)}원`,
            `행동력 -${SALON_ACTION}`,
          ]
            .filter(Boolean)
            .join(" · "),
        ),
        el(
          "div",
          { class: "compose-actions" },
          el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
        ),
      ),
    );
    ctx.refresh();
  }

  if (game === "timing") showTiming();
  else showTalk(sample(HAIR_QUESTIONS, 3), 0, 0);
  return container;
}
