import type { GameContext } from "./context";
import type { MissionInstance } from "@/core/types";
import { missionDef, type MissionReward } from "@/data/missions";
import { claimMission, isMissionDone } from "@/systems/missions";
import { SKILL_STATS } from "@/data/stats";
import { formatNumber, el } from "@/utils/dom";

/**
 * 일일/주간 도전과제 화면.
 * 진행도 누적·리셋은 systems/missions가 끝냈고(state.missions), 여기선 현황 표시 + 보상 받기만 한다.
 */
export function renderMissionsModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  /** 보상을 사람이 읽는 문구로 */
  function rewardText(r: MissionReward): string {
    const parts: string[] = [];
    if (r.money) parts.push(`💰 ${formatNumber(r.money)}원`);
    if (r.action) parts.push(`⚡ 행동력 +${r.action}`);
    if (r.mental) parts.push(`🧠 정신력 +${r.mental}`);
    if (r.followers) parts.push(`👥 팔로워 +${formatNumber(r.followers)}`);
    if (r.skills) {
      for (const [k, v] of Object.entries(r.skills)) {
        parts.push(`📈 ${SKILL_STATS[k as keyof typeof SKILL_STATS].label} +${v}`);
      }
    }
    return parts.join(" · ");
  }

  function missionRow(inst: MissionInstance): HTMLElement | null {
    const def = missionDef(inst.id);
    if (!def) return null;
    const done = isMissionDone(inst);
    const pct = Math.min(100, Math.round((inst.progress / def.goal) * 100));
    const claimBtn = inst.claimed
      ? el("span", { class: "mission-row__done" }, "✓ 완료")
      : el(
          "button",
          {
            class: "btn mission-row__btn" + (done ? "" : " btn--ghost"),
            disabled: !done,
            onclick: () => {
              let r: MissionReward | null = null;
              ctx.update((s) => {
                r = claimMission(s, inst.id);
              });
              if (r) ctx.toast(`도전과제 완료! ${rewardText(r)}`, "good");
              rebuild();
            },
          },
          done ? "받기" : `${inst.progress}/${def.goal}`,
        );
    return el(
      "div",
      { class: "mission-row" + (inst.claimed ? " mission-row--claimed" : "") },
      el(
        "div",
        { class: "mission-row__main" },
        el("div", { class: "mission-row__label" }, def.label),
        el("div", { class: "mission-row__reward" }, rewardText(def.reward)),
        el("div", { class: "bar" }, el("div", { class: "bar__fill", style: `width:${pct}%` })),
      ),
      claimBtn,
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
          "일일 과제는 매일 자정, 주간 과제는 매주 새로 갱신돼요.",
        ),
      ),
    );
  }

  rebuild();
  return container;
}
