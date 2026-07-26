import type { GameContext } from "./context";
import { JOBPLANET_COMPANIES } from "@/data/jobplanet";
import { TIERS } from "@/data/jobs";
import {
  competence,
  successChance,
  writeJobplanetReview,
  payForJobplanetInfo,
  JOBPLANET_VIEW_COST,
} from "@/systems/employment";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/* ============================================================
 * 직플래닛(잡플래닛 패러디) — 브라우저 영역 오버레이 사이트.
 * 채용공고 모달의 '직플래닛' 버튼으로 진입(ui.jobplanetSiteOpen). 탭 이동 시 닫힌다.
 * 룩앤필: 잡플래닛 스타일(흰 상단바 + 초록 로고 + 큰 검색 히어로 + 기업 카드).
 * 전체 기업 디렉터리(그날 공고와 무관)를 검색·열람한다. 업체당 10만원(또는 이전 직장
 * 리뷰로 얻은 무료 열람권)으로 '합격 요건(등급 requirement)·내 역량·합격 확률'을 공개.
 *
 * ⚠️ 합격 판정·비용·열람권은 전부 systems/employment가 계산한다. 여기선 호출·표시만.
 * 검색어는 ui.jobplanetQuery(엔터/버튼 확정) — 전체 재렌더에도 값이 유지된다.
 * ============================================================ */

const JOBPLANET_NAME = "직플래닛";
/** 상단 장식 메뉴(순수 프레임 — 링크 동작 없음). */
const NAV_MENU = ["기업 리뷰", "채용 공고", "연봉", "직플위키", "커뮤니티", "멤버십"];

function closeSite(ctx: GameContext): void {
  ctx.ui.jobplanetSiteOpen = false;
  ctx.refresh();
}

