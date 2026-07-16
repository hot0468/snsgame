import type { GameContext } from "./context";
import type { Certification } from "@/data/certifications";
import {
  EXAM_RESULT_DELAY,
  ONET_DAILY_SLOTS,
  applyExam,
  canApplyExam,
  certById,
  examPassChance,
  hasCertification,
  todaysCertifications,
} from "@/systems/certification";
import { el, formatNumber } from "@/utils/dom";
import { confirmPurchase } from "./confirmModal";

/* ============================================================
 * O넷(o-net.go.kr) — 네이놈에 '자격증'을 검색하면 열리는 관공서 사이트.
 * 워크넷/큐넷 톤(파란색 계열, 딱딱한 공공기관 레이아웃).
 * 도깨비 상점과 달리 재진입 제한이 없고, 탭을 이동하면 닫힌다.
 *
 * ⚠️ 합격 확률·오늘의 5종·응시료 판정은 전부 systems/certification이 계산한다.
 * 여기서는 호출 결과를 보여주기만 한다(규칙 재구현 금지).
 * ============================================================ */

/** 상단 장식용 GNB 메뉴 */
const GNB = ["자격정보", "시험일정", "원서접수", "합격자발표", "고객센터"];

function closeSite(ctx: GameContext): void {
  ctx.ui.onetSiteOpen = false;
  ctx.refresh();
}

/** 신청 버튼이 비활성일 때의 사유. canApplyExam은 bool만 주므로 UI가 직접 판정한다. */
function blockReason(
  s: import("@/core/types").GameState,
  cert: Certification,
): string | null {
  if (hasCertification(s, cert.id)) return "취득 완료";
  if (s.pendingExam) return "다른 시험 결과 대기 중";
  if (s.money < cert.fee) return "잔고 부족";
  return null;
}

/** 결과 대기 중인 시험 배너 */
function pendingBanner(ctx: GameContext): HTMLElement | null {
  const s = ctx.store.getState();
  const exam = s.pendingExam;
  if (!exam) return null;
  const cert = certById(exam.certId);
  if (!cert) return null; // 데이터에서 사라진 자격증(구세이브) — 조용히 숨긴다
  const left = Math.max(0, exam.resultDay - s.day);

  return el(
    "div",
    { class: "onet-pending" },
    el("span", { class: "onet-pending__tag" }, "접수완료"),
    el(
      "span",
      { class: "onet-pending__text" },
      `${cert.name} 결과 대기 중 · ` +
        (left === 0 ? "오늘 발표 예정" : `${left}일 후 통보`),
    ),
    el("span", { class: "onet-pending__note" }, "결과는 피메일로 발송됩니다"),
  );
}

/** 자격증 한 종목 카드 */
function certCard(ctx: GameContext, cert: Certification, paint: () => void): HTMLElement {
  const s = ctx.store.getState();
  const pct = Math.round(examPassChance(s, cert) * 100);
  const bonus = Math.round(cert.jobBonus * 100);
  const reason = blockReason(s, cert);
  const enabled = canApplyExam(s, cert);

  const spec = (label: string, value: string, cls = ""): HTMLElement =>
    el(
      "div",
      { class: "onet-spec" },
      el("span", { class: "onet-spec__label" }, label),
      el("span", { class: "onet-spec__val" + (cls ? ` ${cls}` : "") }, value),
    );

  return el(
    "div",
    { class: "onet-card" },
    el(
      "div",
      { class: "onet-card__head" },
      el("div", { class: "onet-card__name" }, cert.name),
      el("div", { class: "onet-card__issuer" }, cert.issuer),
    ),
    el("p", { class: "onet-card__desc" }, cert.desc),
    el(
      "div",
      { class: "onet-card__specs" },
      spec("응시료", `${formatNumber(cert.fee)}원`),
      // 확률은 systems의 examPassChance 결과를 그대로 표시한다.
      spec(
        "합격 예상",
        `${pct}%`,
        pct >= 70 ? "onet-spec__val--good" : pct <= 30 ? "onet-spec__val--bad" : "",
      ),
      spec("취업 보너스", `+${bonus}%p`, "onet-spec__val--good"),
    ),
    el(
      "div",
      { class: "onet-card__foot" },
      reason ? el("span", { class: "onet-card__reason" }, reason) : null,
      el(
        "button",
        {
          class: "onet-apply" + (enabled ? "" : " onet-apply--off"),
          disabled: !enabled,
          onclick: () => {
            if (!canApplyExam(ctx.store.getState(), cert)) return;
            confirmPurchase(ctx, {
              title: "원서접수 확인",
              itemName: cert.name,
              priceText: `${formatNumber(cert.fee)}원`,
              message:
                `응시료를 결제하고 시험에 접수합니다.\n` +
                `결과는 ${EXAM_RESULT_DELAY}일 뒤 피메일로 통보되며, ` +
                `응시료는 환불되지 않습니다.`,
              confirmLabel: "접수하기",
              onConfirm: () => {
                let ok = false;
                ctx.update((st) => {
                  ok = applyExam(st, cert);
                });
                if (!ok) {
                  ctx.toast("접수에 실패했습니다. 접수 조건을 확인해 주세요.");
                  paint();
                  return;
                }
                ctx.toast(
                  `${cert.name} 접수 완료 · ${EXAM_RESULT_DELAY}일 뒤 결과를 메일로 통보합니다`,
                );
                paint();
              },
            });
          },
        },
        "시험 신청",
      ),
    ),
  );
}

