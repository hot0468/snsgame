import type { GameContext } from "./context";
import type { AttributeId } from "@/core/types";
import type { EbsLecture } from "@/data/ebs";
import { EBS_SITE_NAME, EBS_LECTURES } from "@/data/ebs";
import { ATTRIBUTES } from "@/data/attributes";
import { getActiveAccount } from "@/core/state";
import {
  LECTURE_COST,
  canWatchLecture,
  watchLecture,
  isFreeLectureToday,
} from "@/systems/ebs";
import { SKILL_STATS } from "@/data/stats";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";
import { confirmPurchase } from "./confirmModal";

/* ============================================================
 * 이비에듀 — 네이놈에 '듄'을 검색하면 열리는 인강 사이트(단발 오버레이).
 * 룩앤필: 클래스101+ 스타일 구독형 강의 플랫폼(썸네일 그리드·Top·크리에이터).
 * 강의를 편당 6,000원 + 행동력 8에 수강하면 스탯이 오른다(수강 확인 팝업 → 시간 1칸 소모).
 *
 * ⚠️ 수강 가능 여부·비용 차감·스탯 적용은 전부 systems/ebs가 계산한다.
 * 여기서는 canWatchLecture 결과로 버튼 상태만 그리고 watchLecture를 호출만 한다.
 * ============================================================ */

/** 상단 장식용 카테고리 칩(순수 프레임 — 필터 로직 없음). 첫 칩만 활성 강조. */
const CATEGORIES = ["전체", "IT·코딩", "글쓰기·교양", "취업·비즈니스", "뷰티·라이프", "크리에이티브"];

function closeSite(ctx: GameContext): void {
  ctx.ui.ebsSiteOpen = false;
  ctx.refresh();
}

/** 강의가 대상으로 하는 스탯의 표시 라벨. "performance"만 SKILL_STATS 밖이라 따로 처리. */
function statLabel(stat: EbsLecture["stat"]): string {
  return stat === "performance" ? "업무 성과" : SKILL_STATS[stat].label;
}

/** 비활성 사유. canWatchLecture는 상태 코드만 주므로 UI가 문구로 옮긴다. */
function reasonText(code: Exclude<ReturnType<typeof canWatchLecture>, "ok">): string {
  switch (code) {
    case "poor":
      return `소지금 부족 (${formatNumber(LECTURE_COST)}원)`;
    case "noaction":
      return "행동력 부족";
    case "nojob":
      return "재직 중에만 수강";
  }
}

/** 썸네일 그라데이션(강의 index 기반, 결정론적 — 재렌더에 안 튄다). */
function thumbStyle(i: number): string {
  const h = (i * 47) % 360;
  return `background:linear-gradient(135deg, hsl(${h} 68% 56%), hsl(${(h + 34) % 360} 66% 44%))`;
}

/**
 * 강의 카드 1개(클래스101 카드 룩).
 * @param rank 있으면 썸네일에 순위 번호를 얹는다(Top 섹션).
 */
function lectureCard(ctx: GameContext, lec: EbsLecture, i: number, rank?: number): HTMLElement {
  const s = ctx.store.getState();
  const status = canWatchLecture(s, lec);
  const enabled = status === "ok";
  const reason = enabled ? null : reasonText(status);
  const free = isFreeLectureToday(s, lec);
  // 이미 해금된 속성이면 뱃지를 숨긴다(다 연 뒤에도 계속 붙어 있으면 거짓 유인이 된다).
  const unlockable =
    lec.unlockAttr != null &&
    !getActiveAccount(s).unlockedAttributes.includes(lec.unlockAttr);

  return el(
    "div",
    { class: "eb-card" },
    el(
      "div",
      { class: "eb-card__thumb", style: thumbStyle(i) },
      rank ? el("span", { class: "eb-card__rank" }, String(rank)) : null,
      el("span", { class: "eb-card__badge" }, free ? "오늘 무료" : "이비 SELECT"),
      el("span", { class: "eb-card__thumb-title" }, lec.title),
    ),
    el(
      "div",
      { class: "eb-card__body" },
      el("div", { class: "eb-card__title" }, lec.title),
      el("div", { class: "eb-card__inst" }, `${lec.instructor} · 입문`),
      el("div", { class: "eb-card__effect" }, `🔥 ${statLabel(lec.stat)} +${lec.amount}`),
      // 아직 안 열린 속성을 여는 강의면 그걸 알려준다 — 안 그러면 어느 강의가 여는지 알 길이 없다.
      unlockable
        ? el(
            "div",
            { class: "eb-card__unlock" },
            `🔓 ${ATTRIBUTES[lec.unlockAttr!].label} 트윗 해금`,
          )
        : null,
      el(
        "div",
        { class: "eb-card__foot" },
        el(
          "span",
          { class: "eb-card__price" },
          free ? "오늘 무료 🎁" : `${formatNumber(LECTURE_COST)}원`,
        ),
        el(
          "button",
          {
            class: "eb-card__buy" + (enabled ? "" : " eb-card__buy--off"),
            disabled: !enabled,
            title: reason ?? "",
            onclick: () => {
              // 클릭 시점에 다시 검증한다(재렌더 사이에 상태가 바뀌었을 수 있다).
              if (canWatchLecture(ctx.store.getState(), lec) !== "ok") return;
              confirmPurchase(ctx, {
                title: "강의 수강",
                message: `'${lec.title}' 강의를 수강하시겠습니까? (시간 1칸 소모)`,
                confirmLabel: "수강",
                onConfirm: () => {
                  // 확인 사이에 상태가 바뀌었을 수 있어 한 번 더 검증한다.
                  if (canWatchLecture(ctx.store.getState(), lec) !== "ok") return;
                  let label = "";
                  let unlocked: AttributeId | undefined;
                  ctx.update((st) => {
                    // 시간 1칸 소모는 watchLecture(systems)가 처리한다 — 여기서 또 부르면 2칸 먹는다.
                    const res = watchLecture(st, lec);
                    if (res.ok) {
                      label = res.label;
                      unlocked = res.unlockedAttr;
                    }
                  });
                  if (label) ctx.toast(`수강 완료! ${label}`);
                  // 해금은 스탯 토스트에 묻히지 않게 따로 띄운다(도서 감상과 같은 취급).
                  if (unlocked) {
                    ctx.toast(
                      `새 트윗 소재를 얻었다! (${ATTRIBUTES[unlocked].label.replace(/계$/, "")})`,
                      "good",
                    );
                  }
                },
              });
            },
          },
          "수강",
        ),
      ),
      reason ? el("div", { class: "eb-card__reason" }, reason) : null,
    ),
  );
}