export function renderJobplanet(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const myComp = competence(s);
  const credits = s.jobplanetCredits;
  const query = ctx.ui.jobplanetQuery.trim();

  const filtered = query
    ? JOBPLANET_COMPANIES.filter((c) => c.name.includes(query))
    : JOBPLANET_COMPANIES;

  // 이전 직장 리뷰 섹션(퇴사 이력이 있을 때만)
  const reviewSection =
    s.pastEmployers.length > 0
      ? el(
          "div",
          { class: "jobplanet-review" },
          el(
            "div",
            { class: "jobplanet-review__title" },
            "이전 직장 리뷰 쓰기",
            el("span", { class: "jobplanet-review__hint" }, "리뷰 1건 = 무료 열람권 1장"),
          ),
          ...s.pastEmployers.map((company) =>
            el(
              "div",
              { class: "jobplanet-review__row" },
              el("span", {}, company),
              el(
                "button",
                {
                  class: "btn btn--ghost",
                  onclick: () => {
                    ctx.update((st) => writeJobplanetReview(st, company));
                    ctx.toast(`${company} 리뷰 작성 완료! 무료 열람권 +1`);
                    ctx.refresh();
                  },
                },
                "리뷰 쓰기",
              ),
            ),
          ),
        )
      : null;

  const infoCard = (co: (typeof JOBPLANET_COMPANIES)[number]): HTMLElement => {
    const req = TIERS[co.tier].requirement;
    const opened = s.jobplanetViewed.includes(co.name);
    return el(
      "div",
      { class: "jobplanet-card" },
      // 회사명 행: 왼쪽 회사명(+열람 후 등급 배지), 오른쪽에 '정보 보기' 버튼.
      el(
        "div",
        { class: "jobplanet-card__head" },
        el(
          "span",
          { class: "jobplanet-card__name" },
          el("span", { class: "jobplanet-card__company" }, co.name),
          // 등급은 정보 보기 전엔 숨긴다(열람해야 드러남).
          opened ? el("span", { class: "jobplanet-card__tier" }, TIERS[co.tier].label) : null,
        ),
        opened
          ? null
          : el(
              "button",
              {
                class: "btn jobplanet-info__view",
                onclick: () => {
                  let ok = false;
                  ctx.update((st) => {
                    ok = payForJobplanetInfo(st);
                    if (ok && !st.jobplanetViewed.includes(co.name)) st.jobplanetViewed.push(co.name);
                  });
                  if (!ok) {
                    ctx.toast(`소지금이 부족해요 (${formatNumber(JOBPLANET_VIEW_COST)}원)`, "bad");
                    return;
                  }
                  ctx.refresh();
                },
              },
              credits > 0 ? "정보 보기 (무료)" : `정보 보기 (${formatNumber(JOBPLANET_VIEW_COST)}원)`,
            ),
      ),
      opened
        ? el(
            "div",
            { class: "jobplanet-info__revealed" },
            el(
              "div",
              {},
              `합격 필요 역량 `,
              el("b", {}, `${req} 이상`),
              ` · 내 역량 ${myComp} · 합격 확률 `,
              el("b", {}, `${Math.round(successChance(s, co.tier) * 100)}%`),
            ),
            el("div", { class: "jobplanet-info__stats" }, "핵심 스탯: 어휘력 · 친화력 · 미용"),
          )
        : null,
    );
  };

  const runSearch = (v: string): void => {
    ctx.ui.jobplanetQuery = v.trim();
    ctx.refresh();
  };

  return el(
    "div",
    { class: "jp-site" },
    // 상단바(흰 배경 + 초록 로고 + 장식 메뉴)
    el(
      "header",
      { class: "jp-nav" },
      el("span", { class: "jp-logo" }, JOBPLANET_NAME),
      el("nav", { class: "jp-menu" }, ...NAV_MENU.map((m) => el("span", { class: "jp-menu__item" }, m))),
      el(
        "span",
        { class: "jp-nav__right" },
        el("span", { class: "jp-credits" }, `무료 열람권 ${credits}장`),
        el("span", { class: "jp-money" }, `${formatNumber(s.money)}원`),
        el("button", { class: "jp-close", onclick: () => closeSite(ctx) }, "✕ 닫기"),
      ),
    ),
    // 히어로 + 검색
    el(
      "section",
      { class: "jp-hero" },
      el("h1", { class: "jp-hero__title" }, "어떤 회사가 궁금하신가요?"),
      el(
        "div",
        { class: "jp-search" },
        el("input", {
          class: "jp-search__input",
          value: ctx.ui.jobplanetQuery,
          placeholder: "회사명을 검색해 보세요 (엔터)",
          spellcheck: "false",
          onkeydown: (e: Event) => {
            if ((e as KeyboardEvent).key === "Enter") runSearch((e.target as HTMLInputElement).value);
          },
        }),
        el(
          "button",
          {
            class: "jp-search__btn",
            onclick: (e: Event) => {
              const input = (e.currentTarget as HTMLElement)
                .previousElementSibling as HTMLInputElement | null;
              runSearch(input?.value ?? "");
            },
          },
          icon("search", { size: 18 }),
        ),
      ),
    ),
    el(
      "div",
      { class: "jobplanet-body" },
      el(
        "p",
        { class: "jobplanet-intro" },
        `기업정보를 열람하면 합격 요건과 내 합격 확률을 볼 수 있어요. 1건당 ${formatNumber(JOBPLANET_VIEW_COST)}원, 이전 직장 리뷰를 쓰면 1건 무료.`,
      ),
      reviewSection,
      el(
        "h2",
        { class: "jobplanet-h2" },
        query ? `'${query}' 검색 결과` : "전체 기업",
        el("span", { class: "jobplanet-h2__count" }, `${filtered.length}곳`),
        query
          ? el("button", { class: "jp-clear", onclick: () => runSearch("") }, "검색 초기화")
          : null,
      ),
      filtered.length === 0
        ? el("div", { class: "jp-empty" }, "검색 결과가 없어요. 회사명을 다시 확인해 주세요.")
        : el("div", { class: "jobplanet-list" }, ...filtered.map(infoCard)),
    ),
  );
}
