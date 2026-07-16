import type { GameContext } from "./context";
import type { Video } from "@/data/videos";
import { makeRandomVideos, DEFAULT_VIDEO_ATTRS } from "@/data/videos";
import { getActiveAccount } from "@/core/state";
import { el } from "@/utils/dom";
import { icon, avatar } from "./icons";
import { renderVideoModal } from "./videoModal";

/* ============================================================
 * 너튜브 홈 — 유튜브 레이아웃 클론.
 * 마스트헤드/사이드바/카테고리 칩은 전부 '장식'(클릭 불가)이고,
 * 실제로 클릭되는 건 영상 카드뿐이다.
 * ============================================================ */

/** 영상 id로 결정되는 장식용 재생시간(1:00~20:00) */
function duration(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const total = 60 + (h % 1140);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function thumbStyle(hue: number): string {
  return (
    `background:linear-gradient(135deg, hsl(${hue}deg 60% 58%),` +
    ` hsl(${(hue + 40) % 360}deg 60% 42%))`
  );
}

/* ===================== 마스트헤드(장식) ===================== */

function masthead(ctx: GameContext): HTMLElement {
  const me = getActiveAccount(ctx.store.getState());

  const logo = el(
    "div",
    { class: "tube__logo" },
    el("span", { class: "tube__logo-mark" }, icon("youtube", { size: 20 })),
    el("span", { class: "tube__logo-text" }, "너튜브"),
    el("sup", { class: "tube__logo-kr" }, "KR"),
  );

  const searchBox = el(
    "div",
    { class: "tube__search" },
    el(
      "div",
      { class: "tube__search-field" },
      el("span", { class: "tube__search-ph" }, "검색"),
    ),
    el("span", { class: "tube__search-btn" }, icon("search", { size: 18 })),
  );

  return el(
    "header",
    { class: "tube__mast" },
    el(
      "div",
      { class: "tube__mast-left" },
      el("span", { class: "tube__hamburger" }, el("i", {}), el("i", {}), el("i", {})),
      logo,
    ),
    el(
      "div",
      { class: "tube__mast-center" },
      searchBox,
      el("span", { class: "tube__mic" }, icon("mic", { size: 18 })),
    ),
    el(
      "div",
      { class: "tube__mast-right" },
      el("span", { class: "tube__create" }, icon("pen", { size: 15 }), "만들기"),
      el("span", { class: "tube__bell" }, icon("megaphone", { size: 18 })),
      avatar(me.name, 32),
    ),
  );
}

/* ===================== 사이드바(장식) ===================== */

const RAIL_ITEMS: { label: string; icon: Parameters<typeof icon>[0]; active?: boolean }[] = [
  { label: "홈", icon: "grid", active: true },
  { label: "Shorts", icon: "youtube" },
  { label: "구독", icon: "tv" },
  { label: "내 페이지", icon: "smile" },
];

function rail(): HTMLElement {
  return el(
    "nav",
    { class: "tube__rail" },
    ...RAIL_ITEMS.map((it) =>
      el(
        "div",
        { class: "tube__rail-item" + (it.active ? " tube__rail-item--active" : "") },
        icon(it.icon, { size: 22 }),
        el("span", { class: "tube__rail-label" }, it.label),
      ),
    ),
  );
}

/* ===================== 카테고리 칩(장식) ===================== */

const CHIPS = [
  "전체", "뉴스", "팟캐스트", "게임", "라이브", "믹스", "요리",
  "최근에 업로드된 동영상", "감상한 동영상", "새로운 맞춤 동영상",
];

function chips(): HTMLElement {
  return el(
    "div",
    { class: "tube__chips" },
    ...CHIPS.map((label, i) =>
      el(
        "span",
        { class: "tube__chip" + (i === 0 ? " tube__chip--active" : "") },
        label,
      ),
    ),
  );
}

/* ===================== 영상 카드(클릭 가능) ===================== */

function videoCard(ctx: GameContext, video: Video): HTMLElement {
  return el(
    "button",
    {
      class: "tube-card",
      onclick: () => ctx.openModal((c) => renderVideoModal(c, video)),
    },
    el(
      "div",
      { class: "tube-card__thumb", style: thumbStyle(video.hue) },
      el("span", { class: "tube-card__play" }, icon("youtube", { size: 26 })),
      el("span", { class: "tube-card__tag" }, duration(video.id)),
    ),
    el(
      "div",
      { class: "tube-card__row" },
      avatar(video.channel, 36),
      el(
        "div",
        { class: "tube-card__info" },
        el("div", { class: "tube-card__title" }, video.title),
        el("div", { class: "tube-card__ch" }, video.channel),
        el("div", { class: "tube-card__meta" }, `${video.views} · ${video.age}`),
      ),
    ),
  );
}

/* ===================== Shorts 섹션(장식) ===================== */

function shortsSection(videos: Video[]): HTMLElement {
  const items = videos.slice(0, 6);
  return el(
    "section",
    { class: "tube__shorts" },
    el(
      "div",
      { class: "tube__shorts-head" },
      el("span", { class: "tube__shorts-mark" }, icon("youtube", { size: 20 })),
      "Shorts",
    ),
    el(
      "div",
      { class: "tube__shorts-row" },
      ...items.map((v) =>
        el(
          "div",
          { class: "tube__short" },
          el("div", { class: "tube__short-thumb", style: thumbStyle((v.hue + 120) % 360) }),
          el("div", { class: "tube__short-title" }, v.title),
        ),
      ),
    ),
  );
}

/* ===================== 홈 화면 ===================== */

export function renderYoutube(ctx: GameContext): HTMLElement {
  // 운동 스탯 300 초과면 너튜브에 운동/스포츠 영상도 섞인다.
  const wantFitness = ctx.store.getState().skills.fitness > 300;
  if (ctx.ui.youtubeVideos.length === 0 || ctx.ui.youtubeFitnessMode !== wantFitness) {
    const attrs = wantFitness ? [...DEFAULT_VIDEO_ATTRS, "fitness" as const] : DEFAULT_VIDEO_ATTRS;
    ctx.ui.youtubeVideos = makeRandomVideos(12, attrs);
    ctx.ui.youtubeFitnessMode = wantFitness;
  }
  const videos = ctx.ui.youtubeVideos;
  // 첫 줄 3개 → Shorts → 나머지, 유튜브 홈 배치를 흉내낸다.
  const topRow = videos.slice(0, 3);
  const rest = videos.slice(3);

  return el(
    "div",
    { class: "tube" },
    masthead(ctx),
    el(
      "div",
      { class: "tube__body" },
      rail(),
      el(
        "main",
        { class: "tube__main" },
        chips(),
        el("div", { class: "tube__grid" }, ...topRow.map((v) => videoCard(ctx, v))),
        shortsSection(videos),
        el("div", { class: "tube__grid" }, ...rest.map((v) => videoCard(ctx, v))),
      ),
    ),
  );
}
