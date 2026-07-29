import type { GameContext } from "./context";
import type { Video, VideoAttribute } from "@/data/videos";
import { makeRandomVideos, DEFAULT_VIDEO_ATTRS } from "@/data/videos";
import type { HiddenVideo } from "@/data/hiddenVideos";
import { HIDDEN_VIDEOS } from "@/data/hiddenVideos";
import { getActiveAccount } from "@/core/state";
import { imageForVideo } from "@/systems/youtubeImages";
import { ATTRIBUTES } from "@/data/attributes";
import { el } from "@/utils/dom";
import { icon, avatar } from "./icons";
import { renderVideoModal } from "./videoModal";
import { renderStreamTypeModal } from "./livestreamModal";
import { canStream, STREAM_ACTION_COST, STREAM_MENTAL_COST } from "@/systems/livestream";
import { confirmPurchase } from "./confirmModal";

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

/**
 * 썸네일 기본값 — 카테고리 이미지가 없을 때의 그라데이션.
 * **이 경로가 대다수다**(이미지는 있는 카테고리만 붙는다). 이미지가 붙어도 뒤에 그대로 깔아둔다.
 */
function thumbStyle(hue: number): string {
  return (
    `background:linear-gradient(135deg, hsl(${hue}deg 60% 58%),` +
    ` hsl(${(hue + 40) % 360}deg 60% 42%))`
  );
}

/**
 * 영상 카테고리 썸네일. 그 카테고리 이미지가 없으면 null → 호출부는 그라데이션만 남긴다.
 * 쇼츠(9:16)에도 **같은 가로 이미지**를 쓴다 — object-fit:cover로 좌우가 크게 잘리는데,
 * 그게 의도다(사용자 확정). 쇼츠용 세로 이미지를 따로 만들지 마라.
 */
function thumbImg(video: Video, alt: string): HTMLElement | null {
  const url = imageForVideo(video);
  return url ? el("img", { class: "tube-thumb-img", src: url, alt }) : null;
}

/* ===================== 검색 ===================== */

/** 검색어 seed로 결정되는 장식용 hue(썸네일 색). */
function seedHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** 부분일치 비교 — 공백 무시, 대소문자 무시. a 안에 b가 들어있는지. */
function fuzzyIncludes(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  return norm(a).includes(norm(b));
}

/**
 * 숨은 영상(검색으로만 뜨는 영상)을 카드/모달에 재사용 가능한 Video로 변환한다.
 * id를 "hidden_*"로 두면 watchVideo가 감상 효과를 2배로 준다(HIDDEN_VIDEO_BONUS) —
 * tweetLines도 채워 "감상 후 트윗한다" 버튼이 정상 동작하게 한다.
 */
function hiddenToVideo(hv: HiddenVideo): Video {
  return {
    id: `hidden_${hv.trigger}`,
    title: hv.title,
    channel: hv.channel,
    attribute: hv.attribute as VideoAttribute,
    views: "조회수 비공개",
    age: "검색 전용",
    hue: seedHue(hv.trigger + hv.title),
    tweetLines: [
      `${hv.title} 이거 실화냐 ㅋㅋ`,
      "이 영상 진짜 몰입해서 봤다",
      "다들 이 영상 좀 보고 와라",
    ],
  };
}

/** 검색창(실제 input). Enter로 확정 후 ctx.refresh — oninput마다 전체 재렌더는 무겁다. */
function tubeSearchBox(ctx: GameContext): HTMLElement {
  const input = el("input", {
    class: "tube__search-input",
    type: "text",
    placeholder: "검색",
    value: ctx.ui.youtubeSearch,
  }) as HTMLInputElement;
  const submit = (): void => {
    ctx.ui.youtubeSearch = input.value;
    ctx.refresh();
  };
  input.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") submit();
  });
  return el(
    "div",
    { class: "tube__search" },
    el("div", { class: "tube__search-field" }, input),
    el("span", { class: "tube__search-btn", onclick: submit }, icon("search", { size: 18 })),
  );
}

/* ===================== 마스트헤드(장식) ===================== */

/**
 * 인방 진입 — 시간·행동력이 모자라면 토스트로 막고, 되면 코스트 확인 뒤 타입 선택 모달을 연다.
 * (실제 소모는 타입을 고른 시점에 startStream이 한다.)
 */
function startLive(ctx: GameContext): void {
  const state = ctx.store.getState();
  if (!canStream(state)) {
    ctx.toast(
      state.resources.action < STREAM_ACTION_COST
        ? `행동력이 부족해요 (필요 ${STREAM_ACTION_COST})`
        : "오늘은 방송할 시간이 없어요",
      "bad",
    );
    return;
  }
  confirmPurchase(ctx, {
    title: "방송 시작 확인",
    itemName: "너튜브 라이브 방송",
    priceText: `행동력 -${STREAM_ACTION_COST} · 정신력 -${STREAM_MENTAL_COST} · 시간 1칸`,
    message: "방송을 켜면 위 비용이 듭니다. 시작할까요?",
    confirmLabel: "방송하기",
    onConfirm: () => ctx.openModal(renderStreamTypeModal),
  });
}