export function renderEbs(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const top = EBS_LECTURES.slice(0, 3);

  return el(
    "div",
    { class: "onet-site eb-site" },
    // 상단바: 로고 + 검색 + 소지금/닫기
    el(
      "header",
      { class: "eb-topbar" },
      el(
        "div",
        { class: "eb-brand" },
        el("span", { class: "eb-logo" }, EBS_SITE_NAME),
        el("span", { class: "eb-logo__plus" }, "+"),
        el("span", { class: "eb-brand__pill" }, "구독"),
      ),
      el(
        "div",
        { class: "eb-search" },
        icon("search", { size: 16, className: "eb-search__ico" }),
        el("span", { class: "eb-search__ph" }, "클래스, 크리에이터"),
      ),
      el(
        "div",
        { class: "eb-topbar__right" },
        el("span", { class: "eb-money" }, `${formatNumber(s.money)}원`),
        el("button", { class: "eb-close", onclick: () => closeSite(ctx) }, "✕ 닫기"),
      ),
    ),
    // 카테고리 칩(장식)
    el(
      "nav",
      { class: "eb-cats" },
      ...CATEGORIES.map((c, i) =>
        el("span", { class: "eb-cat" + (i === 0 ? " eb-cat--on" : "") }, c),
      ),
    ),
    el(
      "div",
      { class: "eb-body" },
      // 히어로 배너
      el(
        "section",
        { class: "eb-hero" },
        el("div", { class: "eb-hero__eyebrow" }, "이비 스킬업"),
        el("h1", { class: "eb-hero__title" }, "이비에듀 구독 클래스"),
        el(
          "p",
          { class: "eb-hero__sub" },
          `${EBS_LECTURES.length}개 강좌 중 골라 수강하세요. 편당 ${formatNumber(LECTURE_COST)}원 + 행동력 8 + 시간 1칸, 관련 스탯이 오릅니다. 매일 강의 한 편은 무료! (업무 성과 강의는 재직 중에만)`,
        ),
        el(
          "button",
          {
            class: "eb-hero__cta",
            onclick: () => ctx.toast("아래에서 원하는 강의를 골라 '수강'을 누르세요!"),
          },
          "수강 시작하기",
        ),
      ),
      // Top
      el("h2", { class: "eb-h2" }, "이비에듀 Top"),
      el(
        "div",
        { class: "eb-grid eb-grid--top" },
        ...top.map((lec, i) => lectureCard(ctx, lec, i, i + 1)),
      ),
      // 전체 클래스
      el(
        "h2",
        { class: "eb-h2" },
        "전체 클래스",
        el("span", { class: "eb-h2__count" }, `전체 ${EBS_LECTURES.length}강`),
      ),
      el(
        "div",
        { class: "eb-grid" },
        ...EBS_LECTURES.map((lec, i) => lectureCard(ctx, lec, i)),
      ),
      el(
        "div",
        { class: "eb-foot" },
        el("div", {}, `${EBS_SITE_NAME} · 언제 어디서나 배우는 구독형 클래스`),
        el("div", {}, `Copyright ⓒ ${EBS_SITE_NAME}. All rights reserved.`),
      ),
    ),
  );
}
