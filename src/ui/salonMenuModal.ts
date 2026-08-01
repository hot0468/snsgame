import type { GameContext } from "./context";
import type { CutStyle } from "@/data/stylist";
import {
  SALON_NAME,
  STYLIST_ACTION_COST,
  STYLIST_REQ_CERT,
} from "@/data/stylist";
import {
  bookingCount,
  canApplyStylist,
  cutChance,
  doCut,
  estimateFee,
  hasStylistLicense,
  joinStylist,
  rollCustomer,
  stylesFor,
} from "@/systems/stylist";
import { certById } from "@/systems/certification";
import { currentJobLabel, hasAnyJob } from "@/systems/employment";
import { canVisitSalon, SALON_ACTION, SALON_COST } from "@/systems/hairSalon";
import { clampAction, hasAction } from "@/systems/stats";
import { advanceTime } from "@/systems/time";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";
import { confirmPurchase } from "./confirmModal";
import { renderHairSalonModal } from "./hairSalonModal";

/**
 * 미용실 입구 — "무엇을 할까?"
 *
 * 미용실은 원래 **시술받는 곳**이었다. 여기에 **일하는 쪽**을 나란히 둔다 —
 * 헤어디자이너 채용을 별도 사이트로 빼지 않고 가게 안에 넣는 게 자연스럽다.
 *
 * 세 갈래:
 *  - **시술받기**: 기존 미니게임(`renderHairSalonModal`). 손님으로 가는 길.
 *  - **디자이너 지원**: 미용사(일반) 자격증이 있으면 취업.
 *  - **손님 받기**: 이미 디자이너면 한 타임 근무.
 */