function masthead(ctx: GameContext): HTMLElement {
  const me = getActiveAccount(ctx.store.getState());

  const logo = el(
    "div",
    { class: "tube__logo" },
    el("span", { class: "tube__logo-mark" }, icon("youtube", { size: 20 })),
    el("span", { class: "tube__logo-text" }, "너튜브"),
    el("sup", { class: "tube__logo-kr" }, "KR"),
  );

  const searchBox = tubeSearchBox(ctx);

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
      // ⚠️ 마스트헤드에서 **유일하게 실제로 동작하는** 버튼이다(나머지는 장식).
      //    인방 진입은 여기 하나뿐이라 지우면 방송 기능이 통째로 닿을 수 없게 된다.
      el(
        "button",
        { class: "tube__create tube__create--live", onclick: () => startLive(ctx) },
        el("span", { class: "tube__live-dot" }),
        "방송 시작",
      ),
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
  const img = thumbImg(video, video.title);
  return el(
    "button",
    {
      class: "tube-card",
      onclick: () => ctx.openModal((c) => renderVideoModal(c, video)),
    },
    el(
      "div",
      { class: "tube-card__thumb", style: thumbStyle(video.hue) },
      // 이미지가 붙으면 재생 글리프는 빼고 사진만 보여준다(진짜 유튜브 썸네일이 그렇다).
      // 없을 때만 글리프를 남긴다 — 그라데이션만 있는 칸이 영상임을 알리는 유일한 표시라서다.
      img ?? el("span", { class: "tube-card__play" }, icon("youtube", { size: 26 })),
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
          el(
            "div",
            { class: "tube__short-thumb", style: thumbStyle((v.hue + 120) % 360) },
            thumbImg(v, v.title),
          ),
          el("div", { class: "tube__short-title" }, v.title),
        ),
      ),
    ),
  );
}

/* ===================== 홈 화면 ===================== */

export function renderYoutube(ctx: GameContext): HTMLElement {
  // 운동 스탯 300 초과면 너튜브에 운동/스포츠 영상도 섞인다.
  const day = ctx.store.getState().day;
  const wantFitness = ctx.store.getState().skills.fitness > 300;
  // 목록이 비었거나, fitness 모드가 바뀌었거나, 날짜가 바뀌면 새 영상으로 갱신한다.
  if (
    ctx.ui.youtubeVideos.length === 0 ||
    ctx.ui.youtubeFitnessMode !== wantFitness ||
    ctx.ui.youtubeVideosDay !== day
  ) {
    const attrs = wantFitness ? [...DEFAULT_VIDEO_ATTRS, "fitness" as const] : DEFAULT_VIDEO_ATTRS;
    ctx.ui.youtubeVideos = makeRandomVideos(12, attrs);
    ctx.ui.youtubeFitnessMode = wantFitness;
    ctx.ui.youtubeVideosDay = day;
  }
  const videos = ctx.ui.youtubeVideos;

  const query = ctx.ui.youtubeSearch.trim();
  let main: HTMLElement;
  if (query) {
    // 제목·카테고리 라벨(ATTR 라벨) 부분일치로 기존 영상을 필터 + 트리거 매칭된 숨은 영상을 상단에 끼운다.
    const matched = videos.filter(
      (v) => fuzzyIncludes(v.title, query) || fuzzyIncludes(ATTRIBUTES[v.attribute].label, query),
    );
    const hidden = HIDDEN_VIDEOS.filter((hv) => fuzzyIncludes(query, hv.trigger)).map(hiddenToVideo);
    const results = [...hidden, ...matched];
    main = el(
      "main",
      { class: "tube__main" },
      el("div", { class: "tube__search-result-head" }, `'${query}' 검색 결과`),
      results.length
        ? el("div", { class: "tube__grid" }, ...results.map((v) => videoCard(ctx, v)))
        : el("div", { class: "tube__search-empty" }, "검색 결과가 없습니다"),
    );
  } else {
    // 첫 줄 3개 → Shorts → 나머지, 유튜브 홈 배치를 흉내낸다.
    const topRow = videos.slice(0, 3);
    const rest = videos.slice(3);
    main = el(
      "main",
      { class: "tube__main" },
      chips(),
      el("div", { class: "tube__grid" }, ...topRow.map((v) => videoCard(ctx, v))),
      shortsSection(videos),
      el("div", { class: "tube__grid" }, ...rest.map((v) => videoCard(ctx, v))),
    );
  }

  return el(
    "div",
    { class: "tube" },
    masthead(ctx),
    el("div", { class: "tube__body" }, rail(), main),
  );
}
