import type { AttributeId } from "@/core/types";

/**
 * 인라인 SVG 아이콘 세트(외부 이미지 없이 자체 포함).
 * icon("search") → <span class="icon"><svg>…</svg></span>
 */
export type IconName =
  | "search"
  | "article"
  | "mail"
  | "megaphone"
  | "pen"
  | "shield"
  | "comment"
  | "retweet"
  | "heart"
  | "heart-fill"
  | "grid"
  | "clock"
  | "coin"
  | "x"
  | "refresh"
  | "lock"
  | "chevron"
  | "star"
  | "sun"
  | "moon"
  | "walk"
  | "bed"
  | "book"
  | "dumbbell"
  | "coffee"
  | "ballot"
  | "gamepad"
  | "bowl"
  | "sparkle"
  | "smile"
  | "mic"
  | "tv"
  | "film"
  | "youtube"
  | "ticket"
  | "paw"
  | "dog"
  | "cat"
  | "bird"
  | "leaf"
  | "pot"
  | "drawer"
  | "camera"
  | "image";

const PATHS: Record<IconName, string> = {
  search: `<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>`,
  article: `<path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/>`,
  mail: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>`,
  megaphone: `<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 8.5a4 4 0 0 1 0 7"/>`,
  pen: `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>`,
  shield: `<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>`,
  comment: `<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  retweet: `<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>`,
  heart: `<path d="M12 21s-6.5-4.35-9.2-8.1A5.2 5.2 0 0 1 12 6.1 5.2 5.2 0 0 1 21.2 12.9C18.5 16.65 12 21 12 21z"/>`,
  "heart-fill": `<path d="M12 21s-6.5-4.35-9.2-8.1A5.2 5.2 0 0 1 12 6.1 5.2 5.2 0 0 1 21.2 12.9C18.5 16.65 12 21 12 21z"/>`,
  grid: `<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  coin: `<circle cx="12" cy="12" r="9"/><path d="M9 9.5 12 15l3-5.5"/><path d="M9 12.5h6"/>`,
  x: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  refresh: `<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/>`,
  lock: `<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,
  chevron: `<path d="m6 9 6 6 6-6"/>`,
  star: `<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.9 6.7 19.8l1.1-6L3.4 9.4l6-.8z"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
  moon: `<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>`,
  walk: `<circle cx="13" cy="4" r="2"/><path d="M12 8l-2 4 3 2 1 6"/><path d="M10 12 7 10"/><path d="m14 12 3 1"/>`,
  bed: `<path d="M3 18V8"/><path d="M3 13h13a5 5 0 0 1 5 5"/><path d="M21 18v-1"/><circle cx="8" cy="10.5" r="1.6"/>`,
  book: `<path d="M5 4a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z"/><path d="M5 19a2 2 0 0 1 2-2h12"/>`,
  dumbbell: `<path d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11"/>`,
  coffee: `<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7 3v2M11 3v2"/>`,
  ballot: `<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8.5 12 2.5 2.5L16 9"/>`,
  gamepad: `<rect x="2" y="7" width="20" height="10" rx="4"/><path d="M7 11v2M6 12h2"/><circle cx="16" cy="11" r="1"/><circle cx="18" cy="13.5" r="1"/>`,
  bowl: `<path d="M3 10h18a9 9 0 0 1-18 0z"/><path d="M6.5 10c0-3 2-3.5 2-6M11.5 10c0-3 2-3.5 2-6"/>`,
  sparkle: `<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4z"/>`,
  smile: `<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>`,
  mic: `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3M8 21h8"/>`,
  tv: `<rect x="3" y="7" width="18" height="13" rx="2"/><path d="m8 3 4 4 4-4"/>`,
  film: `<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>`,
  youtube: `<rect x="3" y="6" width="18" height="12" rx="4"/><path d="m10 9 5 3-5 3z"/>`,
  ticket: `<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z"/><path d="M14 6v12"/>`,
  paw: `<circle cx="7" cy="9" r="1.8"/><circle cx="12" cy="7" r="1.8"/><circle cx="17" cy="9" r="1.8"/><path d="M12 12c-2.5 0-4.5 2-4.5 4a2.5 2.5 0 0 0 2.5 2.5c.8 0 1.4-.4 2-.4s1.2.4 2 .4A2.5 2.5 0 0 0 16.5 16c0-2-2-4-4.5-4z"/>`,
  dog: `<path d="M10 5.2 7 4C5.5 4 4.5 5.5 4.5 8c0 1 .3 1.8.5 2.3"/><path d="m14 5.2 3-1.2c1.5 0 2.5 1.5 2.5 4 0 1-.3 1.8-.5 2.3"/><path d="M6 9c0 3.5 2.7 6 6 6s6-2.5 6-6"/><path d="M10 11h.01M14 11h.01"/><path d="M12 13v1.5"/>`,
  cat: `<path d="M4 4v5a8 8 0 0 0 16 0V4l-3.5 3h-9z"/><path d="M9.5 12h.01M14.5 12h.01"/><path d="m12 14-1.2 1.4h2.4z"/><path d="M6 14.5H3M21 14.5h-3"/>`,
  bird: `<path d="M16 7h.01"/><path d="M20 6a4 4 0 0 1-4 4H9a5 5 0 0 0-5 5c0 2 1 3 1 3s1.5-1 3-1h4a6 6 0 0 0 6-6V6z"/><path d="M9 14l-3 6"/><path d="M13 14l1 6"/>`,
  leaf: `<path d="M4 20C4 11 11 4 20 4c0 9-7 16-16 16z"/><path d="M4 20C8 14 12 11 17 9"/>`,
  pot: `<path d="M4 10h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z"/><path d="M2 10h20"/><path d="M9 7c0-1.5-1.5-1.5-1.5-3M13 7c0-1.5-1.5-1.5-1.5-3"/>`,
  drawer: `<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 12h18"/><path d="M10 8h4M10 16h4"/>`,
  camera: `<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>`,
  image: `<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m5 18 4.5-4.5 3 3L16 12l3 3.5"/>`,
};

