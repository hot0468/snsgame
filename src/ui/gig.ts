import type { GameContext } from "./context";
import type { ActiveGig, GameState, SkillStatId } from "@/core/types";
import type { GigJob } from "@/data/gig";
import { GIG_SITE_NAME, GIG_JOBS } from "@/data/gig";
import {
  jobById,
  isGigActive,
  canAcceptGig,
  acceptGig,
  canWorkGig,
  workGig,
} from "@/systems/gig";
import { SKILL_STATS } from "@/data/stats";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/* ============================================================
 * 재능마켓(끄몽 패러디) — 네이놈에 '외주'를 검색하면 열리는 프리랜서 외주 사이트.
 * 룩앤필: 크몽(kmong) 랜딩 스타일 — 코랄 브랜드 · 원형 카테고리 아이콘 · 썸네일 서비스 카드.
 * CSS는 styles/main.css의 `.km-*` 블록.
 *
 * ⚠️ 진행량 계산·수주/작업/마감 판정은 전부 systems/gig가 한다.
 * 여기서는 canAcceptGig/canWorkGig 결과로 버튼 상태만 그리고 acceptGig/workGig를 호출만 한다.
 * ============================================================ */

/** 스탯별 카드 썸네일 이모지·그라데이션(장식). 없는 스탯은 코랄 폴백. */
const STAT_META: Partial<Record<SkillStatId, { emoji: string; c1: string; c2: string }>> = {
  it: { emoji: "💻", c1: "#5b8def", c2: "#3a6fe0" },
  creativity: { emoji: "🎨", c1: "#a97bff", c2: "#7d4fe0" },
  beauty: { emoji: "💄", c1: "#ff7eb3", c2: "#ff5a8a" },
  vocabulary: { emoji: "✍️", c1: "#48c78e", c2: "#2fae76" },
  knowledge: { emoji: "📚", c1: "#ffb056", c2: "#ff8f2c" },
  sociability: { emoji: "🗣️", c1: "#2dd4bf", c2: "#14b8a6" },
  comedy: { emoji: "😂", c1: "#ffd257", c2: "#f7b500" },
  fitness: { emoji: "💪", c1: "#ff8a5b", c2: "#ff5b3a" },
  game: { emoji: "🎮", c1: "#8b93ff", c2: "#5b63e0" },
  otaku: { emoji: "✨", c1: "#ff9fce", c2: "#ff6fae" },
};
function statMeta(stat: SkillStatId): { emoji: string; c1: string; c2: string } {
  return STAT_META[stat] ?? { emoji: "⭐", c1: "#ff8a5b", c2: "#ff5b3a" };
}
function thumbStyle(stat: SkillStatId): string {
  const m = statMeta(stat);
  return `background:linear-gradient(135deg, ${m.c1}, ${m.c2})`;
}

function closeSite(ctx: GameContext): void {
  ctx.ui.gigSiteOpen = false;
  ctx.refresh();
}

/** 상단 카테고리 원형 아이콘 행(장식 — 필터 없음). 등장한 스탯을 순서대로 노출. */
function categoryRow(): HTMLElement {
  const seen: SkillStatId[] = [];
  for (const j of GIG_JOBS) if (!seen.includes(j.stat)) seen.push(j.stat);
  const chip = (emoji: string, label: string, on = false): HTMLElement =>
    el(
      "div",
      { class: "km-cat" + (on ? " km-cat--on" : "") },
      el("div", { class: "km-cat__ico" }, emoji),
      el("div", { class: "km-cat__label" }, label),
    );
  return el(
    "nav",
    { class: "km-cats" },
    chip("🧩", "전체", true),
    ...seen.map((stat) => chip(statMeta(stat).emoji, SKILL_STATS[stat].label)),
  );
}

/** 진행 중 외주 카드. jobById가 못 찾으면(콘텐츠 변경된 구세이브) null — 조용히 숨긴다. */
function activeGigCard(ctx: GameContext, s: GameState, active: ActiveGig): HTMLElement | null {
  const job = jobById(active.id);
  if (!job) return null;

  const pct = Math.min(100, Math.round((Math.max(0, active.progress) / job.workload) * 100));
  const daysLeft = active.dueDay - s.day;
  const urgent = daysLeft <= 0;
  const enabled = canWorkGig(s) === "ok";
  const m = statMeta(job.stat);

  return el(
    "div",
    { class: "km-card km-card--active" },
    el(
      "div",
      { class: "km-card__thumb", style: thumbStyle(job.stat) },
      el("span", { class: "km-card__badge" }, "진행 중"),
      el("span", { class: "km-card__thumb-ico" }, m.emoji),
    ),
    el(
      "div",
      { class: "km-card__info" },
      el(
        "div",
        { class: "km-card__seller" },
        el("span", { class: "km-card__avatar" }),
        job.client,
      ),
      el("div", { class: "km-card__title" }, job.title),
      el("div", { class: "km-bar" }, el("div", { class: "km-bar__fill", style: `width:${pct}%` })),
      el(
        "div",
        { class: "km-prog" },
        `진행 ${formatNumber(active.progress)} / ${formatNumber(job.workload)} (${pct}%)`,
      ),
      el(
        "div",
        { class: "km-card__pricerow" },
        el(
          "span",
          { class: "km-dleft" + (urgent ? " km-dleft--urgent" : "") },
          urgent ? (daysLeft === 0 ? "오늘 마감" : `마감 초과 D${daysLeft}`) : `D-${daysLeft}`,
        ),
        el(
          "button",
          {
            class: "km-card__buy" + (enabled ? "" : " km-card__buy--off"),
            disabled: !enabled,
            title: enabled ? "" : "행동력 부족",
            onclick: () => {
              if (canWorkGig(ctx.store.getState()) !== "ok") return;
              let label = "";
              let done = false;
              ctx.update((st) => {
                const res = workGig(st, active);
                label = res.label;
                done = res.done;
              });
              if (label) ctx.toast(done ? `외주 완료! ${label}` : label);
            },
          },
          "작업하기",
        ),
      ),
      !enabled ? el("div", { class: "km-card__reason" }, "행동력이 부족해요") : null,
    ),
  );
}

