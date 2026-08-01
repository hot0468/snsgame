import type { GameContext } from "./context";
import { INSURANCE_BASE_SALARY, INSURANCE_COMPANY } from "@/data/insurance";
import { canApplyInsurance, joinInsurance } from "@/systems/insurance";
import { currentJobLabel, hasAnyJob } from "@/systems/employment";
import { el, formatNumber } from "@/utils/dom";
import { confirmPurchase } from "./confirmModal";

/**
 * 한소리고객센터 — 보험설계사 채용. 네이놈에서 '콜센터'로 검색해 들어온다.
 *
 * ⚠️ 달빛운수와 같은 규칙: **수당 산식과 정신력 소모 수치를 화면에 적지 마라.**
 *    "오래 앉을수록 단가가 오르고 그만큼 지친다"는 방향만 알려준다.
 */
export function renderInsuranceSite(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const job = s.insuranceJob;

  const head = el(
    "div",
    { class: "eb-hero" },
    el("div", { class: "eb-hero__title" }, `📋 ${INSURANCE_COMPANY}`),
    el("p", { class: "eb-hero__sub" }, "사람을 만나는 일입니다. 아는 사람부터요."),
  );

  if (job) {
    return el(
      "div",
      { class: "eb" },
      head,
      el(
        "section",
        { class: "eb-hire eb-hire--on" },
        el("div", { class: "eb-hire__title" }, `${INSURANCE_COMPANY} 설계사`),
        el(
          "p",
          { class: "eb-hire__sub" },
          `계약 ${formatNumber(job.contracts)}건 · 누적 수당 ${formatNumber(job.totalCommission)}원 · ` +
            `연락 끊긴 지인 ${job.burnedContacts.length}명`,
        ),
        el(
          "p",
          { class: "eb-hire__sub" },
          "평일 낮이 되면 자동으로 출근합니다. 그 자리에서 오늘 어디를 돌지 고르시면 됩니다.",
        ),
      ),
    );
  }

  const other = hasAnyJob(s);
  const jobLabel = currentJobLabel(s);

  const apply = (): void => {
    let ok = false;
    ctx.update((st) => {
      ok = !!joinInsurance(st);
    });
    if (ok) {
      ctx.toast(`📋 ${INSURANCE_COMPANY} 입사! '현생 살기 → 일'에서 상담하세요`);
      ctx.refresh();
    } else {
      ctx.toast("지금은 입사할 수 없습니다");
    }
  };

  return el(
    "div",
    { class: "eb" },
    head,
    el(
      "section",
      { class: "eb-hire" },
      el("div", { class: "eb-hire__title" }, "설계사 모집"),
      el(
        "p",
        { class: "eb-hire__sub" },
        `기본급 ${formatNumber(INSURANCE_BASE_SALARY)}원에 계약 수당이 따로 붙습니다. 평일 낮은 출근하셔야 합니다. ` +
          "영업은 두 가지입니다 — 아는 분께 부탁드리거나, 모르는 분께 말을 걸거나." +
          (other ? ` · 겸직은 안 되므로 입사하면 ${jobLabel}을(를) 그만두게 됩니다` : ""),
      ),
      el(
        "button",
        {
          class: "eb-hero__cta",
          disabled: !canApplyInsurance(s),
          onclick: () => {
            if (!canApplyInsurance(s)) return;
            if (!other) {
              apply();
              return;
            }
            confirmPurchase(ctx, {
              title: "직업 전환",
              itemName: `${jobLabel} → ${INSURANCE_COMPANY} 설계사`,
              message:
                `콜센터는 겸직이 안 됩니다. 입사하면 ${jobLabel}을(를) 그만두게 되고, 그동안 쌓은 ` +
                "성과·근무 실적은 돌아오지 않습니다. 정말 바꾸시겠습니까?",
              confirmLabel: "직업 바꾸기",
              onConfirm: apply,
            });
          },
        },
        other ? "직업 바꾸고 입사" : "설계사 지원",
      ),
    ),
    el("p", { class: "eb-note" }, "※ 사내 상담사 심리지원 프로그램 운영 중(대기 중)"),
  );
}
