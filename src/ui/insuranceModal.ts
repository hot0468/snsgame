import type { GameContext } from "./context";
import { COLD_MENTAL_COST, INSURANCE_ACTION_COST, INSURANCE_COMPANY } from "@/data/insurance";
import {
  coldChance,
  knownChance,
  knownContacts,
  rollColdTarget,
  sellToCold,
  sellToKnown,
  type SalesResult,
} from "@/systems/insurance";
import { relStateOf } from "@/systems/relationship";
import { clampAction } from "@/systems/stats";
import { advanceTime } from "@/systems/time";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 보험설계사 출근 — 평일 낮이 되면 app이 강제로 띄운다(회사원 근무 모달과 같은 자리).
 *
 * 고르는 건 둘뿐이다:
 *  - **지인 영업**: 성사율이 높지만 그 사람의 호감도를 태운다. 0이 되면 연락이 끊긴다.
 *  - **무작위 영업**: 성사율이 낮지만 아무도 잃지 않는다. 정신력을 낸다.
 *
 * ⚠️ **성사율을 숫자로 보여주지 않는다.** 이 게임의 다른 화면과 같은 원칙 —
 *    수치를 깔면 기댓값 계산기가 되고, "누구를 태울까"라는 감정적 결정이 사라진다.
 *    대신 호감도 구간을 문구로 알려 어느 쪽이 유리한지는 알 수 있게 한다.
 */
export function renderInsuranceModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  /** 성사율(0~1) → 문구. 숫자 대신 이걸 쓴다. */
  const oddsLabel = (p: number): string =>
    p >= 0.7 ? "거절하기 어려워 보인다" : p >= 0.45 ? "해볼 만하다" : p >= 0.25 ? "쉽지 않다" : "거의 안 될 것 같다";

  const finish = (r: SalesResult | null): void => {
    // 근무 1블록: 행동력과 시간은 영업을 한 번 돌렸을 때 소모한다.
    ctx.update((st) => {
      st.resources.action = clampAction(st, st.resources.action - INSURANCE_ACTION_COST);
      advanceTime(st, 1);
    });
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("walk", { size: 18 }), "영업 종료"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el("p", { class: "taxi__result" }, r?.line ?? "오늘은 아무 일도 없었다."),
        r?.signed
          ? el(
              "div",
              { class: "taxi__payout" },
              el("span", { class: "taxi__fare" }, `+${formatNumber(r.commission)}원`),
              el("span", { class: "taxi__rating" }, "계약 성사"),
            )
          : el(
              "div",
              { class: "taxi__payout" },
              el("span", { class: "taxi__rating taxi__rating--down" }, "계약 없음"),
            ),
        el(
          "div",
          { class: "compose-actions" },
          el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
        ),
      ),
    );
  };

  /** 지인 목록 화면. */
  const showKnown = (): void => {
    const s = ctx.store.getState();
    const contacts = knownContacts(s);
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("walk", { size: 18 }), "누구에게 연락할까"),
      ),
      el(
        "div",
        { class: "modal__body" },
        contacts.length === 0
          ? el(
              "p",
              { class: "taxi__scene" },
              "연락처를 넘겨봤지만 이제 부탁할 사람이 없다.\n남은 건 모르는 사람들뿐이다.",
            )
          : el(
              "div",
              { class: "taxi__choices" },
              ...contacts.map((c) => {
                const rel = relStateOf(s, c.id);
                return el(
                  "button",
                  {
                    class: "btn btn--ghost taxi__choice",
                    onclick: () => {
                      let r: SalesResult | null = null;
                      ctx.update((st) => {
                        r = sellToKnown(st, c.id);
                      });
                      finish(r);
                    },
                  },
                  el("span", { class: "ins__name" }, c.nickname),
                  el("span", { class: "ins__odds" }, oddsLabel(knownChance(s, c.id))),
                  el("span", { class: "ins__aff" }, `호감 ${rel.affinity}`),
                );
              }),
            ),
        el(
          "div",
          { class: "compose-actions" },
          el("button", { class: "btn btn--ghost", onclick: () => showChoice() }, "돌아가기"),
        ),
      ),
    );
  };

  /** 무작위 영업 화면. */
  const showCold = (): void => {
    const s = ctx.store.getState();
    const target = rollColdTarget();
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("walk", { size: 18 }), "오늘의 발품"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { class: "taxi__scene" },
          `${target.place}. ${target.who}에게 명함을 내밀었다.\n${oddsLabel(coldChance(s))}.`,
        ),
        el(
          "p",
          { class: "compose-hint" },
          `정신력 -${COLD_MENTAL_COST} · 아무도 잃지 않는다`,
        ),
        el(
          "div",
          { class: "compose-actions" },
          el("button", { class: "btn btn--ghost", onclick: () => showChoice() }, "돌아가기"),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                let r: SalesResult | null = null;
                ctx.update((st) => {
                  r = sellToCold(st);
                });
                finish(r);
              },
            },
            "말을 건다",
          ),
        ),
      ),
    );
  };

  /** 첫 화면 — 오늘 뭘 할지 고른다. */
  function showChoice(): void {
    const s = ctx.store.getState();
    const remaining = knownContacts(s).length;
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("walk", { size: 18 }), `${INSURANCE_COMPANY} 출근`),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { class: "compose-hint", style: "margin-top:0" },
          `이번 달 계약 ${s.insuranceJob?.contracts ?? 0}건 · 남은 지인 ${remaining}명`,
        ),
        el(
          "p",
          { class: "taxi__scene" },
          "지점장이 실적판을 두드리며 지나갔다.\n오늘도 어딘가에는 나가야 한다.",
        ),
        el(
          "div",
          { class: "taxi__choices" },
          el(
            "button",
            {
              class: "btn btn--ghost taxi__choice",
              disabled: remaining === 0,
              onclick: () => remaining > 0 && showKnown(),
            },
            remaining > 0
              ? `지인 영업 — 잘 되지만 사람을 잃는다 (${remaining}명 남음)`
              : "지인 영업 — 더 부탁할 사람이 없다",
          ),
          el(
            "button",
            { class: "btn btn--ghost taxi__choice", onclick: () => showCold() },
            "무작위 영업 — 잘 안 되지만 아무도 잃지 않는다",
          ),
        ),
      ),
    );
  }

  showChoice();
  return container;
}