export function renderSalonMenuModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  const head = (title: string): HTMLElement =>
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("walk", { size: 18 }), title),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    );

  /* ─────────── 근무: 한 타임 손님 받기 ─────────── */

  /** 예약 손님을 차례로 받는다. 예약 수는 팔로워가 정한다. */
  function work(): void {
    const s0 = ctx.store.getState();
    const total = bookingCount(s0);
    let done = 0;
    let earned = 0;

    // 한 타임 비용(행동력 + 시간)은 자리에 서는 순간 한 번만.
    ctx.update((st) => {
      st.resources.action = clampAction(st, st.resources.action - STYLIST_ACTION_COST);
      advanceTime(st, 1);
    });

    const finish = (): void => {
      container.replaceChildren(
        head("영업 종료"),
        el(
          "div",
          { class: "modal__body" },
          el(
            "p",
            { class: "taxi__result" },
            done === 0
              ? "예약이 하나도 없었다. 거울만 닦다 하루가 갔다."
              : `오늘 ${done}명을 받았다. 가위를 내려놓으니 손목이 뻐근했다.`,
          ),
          el(
            "div",
            { class: "taxi__payout" },
            el("span", { class: "taxi__fare" }, `+${formatNumber(earned)}원`),
            el(
              "span",
              { class: "taxi__rating" },
              `단골 ${ctx.store.getState().stylistJob?.regulars ?? 0}명`,
            ),
          ),
          el(
            "div",
            { class: "compose-actions" },
            el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
          ),
        ),
      );
    };

    const nextCustomer = (): void => {
      if (done >= total) {
        finish();
        return;
      }
      const s = ctx.store.getState();
      const customer = rollCustomer();
      const styles = stylesFor(customer);

      const apply = (style: CutStyle): void => {
        let line = "";
        let fee = 0;
        ctx.update((st) => {
          const r = doCut(st, style);
          if (r) {
            line = r.line;
            fee = r.fee;
          }
        });
        done += 1;
        earned += fee;
        container.replaceChildren(
          head(`${done}/${total}번째 손님`),
          el(
            "div",
            { class: "modal__body" },
            el("p", { class: "taxi__result" }, line),
            el(
              "div",
              { class: "taxi__payout" },
              el("span", { class: "taxi__fare" }, `+${formatNumber(fee)}원`),
            ),
            el(
              "div",
              { class: "compose-actions" },
              el(
                "button",
                { class: "btn", onclick: () => nextCustomer() },
                done >= total ? "정리하고 마무리" : "다음 손님",
              ),
            ),
          ),
        );
      };

      container.replaceChildren(
        head(`${done + 1}/${total}번째 손님`),
        el(
          "div",
          { class: "modal__body" },
          el("p", { class: "taxi__scene" }, customer.text),
          el(
            "div",
            { class: "taxi__choices" },
            ...styles.map((st) =>
              el(
                "button",
                { class: "btn btn--ghost taxi__choice", onclick: () => apply(st) },
                el("span", { class: "ins__name" }, st.label),
                el(
                  "span",
                  { class: "ins__odds" },
                  cutChance(s, st) >= 0.8 ? "무난하다" : cutChance(s, st) >= 0.55 ? "해볼 만하다" : "위험하다",
                ),
                el("span", { class: "ins__aff" }, `${formatNumber(estimateFee(s, st))}원`),
              ),
            ),
          ),
        ),
      );
    };

    nextCustomer();
  }

  /* ─────────── 입구 메뉴 ─────────── */

  function showMenu(): void {
    const s = ctx.store.getState();
    const employed = s.stylistJob != null;
    const licensed = hasStylistLicense(s);
    const reqName = certById(STYLIST_REQ_CERT)?.name ?? "미용사(일반)";
    const other = hasAnyJob(s);
    const jobLabel = currentJobLabel(s);

    const hire = (): void => {
      let ok = false;
      ctx.update((st) => {
        ok = !!joinStylist(st);
      });
      if (ok) {
        ctx.toast(`✂️ ${SALON_NAME} 입사! 미용실에서 손님을 받으세요`);
        showMenu();
      } else {
        ctx.toast("지금은 지원할 수 없습니다");
      }
    };

    container.replaceChildren(
      head(`✂️ ${SALON_NAME}`),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { class: "compose-hint", style: "margin-top:0" },
          employed
            ? `${SALON_NAME} 디자이너 · 단골 ${s.stylistJob!.regulars}명 · 오늘 예약 ${bookingCount(s)}건`
            : "문을 열자 드라이기 소리와 파마약 냄새가 섞여 들어왔다.",
        ),
        el(
          "div",
          { class: "taxi__choices" },
          // ① 근무 — 디자이너일 때만
          employed
            ? el(
                "button",
                {
                  class: "btn taxi__choice",
                  disabled: !hasAction(s, STYLIST_ACTION_COST),
                  onclick: () => hasAction(s, STYLIST_ACTION_COST) && work(),
                },
                hasAction(s, STYLIST_ACTION_COST)
                  ? `손님 받기 — 오늘 예약 ${bookingCount(s)}건 (행동력 ${STYLIST_ACTION_COST})`
                  : "손님 받기 — 행동력 부족",
              )
            : null,
          // ② 지원 — 아직 디자이너가 아닐 때만
          employed
            ? null
            : el(
                "button",
                {
                  class: "btn btn--ghost taxi__choice",
                  disabled: !canApplyStylist(s),
                  onclick: () => {
                    if (!canApplyStylist(s)) return;
                    if (!other) {
                      hire();
                      return;
                    }
                    confirmPurchase(ctx, {
                      title: "직업 전환",
                      itemName: `${jobLabel} → ${SALON_NAME} 디자이너`,
                      message:
                        `디자이너는 겸직이 안 됩니다. 지원하면 ${jobLabel}을(를) 그만두게 되고, ` +
                        "그동안 쌓은 성과·근무 실적은 돌아오지 않습니다. 정말 바꾸시겠습니까?",
                      confirmLabel: "직업 바꾸기",
                      onConfirm: hire,
                    });
                  },
                },
                licensed ? "디자이너 지원 — 팔로워가 곧 손님이다" : `디자이너 지원 — ${reqName} 필요`,
              ),
          // ③ 시술받기 — 언제나
          el(
            "button",
            {
              class: "btn btn--ghost taxi__choice",
              disabled: !canVisitSalon(s),
              onclick: () => canVisitSalon(s) && ctx.openModal(renderHairSalonModal),
            },
            canVisitSalon(s)
              ? `시술받기 — ${formatNumber(SALON_COST)}원 · 행동력 ${SALON_ACTION}`
              : "시술받기 — 소지금 또는 행동력 부족",
          ),
        ),
      ),
    );
  }

  showMenu();
  return container;
}