const FILLED = new Set<IconName>(["heart-fill", "star"]);

export interface IconOpts {
  size?: number;
  className?: string;
}

/** 아이콘을 감싼 span 요소를 만든다(el 헬퍼의 자식으로 바로 넣을 수 있음). */
export function icon(name: IconName, opts: IconOpts = {}): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "icon" + (opts.className ? ` ${opts.className}` : "");
  const size = opts.size ?? 18;
  const fill = FILLED.has(name) ? "currentColor" : "none";
  span.innerHTML =
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" ` +
    `stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
  return span;
}

/**
 * 원형 아바타 — 사람(계정) 식별용 프로필 자리.
 * 성향/카테고리를 드러내지 않도록 이름을 해시한 색 + 이니셜만 표시한다.
 */
export function avatar(seed: string, size = 40): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "avatar";
  span.style.width = `${size}px`;
  span.style.height = `${size}px`;
  span.style.background = `hsl(${hashString(seed) % 360}deg 52% 52%)`;
  span.style.fontSize = `${Math.max(11, Math.round(size * 0.42))}px`;
  span.style.fontWeight = "700";
  span.textContent = initialOf(seed);
  return span;
}

/**
 * 관계 캐릭터(호감도를 쌓아 친구·연인이 될 수 있는 상대)의 아바타.
 * 이니셜 대신 하트를 넣어 "이 사람은 호감도 대상"임을 프로필 자리에서 바로 보여준다.
 * 색은 그대로 이름 해시라 사람마다 다르다(하트만 공통).
 */
export function relAvatar(seed: string, size = 40): HTMLSpanElement {
  const span = avatar(seed, size);
  span.textContent = "♥";
  span.style.fontSize = `${Math.max(13, Math.round(size * 0.5))}px`; // 하트는 이니셜보다 작아 보여 조금 키운다
  return span;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 이름의 첫 글자(이니셜). 이모지/서러게이트도 안전하게 처리 */
function initialOf(s: string): string {
  const t = s.trim();
  return t ? [...t][0].toUpperCase() : "?";
}

/** 속성 → 아이콘 매핑 */
export const ATTR_ICON: Record<AttributeId, IconName> = {
  daily: "coffee",
  politics: "ballot",
  idol: "mic",
  anime: "tv",
  actor: "film",
  gaming: "gamepad",
  food: "bowl",
  fitness: "dumbbell",
  beauty: "sparkle",
  humor: "smile",
  info: "article",
  it: "grid",
  dog: "dog",
  cat: "cat",
  animal: "bird",
  plant: "leaf",
  cooking: "pot",
  finance: "coin",
  sports: "ticket",
  fashion: "star",
  travel: "sun",
  adult: "shield",
};

/**
 * 오프라인 활동 id → 아이콘 매핑.
 *
 * ⚠️ `Record<string, IconName>`이라 **키가 빠져도 typecheck를 통과한다** — 누락되면 조용히
 *    `?? "star"` 폴백으로 떨어져 서로 다른 활동이 전부 같은 별 아이콘으로 렌더된다.
 *    `OFFLINE_ACTIVITIES`에 활동을 추가하면 여기도 반드시 채워라(알바 4종 분할 때 실제로 누락됐다).
 */
export const ACTIVITY_ICON: Record<string, IconName> = {
  goout: "walk",
  walk: "paw",
  rest: "bed",
  vacation: "sun",
  study: "book",
  art: "pen",
  coding: "grid",
  // 운동 2종 — 헬스장은 기존 dumbbell(기구) 유지. 홈트는 기구가 없으니 맨몸을 뜻하는 walk를 쓴다.
  // ⚠️ sparkle을 쓰지 마라. beauty(꾸미기)가 이미 sparkle이고, 매핑이 없는 활동은 `?? "star"`로
  //    떨어져 화면에 별이 깔린다 — 실제로 홈트가 봉사·꾸미기와 구분이 안 됐다(브라우저 확인).
  //    goout도 walk지만 그쪽은 '휴식' 탭이라 같은 목록에 나란히 놓이지 않는다.
  homeWorkout: "walk",
  workout: "dumbbell",
  youtube: "youtube",
  // 취향 탐구(변태력 육성) — 남들에겐 잠긴 서랍. 물류(drawer)와 겹치지 않게 lock.
  kinkdig: "lock",
  // 아르바이트 4종 — 종류별로 아이콘이 달라야 목록에서 구분된다(전부 coin이면 개별 카운터가 안 읽힌다).
  parttime: "coin",
  logistics: "drawer",
  cafe_serving: "coffee",
  tutoring: "book",
};
