import type { GameContext } from "./context";
import { CALL_COMPANY } from "@/data/callCenter";
import { canApplyCallCenter, joinCallCenter } from "@/systems/callCenter";
import { currentJobLabel, hasAnyJob } from "@/systems/employment";
import { el, formatNumber } from "@/utils/dom";
import { confirmPurchase } from "./confirmModal";

/**
 * 한소리고객센터 — 콜센터 상담원 채용. 네이놈에서 '콜센터'로 검색해 들어온다.
 *
 * ⚠️ 달빛운수와 같은 규칙: **수당 산식과 정신력 소모 수치를 화면에 적지 마라.**
 *    "오래 앉을수록 단가가 오르고 그만큼 지친다"는 방향만 알려준다.
 */
export function renderCallCenterSite(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const job = s.callCenterJob;

  const head = el(
    "div",
    { class: "eb-hero" },
    el("div", { class: "eb-hero__title" }, `☎️ ${CALL_COMPANY}`),
    el("p", { class: "eb-hero__sub" }, "경력 무관, 학력 무관, 오늘부터 가능합니다."),
  );

  if (job) {
    return el(
      "div",
      { class: "eb" },
      head,
      el(
        "section",
        { class: "eb-hire eb-hire--on" },
        el("div", { class: "eb-hire__title" }, `${CALL_COMPANY} 상담원`),
        el(
          "p",
          { class: "eb-hire__sub" },
          `누적 ${formatNumber(job.totalCalls)}콜 · 누적 수당 ${formatNumber(job.totalEarned)}원 · ` +
            `최다 연속 ${job.bestStreak}콜`,
        ),
        el(
          "p",
          { class: "eb-hire__sub" },
          "근무는 '현생 살기 → 일' 탭의 [상담 시작]입니다. 한 번 앉으면 원하는 만큼 받을 수 있습니다.",
        ),
      ),
    );
  }

  const other = hasAnyJob(s);
  const jobLabel = currentJobLabel(s);

  const apply = (): void => {
    let ok = false;
    ctx.update((st) => {
      ok = !!joinCallCenter(st);
    });
    if (ok) {
      ctx.toast(`☎️ ${CALL_COMPANY} 입사! '현생 살기 → 일'에서 상담하세요`);
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
      el("div", { class: "eb-hire__title" }, "상담원 상시 모집"),
      el(
        "p",
        { class: "eb-hire__sub" },
        "자격 조건은 없습니다. 콜을 받는 만큼 수당이 나가고, 오래 앉아 있을수록 단가가 올라갑니다. " +
          "다만 사람을 오래 상대하는 일이라는 건 알고 오셔야 합니다." +
          (other ? ` · 겸직은 안 되므로 입사하면 ${jobLabel}을(를) 그만두게 됩니다` : ""),
      ),
      el(
        "button",
        {
          class: "eb-hero__cta",
          disabled: !canApplyCallCenter(s),
          onclick: () => {
            if (!canApplyCallCenter(s)) return;
            if (!other) {
              apply();
              return;
            }
            confirmPurchase(ctx, {
              title: "직업 전환",
              itemName: `${jobLabel} → ${CALL_COMPANY} 상담원`,
              message:
                `콜센터는 겸직이 안 됩니다. 입사하면 ${jobLabel}을(를) 그만두게 되고, 그동안 쌓은 ` +
                "성과·근무 실적은 돌아오지 않습니다. 정말 바꾸시겠습니까?",
              confirmLabel: "직업 바꾸기",
              onConfirm: apply,
            });
          },
        },
        other ? "직업 바꾸고 입사" : "상담원 지원",
      ),
    ),
    el("p", { class: "eb-note" }, "※ 사내 상담사 심리지원 프로그램 운영 중(대기 중)"),
  );
}
