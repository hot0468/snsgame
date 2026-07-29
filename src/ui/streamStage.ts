import type { StreamTypeId } from "@/data/livestream";
import { el } from "@/utils/dom";

/** 인물 이미지 한 장 — `name`은 파일명(확장자 제외), `url`은 번들된 주소 */
interface StageImage {
  name: string;
  url: string;
}

/**
 * 파일명 순서대로 인물 이미지 풀을 만든다(파일을 늘리면 코드 수정 없이 자동으로 낀다).
 * 파일명을 그대로 클래스(`live-art__chatimg--live_chat6`)로 달아두므로,
 * 한 장만 프레이밍이 어긋나면 main.css에서 그 장만 잡아 위치를 고칠 수 있다.
 */
function pool(files: Record<string, string>): StageImage[] {
  return Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([path, url]) => ({ name: path.split("/").pop()!.replace(/\.webp$/, ""), url }));
}

/** 수다 방송 진행자 사진 */
const CHAT_IMAGES = pool(
  import.meta.glob<string>("../assets/system/live_chat*.webp", {
    eager: true,
    query: "?url",
    import: "default",
  }),
);

/** 버튜버 아바타 그림 */
const VTUBER_IMAGES = pool(
  import.meta.glob<string>("../assets/system/live_vtuber*.webp", {
    eager: true,
    query: "?url",
    import: "default",
  }),
);

/** 인물 이미지 한 장이 머무는 시간(초) */
const FRAME_SEC = 0.7;

/**
 * 이미지 전부를 겹쳐 깔고 CSS가 한 장씩 돌려 보여준다(플립북).
 *
 * ⚠️ JS 타이머를 쓰지 않는 게 요점이다 — 이 모달은 닫는 경로가 여럿이라 타이머를 두면
 *    전부 정리해야 하지만, CSS 애니메이션은 노드가 사라질 때 같이 사라진다.
 * ⚠️ '한 장만 보이는' 노출 구간은 1/N이라 풀 크기마다 다르다 → 키프레임을 풀 크기별로
 *    한 번만 만들어 둔다(main.css에 12.5%를 박아두면 장수를 바꿀 때 조용히 깨진다).
 */
function flipbook(node: HTMLElement, images: StageImage[], cls: string): void {
  if (images.length === 0) return;
  const name = frameKeyframes(images.length);
  const total = images.length * FRAME_SEC;
  images.forEach((img, i) => {
    node.appendChild(
      el("img", {
        class: `${cls} ${cls}--${img.name}`,
        src: img.url,
        alt: "",
        style: `animation-name:${name};animation-duration:${total}s;animation-delay:${i * FRAME_SEC}s`,
      }),
    );
  });
}

/** N장짜리 플립북용 키프레임(각자 1/N 구간만 보인다)을 만들고 이름을 준다 */
function frameKeyframes(n: number): string {
  const name = `live-frames-${n}`;
  if (!document.getElementById(name)) {
    const pct = 100 / n;
    document.head.appendChild(
      el(
        "style",
        { id: name },
        `@keyframes ${name}{0%,${(pct - 0.1).toFixed(2)}%{opacity:1}${pct.toFixed(2)}%,100%{opacity:0}}`,
      ),
    );
  }
  return name;
}

/**
 * 인방 방송화면 그림 — 방송 타입별 목업 화면.
 *
 * ⚠️ 이미지 파일(webp) 대신 **인라인 SVG**로 그린다. 에셋 파이프라인(assets/*.webp)은
 *    사람이 넣은 그림을 쓰는 곳이고, 여기는 매 방송 켜질 때마다 뜨는 UI 배경이라
 *    어떤 해상도에서도 선명해야 하고 로딩이 없어야 한다. 움직임은 CSS가 맡는다
 *    (main.css의 `.live-art*` 규칙 — 이 파일에 애니메이션 정의를 중복하지 마라).
 *
 * SVG는 정적 문자열이라 `html`로 넣어도 안전하다(외부 입력이 섞이지 않는다).
 */

