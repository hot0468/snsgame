import type { GameContext } from "./context";
import { el } from "@/utils/dom";
import {
  HOSPITAL_DEPARTMENTS,
  HOSPITAL_GREETING,
  HOSPITAL_HOURS,
  HOSPITAL_NAME,
  HOSPITAL_NOTICE,
  HOSPITAL_TAGLINE,
} from "@/data/hospital";
import { requestAppointment } from "@/systems/killer";

/**
 * 세이신내과의원 사이트 — 네이놈에 '내과'/'순환기내과'를 검색하면 열린다.
 * 겉모습은 끝까지 평범한 동네 병원이고, [진료예약]이 킬러 진입로다(전연령판 momo.com).
 * 성인모드 게이트가 **없다**는 게 momo와의 차이 — 그래서 전연령 경로다.
 */
export function renderHospital(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const isKiller = !!s.killerJob?.active;

  const departments = el(
    "div",
    { class: "hosp-grid" },
    ...HOSPITAL_DEPARTMENTS.map((d) =>
      el(
        "div",
        { class: "hosp-dept" },
        el("div", { class: "hosp-dept__name" }, d.name),
        el("div", { class: "hosp-dept__desc" }, d.desc),
      ),
    ),
  );

  const hours = el(
    "div",
    { class: "hosp-hours" },
    ...HOSPITAL_HOURS.map((h) =>
      el(
        "div",
        { class: "hosp-hours__row" },
        el("span", { class: "hosp-hours__day" }, h.day),
        el("span", { class: "hosp-hours__time" }, h.time),
      ),
    ),
  );

  return el(
    "div",
    { class: "hosp-site" },
    el(
      "div",
      { class: "hosp-head" },
      el("span", { class: "hosp-logo" }, HOSPITAL_NAME),
      el("span", { class: "hosp-tag" }, HOSPITAL_TAGLINE),
    ),
    el("div", { class: "hosp-greeting" }, HOSPITAL_GREETING),
    el("div", { class: "hosp-section-title" }, "진료과목"),
    departments,
    el("div", { class: "hosp-section-title" }, "진료시간"),
    hours,
    el(
      "div",
      { class: "hosp-foot" },
      el(
        "button",
        {
          class: "hosp-reserve",
          onclick: () => {
            ctx.update((st) => requestAppointment(st));
            ctx.toast(
              isKiller ? "예약을 남겼다. 쪽지를 확인해보자." : "진료를 예약했다. 쪽지를 확인해보자.",
            );
          },
        },
        "🩺 진료예약",
      ),
      el("div", { class: "hosp-foot__notice" }, HOSPITAL_NOTICE),
    ),
  );
}