export function renderOnet(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "onet-site" });

  function paint(): void {
    const s = ctx.store.getState();
    // 오늘의 종목 선정은 systems가 결정론적으로 계산한다(재렌더해도 동일).
    // 데이터가 아직 적으면 5종 미만으로 올 수 있다 — 있는 만큼만 그린다.
    const list = todaysCertifications(s);

    container.replaceChildren(
      el(
        "div",
        { class: "onet-gov" },
        el("span", { class: "onet-gov__mark" }, "🇰🇷"),
        "이 사이트는 대한민국 공식 전자정부 누리집입니다.",
      ),
      el(
        "header",
        { class: "onet-head" },
        el(
          "div",
          { class: "onet-head__brand" },
          el("span", { class: "onet-logo" }, "O-NET"),
          el("span", { class: "onet-head__sub" }, "국가자격 종합정보망"),
        ),
        el(
          "div",
          { class: "onet-head__me" },
          el("span", {}, `보유 자격증 ${(s.certifications ?? []).length}종`),
          el("span", { class: "onet-head__money" }, `${formatNumber(s.money)}원`),
        ),
      ),
      el("nav", { class: "onet-gnb" }, ...GNB.map((m, i) =>
        el("span", { class: "onet-gnb__item" + (i === 0 ? " onet-gnb__item--on" : "") }, m),
      )),
      el(
        "div",
        { class: "onet-body" },
        el(
          "div",
          { class: "onet-notice" },
          el("span", { class: "onet-notice__tag" }, "공지"),
          `금일 원서접수 가능 종목은 ${ONET_DAILY_SLOTS}종이며, 접수 종목은 매일 갱신됩니다. ` +
            "동시 접수는 1건까지 가능합니다.",
        ),
        pendingBanner(ctx),
        el(
          "h2",
          { class: "onet-title" },
          "금일 원서접수 종목",
          el("span", { class: "onet-title__count" }, `총 ${list.length}건`),
        ),
        list.length === 0
          ? el(
              "div",
              { class: "onet-empty" },
              "금일 접수 가능한 종목이 없습니다.",
              el(
                "div",
                { class: "onet-empty__sub" },
                "보유하지 않은 종목이 등록되면 이곳에 표시됩니다.",
              ),
            )
          : el("div", { class: "onet-list" }, ...list.map((c) => certCard(ctx, c, paint))),
        el(
          "div",
          { class: "onet-foot" },
          el("div", {}, "(30128) 세종특별자치시 한누리대로 000 정부세종청사 O넷 운영지원과"),
          el("div", {}, "Copyright ⓒ O-NET. All rights reserved."),
          el(
            "button",
            { class: "onet-leave", onclick: () => closeSite(ctx) },
            "창 닫기",
          ),
        ),
      ),
    );
  }

  paint();
  return container;
}