/** 게임 방송 — 탑다운 MOBA 화면(미니맵·체력바·스킬바·킬로그) */
const GAME = `
<svg class="live-art" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="lsGameBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#123024"/><stop offset="1" stop-color="#06121c"/>
    </linearGradient>
  </defs>
  <rect width="320" height="180" fill="url(#lsGameBg)"/>
  <path d="M-20 140 L110 46 L205 66 L340 -12" stroke="#1b4d63" stroke-width="24" fill="none" opacity="0.5"/>
  <path d="M0 168 L300 26" stroke="#2f6b45" stroke-width="9" fill="none" opacity="0.45"/>
  <path d="M20 20 L120 120 L250 150" stroke="#2a5c3d" stroke-width="7" fill="none" opacity="0.35"/>
  <ellipse cx="64" cy="76" rx="27" ry="15" fill="#1d4a2c" opacity="0.85"/>
  <ellipse cx="228" cy="112" rx="32" ry="17" fill="#1d4a2c" opacity="0.85"/>
  <ellipse cx="170" cy="34" rx="22" ry="12" fill="#1d4a2c" opacity="0.7"/>
  <!-- ⚠️ 위치는 바깥 g의 transform 속성이, 움직임은 안쪽 g의 CSS transform이 맡는다.
       한 요소에 둘을 같이 걸면 CSS가 속성을 덮어써 캐릭터가 좌상단으로 튄다. -->
  <g transform="translate(120 96)"><g class="live-art__hero--a">
    <circle r="9" fill="#4fc3ff" stroke="#eaf7ff" stroke-width="2"/>
    <circle r="17" fill="none" stroke="#4fc3ff" stroke-width="1.5" opacity="0.45"/>
  </g></g>
  <g transform="translate(196 74)"><g class="live-art__hero--b">
    <circle r="8" fill="#ff5f6d" stroke="#ffe8ea" stroke-width="2"/>
  </g></g>
  <g transform="translate(84 132)"><g class="live-art__hero--c">
    <circle r="6" fill="#ffd166" stroke="#fff6de" stroke-width="1.5"/>
  </g></g>
  <g opacity="0.92">
    <rect x="104" y="14" width="112" height="9" rx="4.5" fill="#00000066"/>
    <rect class="live-art__hp" x="106" y="16" width="108" height="5" rx="2.5" fill="#3ddc84"/>
    <rect x="104" y="27" width="112" height="6" rx="3" fill="#00000066"/>
    <rect class="live-art__mp" x="106" y="28.5" width="70" height="3" rx="1.5" fill="#4fa3ff"/>
  </g>
  <g opacity="0.9">
    <rect x="248" y="106" width="64" height="64" rx="5" fill="#03121a" stroke="#3a6b7d" stroke-width="1.2"/>
    <path d="M252 164 L308 112" stroke="#2f6b45" stroke-width="3" opacity="0.6"/>
    <circle class="live-art__ping" cx="272" cy="140" r="3" fill="#4fc3ff"/>
    <circle cx="294" cy="124" r="2.5" fill="#ff5f6d"/>
    <circle cx="262" cy="156" r="2.5" fill="#ffd166"/>
  </g>
  <g opacity="0.85">
    <rect x="110" y="152" width="100" height="20" rx="5" fill="#00000070"/>
    <rect x="115" y="156" width="12" height="12" rx="3" fill="#2c4a5c"/>
    <rect x="131" y="156" width="12" height="12" rx="3" fill="#2c4a5c"/>
    <rect x="147" y="156" width="12" height="12" rx="3" fill="#2c4a5c"/>
    <rect class="live-art__cd" x="163" y="156" width="12" height="12" rx="3" fill="#4fa3ff"/>
    <rect x="185" y="156" width="20" height="12" rx="3" fill="#3a2c1c"/>
  </g>
  <!-- 킬로그는 y=40 아래에 둔다 — 위쪽은 화면 HUD(경과시간·LIVE 배지)가 덮는 자리다 -->
  <g class="live-art__killfeed" opacity="0.8">
    <rect x="8" y="42" width="86" height="14" rx="4" fill="#00000066"/>
    <circle cx="18" cy="49" r="3.5" fill="#4fc3ff"/>
    <text x="27" y="52.5" font-size="8" fill="#dff0ff" font-family="sans-serif">처치!</text>
    <circle cx="86" cy="49" r="3.5" fill="#ff5f6d"/>
  </g>
</svg>`;

/**
 * 수다 방송 — **배경만** SVG다(방·책상·마이크·오디오 레벨).
 * 진행자는 사람 사진(assets/system/live_chat*.webp, 배경 투명)을 streamStageArt가 위에 얹는다.
 */
