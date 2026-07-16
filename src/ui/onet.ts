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
  isSpecialCert,
  pendingExams,
  specialCertificationToday,
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

/**
 * 신청 버튼이 비활성일 때의 사유. canApplyExam은 bool만 주므로 사유는 UI가 문구로 옮긴다.
 *
 * ⚠️ **첫 줄의 canApplyExam 가드가 이 함수의 핵심이다.** 신청 가능한 카드에는 어떤 사유도
 *    붙지 않음을 구조적으로 보장한다 — 예전엔 사유 판정이 enabled와 독립이라, 일반 시험
 *    대기 중에 특별칸이 뜨면 버튼은 멀쩡히 활성인데 "다른 시험 결과 대기 중" 문구가 같이
 *    떠서 서로 모순됐다. 활성 여부의 단일 진실은 canApplyExam 하나다.
 *
 * ⚠️ 대기 슬롯은 일반/특별이 따로다. 어느 슬롯이 이 카드를 막는지는 systems의 isSpecialCert로
 *    가른다(UI에서 cert.onlyOn·randomChance를 직접 보고 재구현하지 않는다).
 *    막은 시험의 '이름'까지 보여준다 — 특별칸(헌터·연금술사)은 기회가 드물어서, 왜 죽었는지
 *    모르면 플레이어가 이유도 모른 채 기회를 잃는다.
 */
export function blockReason(
  s: import("@/core/types").GameState,
  cert: Certification,
): string | null {
  if (canApplyExam(s, cert)) return null; // 신청 가능 → 사유 없음(모순 표기 원천 차단)
  if (hasCertification(s, cert.id)) return "취득 완료";

  const blocking = isSpecialCert(cert) ? s.pendingSpecialExam : s.pendingExam;
  if (blocking) {
    const name = certById(blocking.certId)?.name;
    return name ? `${name} 결과 대기 중` : "다른 시험 결과 대기 중";
  }
  if (s.money < cert.fee) return "잔고 부족";
  return null; // 그 외(게임 오버 등) — 버튼만 비활성으로 두고 사유는 붙이지 않는다
}

/**
 * 결과 대기 중인 시험 배너들.
 *
 * ⚠️ 일반 슬롯과 특별 슬롯은 **동시에 각 1건씩** 찰 수 있다(pendingExam + pendingSpecialExam).
 *    하나만 그리면 나머지 시험이 유령이 된다 — 접수했는데 어디에도 안 보인다.
 *    두 슬롯 조회는 systems의 pendingExams가 담당한다(UI에서 슬롯을 직접 나열하지 않는다).
 */
export function pendingBanners(ctx: GameContext): HTMLElement[] {
  const s = ctx.store.getState();

  return pendingExams(s).flatMap((exam) => {
    const cert = certById(exam.certId);
    if (!cert) return []; // 데이터에서 사라진 자격증(구세이브) — 조용히 숨긴다
    const left = Math.max(0, exam.resultDay - s.day);

    return [
      el(
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
      ),
    ];
  });
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

/**
 * 금일 특별 시행 종목(onlyOn·randomChance) 섹션.
 * 랜덤 5종과 **별개**이며 목록 위에 고정된다 — 5칸을 잡아먹지 않는다.
 * 오늘 해당하지 않거나 이미 취득했으면 systems가 null을 주고, 섹션은 통째로 사라진다.
 *
 * ⚠️ 특별칸에는 성격이 다른 두 종류가 온다. 문구를 하드코딩하지 말고 분기한다.
 *  - onlyOn(헌터): 매년 고정일 1회 → "연 1회 / 차회 시행 내년"이 사실이다.
 *  - randomChance(국가연금술사): 부정기 등장이라 다음 시행일을 알 수 없다
 *    → "연 1회 / 내년"이라고 하면 거짓말이 된다. "부정기 / 차회 시행 미정"으로 쓴다.
 * 두 종류 다 '금일에 한해 접수'라는 점은 같아서 태그("금일 특별 시행")는 공용으로 둔다.
 */
function specialSection(
  ctx: GameContext,
  cert: Certification,
  paint: () => void,
): HTMLElement {
  const annual = !!cert.onlyOn;
  return el(
    "section",
    { class: "onet-special" },
    el(
      "div",
      { class: "onet-special__banner" },
      el("span", { class: "onet-special__tag" }, "금일 특별 시행"),
      el(
        "span",
        { class: "onet-special__text" },
        annual
          ? `${cert.name} 국가자격 시험은 연 1회, 금일에 한해 원서를 접수합니다.`
          : `${cert.name} 국가자격 시험은 부정기 시행 종목으로, 금일에 한해 원서를 접수합니다.`,
      ),
      el(
        "span",
        { class: "onet-special__note" },
        annual ? "금일 24시 마감 · 차회 시행 내년" : "금일 24시 마감 · 차회 시행 미정",
      ),
    ),
    el("div", { class: "onet-special__list" }, certCard(ctx, cert, paint)),
  );
}

export function renderOnet(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "onet-site" });

  function paint(): void {
    const s = ctx.store.getState();
    // 오늘의 종목 선정은 systems가 결정론적으로 계산한다(재렌더해도 동일).
    // 데이터가 아직 적으면 5종 미만으로 올 수 있다 — 있는 만큼만 그린다.
    const list = todaysCertifications(s);
    // 특별 시행 종목(헌터 등)은 5종과 별도로 온다. 없는 날이 대부분이라 null이 기본이다.
    const special = specialCertificationToday(s);

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
        // 일반·특별 대기 배너를 둘 다(각 슬롯 1건씩 동시에 찰 수 있다).
        ...pendingBanners(ctx),
        // 특별 시행은 랜덤 5종 '위에' 고정 노출한다.
        special ? specialSection(ctx, special, paint) : null,
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