/** 수주 가능 외주 카드(크몽 서비스 카드 룩). */
function jobCard(ctx: GameContext, s: GameState, job: GigJob): HTMLElement {
  const myStat = s.skills[job.stat];
  const met = myStat >= job.reqStat;
  const status = canAcceptGig(s, job);
  const enabled = status === "ok";
  const m = statMeta(job.stat);

  return el(
    "div",
    { class: "km-card" },
    el(
      "div",
      { class: "km-card__thumb", style: thumbStyle(job.stat) },
      el("span", { class: "km-card__badge" }, "끄몽 PICK"),
      el("span", { class: "km-card__thumb-ico" }, m.emoji),
    ),
    el(
      "div",
      { class: "km-card__info" },
      el(
        "div",
        { class: "km-card__seller" },
        el("span", { class: "km-card__avatar" }),
        job.client,
      ),
      el("div", { class: "km-card__title" }, job.title),
      el(
        "div",
        { class: "km-card__rate" + (met ? " km-card__rate--good" : " km-card__rate--bad") },
        el("span", { class: "km-star" }, "★ "),
        `${SKILL_STATS[job.stat].label} ${job.reqStat} · 내 ${myStat}`,
      ),
      el(
        "div",
        { class: "km-card__tags" },
        el("span", { class: "km-tag" }, `데드라인 ${job.deadlineDays}일`),
        el("span", { class: "km-tag km-tag--warn" }, `위약금 ${formatNumber(job.penalty)}원`),
      ),
      el(
        "div",
        { class: "km-card__pricerow" },
        el(
          "div",
          { class: "km-price" },
          formatNumber(job.reward),
          el("span", { class: "km-price__won" }, "원"),
        ),
        el(
          "button",
          {
            class: "km-card__buy" + (enabled ? "" : " km-card__buy--off"),
            disabled: !enabled,
            title: status === "already" ? "이미 진행 중" : "",
            onclick: () => {
              if (canAcceptGig(ctx.store.getState(), job) !== "ok") return;
              ctx.update((st) => acceptGig(st, job));
              ctx.toast(`수주 완료! ${job.title}`);
            },
          },
          status === "already" ? "진행 중" : "수주",
        ),
      ),
    ),
  );
}

/** 섹션 헤더(제목 + 건수). */
function secHead(title: string, count: number): HTMLElement {
  return el(
    "div",
    { class: "km-sec-head" },
    el("span", { class: "km-sec-head__t" }, title),
    el("span", { class: "km-sec-head__c" }, `${count}건`),
  );
}

export function renderGig(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const activeCards = s.activeGigs
    .map((a) => activeGigCard(ctx, s, a))
    .filter((n): n is HTMLElement => !!n);
  const availableJobs = GIG_JOBS.filter((j) => !isGigActive(s, j.id));

  return el(
    "div",
    { class: "km-site" },
    // 상단 네비 (로고 + 검색 + 소지금/닫기)
    el(
      "header",
      { class: "km-nav" },
      el("span", { class: "km-logo" }, GIG_SITE_NAME, el("span", { class: "km-logo__dot" }, ".")),
      el(
        "div",
        { class: "km-nav__search" },
        icon("search", { size: 16 }),
        "어떤 전문가를 찾으세요?",
      ),
      el(
        "div",
        { class: "km-nav__right" },
        el("span", { class: "km-money" }, `${formatNumber(s.money)}원`),
        el("button", { class: "km-close", onclick: () => closeSite(ctx) }, "✕ 닫기"),
      ),
    ),
    // 카테고리 원형 아이콘 행
    categoryRow(),
    el(
      "div",
      { class: "km-body" },
      // 히어로
      el(
        "section",
        { class: "km-hero" },
        el("h1", { class: "km-hero__title" }, "성공이 필요한 순간,", el("br"), "딱 맞는 외주를 찾아보세요"),
        el(
          "p",
          { class: "km-hero__sub" },
          "외주를 수주하고 데드라인 안에 작업량을 채우세요. 작업 1회당 행동력 8과 시간이 듭니다. " +
            "내 스탯이 요구 스탯보다 높을수록 회당 진행량이 커져 빨리 끝냅니다. 마감을 넘기면 위약금과 평판 하락이 있어요.",
        ),
      ),
      // 진행 중 외주
      secHead("진행 중인 외주", activeCards.length),
      activeCards.length === 0
        ? el("div", { class: "km-empty" }, "진행 중인 외주가 없어요. 아래에서 외주를 수주해 보세요.")
        : el("div", { class: "km-grid" }, ...activeCards),
      // 수주 가능 외주
      secHead("지금 수주할 수 있는 외주", availableJobs.length),
      availableJobs.length === 0
        ? el("div", { class: "km-empty" }, "지금은 수주 가능한 외주가 없어요.")
        : el("div", { class: "km-grid" }, ...availableJobs.map((j) => jobCard(ctx, s, j))),
      el(
        "div",
        { class: "km-foot" },
        el("div", {}, `${GIG_SITE_NAME} · 믿을 수 있는 재능 거래`),
        el("div", {}, `Copyright ⓒ ${GIG_SITE_NAME}. All rights reserved.`),
      ),
    ),
  );
}