const TALK = `
<svg class="live-art" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="lsTalkBg" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#3a2b4d"/><stop offset="1" stop-color="#1a1526"/>
    </linearGradient>
  </defs>
  <rect width="320" height="180" fill="url(#lsTalkBg)"/>
  <circle class="live-art__bokeh live-art__bokeh--a" cx="46" cy="42" r="16" fill="#ffb3c6" opacity="0.22"/>
  <circle class="live-art__bokeh live-art__bokeh--b" cx="272" cy="58" r="22" fill="#8fd3ff" opacity="0.18"/>
  <circle class="live-art__bokeh live-art__bokeh--c" cx="240" cy="24" r="10" fill="#ffe08a" opacity="0.25"/>
  <rect x="18" y="46" width="52" height="66" rx="4" fill="#241d33" opacity="0.85"/>
  <rect x="22" y="52" width="44" height="5" rx="2.5" fill="#6f5f92" opacity="0.7"/>
  <rect x="22" y="66" width="44" height="5" rx="2.5" fill="#6f5f92" opacity="0.55"/>
  <rect x="22" y="80" width="30" height="5" rx="2.5" fill="#6f5f92" opacity="0.45"/>
  <rect x="0" y="152" width="320" height="28" fill="#1a1424" opacity="0.9"/>
  <g>
    <rect x="238" y="126" width="5" height="34" rx="2.5" fill="#4b4360"/>
    <ellipse cx="240.5" cy="118" rx="11" ry="15" fill="#6c6486"/>
    <ellipse cx="240.5" cy="118" rx="7" ry="11" fill="#3d3752"/>
    <rect x="220" y="146" width="41" height="6" rx="3" fill="#4b4360"/>
  </g>
  <g class="live-art__levels" transform="translate(276 158)">
    <rect class="live-art__level live-art__level--a" x="0" y="-8" width="4" height="8" rx="2" fill="#3ddc84"/>
    <rect class="live-art__level live-art__level--b" x="7" y="-14" width="4" height="14" rx="2" fill="#3ddc84"/>
    <rect class="live-art__level live-art__level--c" x="14" y="-10" width="4" height="10" rx="2" fill="#ffd166"/>
    <rect class="live-art__level live-art__level--d" x="21" y="-6" width="4" height="6" rx="2" fill="#3ddc84"/>
  </g>
  <g opacity="0.8">
    <rect x="16" y="128" width="34" height="24" rx="3" fill="#2a2238"/>
    <rect x="20" y="132" width="26" height="16" rx="2" fill="#5c4f7a"/>
    <ellipse cx="70" cy="150" rx="13" ry="4" fill="#2a2238"/>
    <path d="M62 150 Q64 132 70 128 Q76 132 78 150 Z" fill="#e8e3f2" opacity="0.9"/>
  </g>
</svg>`;

/**
 * 버튜버 방송 — **배경만** SVG다(그라데이션·반짝이·하트).
 * 아바타 본체는 사람이 넣은 그림(assets/system/live_vtuber.webp)을 streamStageArt가 위에 얹는다 —
 * 손으로 그린 SVG 캐릭터로는 애니 작화의 질감이 안 나온다는 판단.
 */
const VTUBER = `
<svg class="live-art" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="lsVtBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffd6ec"/><stop offset="0.55" stop-color="#c9b8ff"/><stop offset="1" stop-color="#8ec5ff"/>
    </linearGradient>
  </defs>
  <rect width="320" height="180" fill="url(#lsVtBg)"/>
  <circle cx="52" cy="36" r="26" fill="#fff" opacity="0.25"/>
  <circle cx="268" cy="128" r="34" fill="#fff" opacity="0.2"/>
  <g class="live-art__sparkles" fill="#fff" opacity="0.85">
    <path class="live-art__spark live-art__spark--a" d="M40 96 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z"/>
    <path class="live-art__spark live-art__spark--b" d="M282 52 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 z"/>
    <path class="live-art__spark live-art__spark--c" d="M96 34 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z"/>
  </g>
  <g class="live-art__hearts" fill="#ff6fae">
    <path class="live-art__heart live-art__heart--a" d="M240 160 c-4 -5 -11 -1 -11 5 c0 6 11 12 11 12 c0 0 11 -6 11 -12 c0 -6 -7 -10 -11 -5 z" opacity="0.9"/>
    <path class="live-art__heart live-art__heart--b" d="M68 160 c-3 -4 -8 -1 -8 3.5 c0 4.5 8 9 8 9 c0 0 8 -4.5 8 -9 c0 -4.5 -5 -7.5 -8 -3.5 z" opacity="0.85"/>
    <path class="live-art__heart live-art__heart--c" d="M290 160 c-2.5 -3 -6.5 -0.5 -6.5 3 c0 3.5 6.5 7 6.5 7 c0 0 6.5 -3.5 6.5 -7 c0 -3.5 -4 -6 -6.5 -3 z" opacity="0.8"/>
  </g>
</svg>`;

const ART: Record<StreamTypeId, string> = { game: GAME, talk: TALK, vtuber: VTUBER };

/** 방송 타입에 맞는 방송화면(움직이는 SVG 목업)을 만든다 */
export function streamStageArt(id: StreamTypeId): HTMLElement {
  const node = el("div", { class: `live-stage__art live-stage__art--${id}`, html: ART[id] });
  // 배경 SVG 위에 인물 이미지를 플립북으로 얹는다(게임 방송은 인물이 없다).
  if (id === "vtuber") flipbook(node, VTUBER_IMAGES, "live-art__vtimg");
  else if (id === "talk") flipbook(node, CHAT_IMAGES, "live-art__chatimg");
  return node;
}
