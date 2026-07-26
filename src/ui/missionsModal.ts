import type { GameContext } from "./context";
import type { MissionInstance } from "@/core/types";
import { missionDef } from "@/data/missions";
import { isMissionDone, describeMissionReward } from "@/systems/missions";
import { el } from "@/utils/dom";

/**
 * 일일/주간 도전과제 화면.
 * 진행도 누적·리셋·보상 지급은 systems/missions가 끝냈고(달성 즉시 자동 지급),
 * 여기선 현황만 보여준다 — 수동 '받기'는 없다.
 */
export function renderMissionsModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  function missionRow(inst: MissionInstance): HTMLElement | null {
    const def = missionDef(inst.id);
    if (!def) return null;
    const done = isMissionDone(inst);
    const pct = Math.min(100, Math.round((inst.progress / def.goal) * 100));
    const status = done
      ? el("span", { class: "mission-row__done" }, "✓ 완료")
      : el("span", { class: "mission-row__count" }, `${inst.progress}/${def.goal}`);
    return el(
      "div",
      { class: "mission-row" + (done ? " mission-row--claimed" : "") },
      el(
        "div",
        { class: "mission-row__main" },
        el("div", { class: "mission-row__label" }, def.label),
        el("div", { class: "mission-row__reward" }, describeMissionReward(def.reward)),
        el("div", { class: "bar" }, el("div", { class: "bar__fill", style: `width:${pct}%` })),
      ),
      status,
    );
  }

  function section(title: string, list: MissionInstance[]): HTMLElement {
    return el(
      "div",
      { class: "mission-sec" },
      el("div", { class: "mission-sec__title" }, title),
      el("div", { class: "mission-list" }, ...list.map(missionRow).filter(Boolean)),
    );
  }

  function rebuild(): void {
    const s = ctx.store.getState();
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, "📋 도전과제"),
        el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        section("오늘의 도전과제", s.missions.daily),
        section("이번 주 도전과제", s.missions.weekly),
        el(
          "p",
          { class: "compose-hint", style: "margin:14px 0 0;text-align:center" },
          "달성하면 보상이 바로 지급돼요. 일일 과제는 매일 자정, 주간 과제는 매주 갱신돼요.",
        ),
      ),
    );
  }

  rebuild();
  return container;
}
