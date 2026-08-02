import type { GameContext } from "./context";
import {
  COACH_STAT_TARGET,
  COACH_TRAIN_ACTION_COST,
  MEET_LABEL,
  MEET_MONTHS,
  SCHOOL_NAME,
  coachSalaryOf,
  doCoachTraining,
  meetResultFor,
  teamStrength,
} from "@/systems/coach";
import { advanceTime } from "@/systems/time";
import { el, formatNumber } from "@/utils/dom";
import { COACH_FIRED_TEXT, type CoachIncident } from "@/data/coachIncidents";
import { simpleResultModal } from "./sns/snsPages";
import { icon } from "./icons";

/**
 * 배구부 훈련 모달 — 평일 낮에 강제로 뜬다(회사 근무 모달과 같은 자리).
 *
 * 두 선택지의 축은 **팀이 느느냐 코치가 버티느냐**다:
 * - 훈련: 시즌 훈련 +1(대회 성적으로 직결) · 행동력·정신력 소모
 * - 자율: 팀은 그대로 · 정신력 회복
 * ⚠️ 자율 훈련에 벌점을 주지 마라. 이건 '딴짓'이 아니라 코치가 쉬어가는 날이다 —
 *    안 하면 성적이 안 나온다는 것 자체가 이미 충분한 대가다.
 */
export function renderCoachModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const job = s.coachJob!;
  const strength = teamStrength(s);

  const act = (mode: "drill" | "easy") => () => {
    let msg = "";
    let incident: CoachIncident | null = null;
    let fired = false;
    ctx.update((st) => {
      const r = doCoachTraining(st, mode);
      if (r) {
        const delta = r.gained > 0 ? ` +${r.gained}` : "";
        msg = `${r.message} (완성도${delta} → ${r.strength}/${r.target})`;
        incident = r.incident ?? null;
        fired = !!r.fired;
      }
      advanceTime(st, 1); // 시간 소모는 여기서 — systems는 카운트만 만진다
    });
    ctx.closeModal();
    // 사건은 토스트로 흘리면 안 된다 — 위로금 수백만원이 빠지고 해직까지 갈 수 있는 일이다.
    if (incident) {
      const inc = incident as CoachIncident;
      const body =
        `${inc.text}\n\n` +
        `위로금 -${formatNumber(inc.compensation)}원 · 평판 -${inc.reputationLoss} · ` +
        `팀 완성도 -${inc.teamStatLoss}` +
        (fired ? `\n\n${COACH_FIRED_TEXT}` : "");
      ctx.openModal(() =>
        simpleResultModal(ctx, fired ? `${inc.title} — 그리고 해직` : inc.title, body),
      );
      return;
    }
    if (msg) ctx.toast(msg);
  };

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("walk", { size: 18 }), `${SCHOOL_NAME} 배구부`),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { style: "font-size:15px;line-height:1.6;margin:0 0 6px" },
        `체육관에 나왔다. 오늘 훈련을 어떻게 굴릴까?`,
      ),
      el(
        "p",
        { class: "compose-hint", style: "margin:0 0 14px" },
        `팀 완성도 ${strength}/${COACH_STAT_TARGET} (지금이면 ${MEET_LABEL[meetResultFor(strength, false)]}) · ` +
          `누적 훈련 ${job.totalTrainings}회 · 월급 ${formatNumber(coachSalaryOf(s))}원 (20일)`,
      ),
      el(
        "p",
        { class: "compose-hint", style: "margin:0 0 14px" },
        `대회는 ${MEET_MONTHS.join("·")}월 15일. 10월이 전국체전이다. 완성도가 높을수록 성적이 좋다.`,
      ),
      el(
        "div",
        { class: "compose-actions", style: "gap:10px" },
        el("button", { class: "btn btn--ghost", onclick: act("easy") }, "자율 훈련 (정신력 회복)"),
        el(
          "button",
          { class: "btn", onclick: act("drill") },
          `훈련 지도 (행동력 ${COACH_TRAIN_ACTION_COST})`,
        ),
      ),
    ),
  );
}
