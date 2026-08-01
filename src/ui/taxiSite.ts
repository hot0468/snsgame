import type { GameContext } from "./context";
import {
  TAXI_BASE_FARE,
  TAXI_COMPANY,
  TAXI_DELUXE_CERT,
  TAXI_REQ_CERT,
} from "@/data/taxi";
import { certById } from "@/systems/certification";
import {
  canApplyTaxi,
  hasTaxiLicense,
  isDeluxeTaxi,
  joinTaxi,
  ratingLabel,
} from "@/systems/taxi";
import { currentJobLabel, hasAnyJob } from "@/systems/employment";
import { el, formatNumber } from "@/utils/dom";
import { confirmPurchase } from "./confirmModal";

/**
 * 달빛운수 — 택시 기사 채용 사이트. 네이놈에서 '택시'로 검색해 들어온다(O넷·EBS와 같은 오버레이).
 *
 * ⚠️ **요금 산식과 심야 할증 배율을 화면에 숫자로 적지 마라.** 채용 공고가 자기네 급여
 *    계산식을 공개하는 일은 없고, 게임이 계산기가 된다(이비에듀 강사 공고와 같은 원칙).
 *    "심야가 더 번다"는 방향만 알려주고 정확한 배율은 굴려보며 알게 한다.
 */
export function renderTaxiSite(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const job = s.taxiJob;
  const licensed = hasTaxiLicense(s);
  const reqName = certById(TAXI_REQ_CERT)?.name ?? "1종 보통 운전면허";
  const deluxeName = certById(TAXI_DELUXE_CERT)?.name ?? "1종 대형 운전면허";

  const head = el(
    "div",
    { class: "eb-hero" },
    el("div", { class: "eb-hero__title" }, `🚕 ${TAXI_COMPANY}`),
    el(
      "p",
      { class: "eb-hero__sub" },
      "밤이든 낮이든, 핸들을 잡는 만큼 가져갑니다.",
    ),
  );

  // 이미 기사면 사원증 형태로 현황만 보여준다.
  if (job) {
    return el(
      "div",
      { class: "eb" },
      head,
      el(
        "section",
        { class: "eb-hire eb-hire--on" },
        el("div", { class: "eb-hire__title" }, `${TAXI_COMPANY} 소속 기사`),
        el(
          "p",
          { class: "eb-hire__sub" },
          `${ratingLabel(job.rating)} · 누적 ${formatNumber(job.totalRides)}회 운행 · ` +
            `누적 수입 ${formatNumber(job.totalEarned)}원` +
            (isDeluxeTaxi(s) ? " · 모범택시" : ""),
        ),
        el(
          "p",
          { class: "eb-hire__sub" },
          "운행은 '현생 살기 → 일' 탭의 [운행하기]로 나갑니다. 시간대는 자유고, 심야가 더 법니다.",
        ),
      ),
    );
  }

  const other = hasAnyJob(s);
  const jobLabel = currentJobLabel(s);

  const apply = (): void => {
    let ok = false;
    ctx.update((st) => {
      ok = !!joinTaxi(st);
    });
    if (ok) {
      ctx.toast(`🚕 ${TAXI_COMPANY} 입사! '현생 살기 → 일'에서 운행하세요`);
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
      el("div", { class: "eb-hire__title" }, "기사 모집"),
      el(
        "p",
        { class: "eb-hire__sub" },
        licensed
          ? `면허 확인됐습니다. 사납금 없습니다 — 대신 고정급도 없습니다. 운행 요금이 그날 그날 들어옵니다.` +
            (isDeluxeTaxi(s)
              ? ` ${deluxeName}가 있으시니 모범택시로 배차됩니다.`
              : ` ${deluxeName}까지 있으면 모범택시로 올려드립니다.`) +
            (other ? ` · 겸직은 안 되므로 입사하면 ${jobLabel}을(를) 그만두게 됩니다` : "")
          : `${reqName}가 있어야 지원할 수 있습니다. 자격증은 O넷에서 딸 수 있습니다.`,
      ),
      el(
        "button",
        {
          class: "eb-hero__cta",
          disabled: !canApplyTaxi(s),
          onclick: () => {
            if (!canApplyTaxi(s)) return;
            if (!other) {
              apply();
              return;
            }
            // 겸직 불가라 기존 직업이 해지된다 — 되돌릴 수 없으니 반드시 물어본다.
            confirmPurchase(ctx, {
              title: "직업 전환",
              itemName: `${jobLabel} → ${TAXI_COMPANY} 기사`,
              message:
                `택시는 겸직이 안 됩니다. 입사하면 ${jobLabel}을(를) 그만두게 되고, 그동안 쌓은 ` +
                "성과·근무 실적은 돌아오지 않습니다. 정말 바꾸시겠습니까?",
              confirmLabel: "직업 바꾸기",
              onConfirm: apply,
            });
          },
        },
        licensed ? (other ? "직업 바꾸고 입사" : "기사 지원") : `${reqName} 필요`,
      ),
    ),
    el(
      "p",
      { class: "eb-note" },
      `기본 요금 ${formatNumber(TAXI_BASE_FARE)}원부터. 손님 평이 좋을수록 좋은 콜이 붙습니다.`,
    ),
  );
}
