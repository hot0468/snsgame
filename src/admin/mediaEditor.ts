/**
 * 어드민 · 이미지 편집기 — `admin-media.html`로 진입한다(예: /admin-media.html).
 *
 * 여섯 축을 한 편집기에서 다룬다. **성격이 달라 섞으면 안 된다:**
 *
 * | 모드 | 저장 위치 | 파일명 | 매칭 |
 * |---|---|---|---|
 * | 미디어 트윗 | `src/assets/media/` | 손으로 짓는 **키워드** | 본문 부분일치 + 트윗 id 해시로 택1 |
 * | 아이템 | `src/assets/items/` | **아이템 id**(목록에서 고름) | id 1:1 정확 매칭. 확률 없음 |
 * | 너튜브 | `src/assets/youtube/` | **영상 카테고리**(목록에서 고름) | 카테고리 정확일치 + 영상 id 해시로 택1 |
 * | 성인 트윗 | `src/assets/adult/` | **자동**(`adult`·`adult__2`…) | `isAdult`만 본다 + 트윗 id 해시로 택1 |
 * | 트윗 카테고리 | `src/assets/tweetcat/` | **트윗 속성**(목록에서 고름) | `tweet.attribute` 정확일치 + 트윗 id 해시로 택1 |
 * | 야밤 영상 | `src/assets/yabam/` | **영상 id**(목록에서 고름) | id 1:1 정확 매칭. 확률 없음(아이템과 같은 결) |
 * | 창작 | `src/assets/creation/` | **자동**(`creation`·`creation__2`…) | `tweet.creation`만 본다 + 트윗 id 해시로 택1(성인과 같은 결) |
 *
 * ⚠️ 「너튜브」와 「트윗 카테고리」는 둘 다 '카테고리'지만 **다른 축이다.** 너튜브는 영상
 *    카테고리(VideoAttribute), 트윗 카테고리는 트윗 속성(AttributeId)이다. 겹치는 이름이
 *    있어도(idol·anime) 서로 다른 화면에 붙으니 폴더를 합치지 마라.
 *
 * 크기는 화면이 정한다(사용자가 고르지 않는다) — 아이템은 정사각 240, 남의방만 4:3 160x120.
 * 어느 쪽이든 파일을 넣는 것으로 끝이고, 코드 수정은 필요 없다(data/*Images.ts의 glob).
 *
 * 게임이 아니라 개발 도구다 — GameContext도 store도 쓰지 않는다.
 * 저장은 dev 서버 미들웨어(vite.config.ts)가 받으므로 `npm run dev`에서만 동작한다.
 */
import { MEDIA_IMAGES } from "@/data/mediaImages";
import { ITEM_IMAGES } from "@/data/itemImages";
import { YOUTUBE_IMAGES } from "@/data/youtubeImages";
import { ADULT_IMAGES } from "@/data/adultImages";
import { TWEET_CAT_IMAGES, TWEET_CAT_IDS } from "@/data/tweetCatImages";
import { YABAM_IMAGES } from "@/data/yabamImages";
import { CREATION_IMAGES } from "@/data/creationImages";
import { YABAM_VIDEOS } from "@/data/yabam";
import type { VideoAttribute } from "@/data/videos";
import { ATTRIBUTES } from "@/data/attributes";
import { SHOP_ITEMS } from "@/data/shop";
import { PEEMANG_ITEMS } from "@/data/peemang";
import { INGREDIENTS } from "@/data/grocery";
import { HOUSINGS } from "@/data/housing";
import { GAME_EVENTS } from "@/data/events";
import { EVENT_IMAGES } from "@/data/eventImages";
import { el, mount } from "@/utils/dom";

/**
 * 파일명 규칙. 서버(vite.config.ts)의 SAFE_NAME과 같은 규칙을 클라이언트에서도 먼저 검사한다.
 * 공백을 허용한다 — 키워드 매칭이 본문 부분일치라(systems/mediaImages.ts), '핸드폰 배터리'처럼
 * 겹단어를 넣으면 그 구절이 통째로 들어간 트윗에 붙는다. 경로문자·`../`는 여전히 막힌다.
 */
const SAFE_NAME = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 _-]{1,50}$/;
/** 크롭 무대의 가로 폭(px). 세로는 저장 비율에 맞춰 계산한다. */
const STAGE_W = 320;
/** 확대 미리보기의 최대 가로 폭 — 240짜리를 2배로 띄우면 패널을 뚫는다. */
const ZOOM_MAX_W = 360;

/** 저장 직후 dev 서버가 페이지를 새로고침해버려, 성공 문구를 이 키로 넘겨 되살린다. */
const SAVED_MSG_KEY = "mediaEditor:saved";
/**
 * 저장 직후의 full reload로 모듈 상태(mode·화면·카테고리 선택)가 초기화되는 걸 막는다.
 * 저장 시 현재 선택을 여기 담고, init()이 apply() 전에 되살린다 — 연속 등록 시 매번
 * '미디어 트윗'으로 튕기지 않게(사용자 요청).
 */
const SAVED_SEL_KEY = "mediaEditor:selection";

/**
 * 아이템 이미지를 붙일 화면들. **크기는 여기서 정해진다** — 화면마다 썸네일 그릇이 달라서다.
 * (사용자 확정 규격: 정사각 240 / 남의방만 부동산 매물풍 4:3 160x120)
 * data의 아이템 정의를 읽기만 한다 — 목록을 여기 손으로 베끼지 마라.
 */
interface Target {
  key: string;
  label: string;
  w: number;
  h: number;
  items: { id: string; name: string }[];
}
const TARGETS: Target[] = [
  { key: "shop", label: "쇼핑", w: 240, h: 240, items: SHOP_ITEMS },
  { key: "peemang", label: "피망마켓", w: 240, h: 240, items: PEEMANG_ITEMS },
  { key: "grocery", label: "마켓걸리버", w: 240, h: 240, items: INGREDIENTS },
  { key: "housing", label: "남의방", w: 160, h: 120, items: HOUSINGS },
];

/**
 * 너튜브 영상 카테고리 9종 — `data/videos.ts`의 `VideoAttribute`가 전부다.
 * 타입이 걸려 있어 오타·없는 카테고리는 typecheck에서 잡힌다.
 * (`DEFAULT_VIDEO_ATTRS`는 fitness가 빠진 '기본 노출' 목록이라 여기 쓰면 안 된다 —
 *  운동 스탯 300 초과면 fitness 영상도 뜨므로 그 썸네일도 만들 수 있어야 한다.)
 */
const VIDEO_CATEGORIES: VideoAttribute[] = [
  "idol",
  "actor",
  "anime",
  "fitness",
  "politics",
  "info",
  "animal",
  "humor",
  "gaming",
];

type Mode = "media" | "item" | "youtube" | "adult" | "tweetcat" | "yabam" | "creation" | "events";

/**
 * 이벤트 창 이미지 저장 규격 — 아이템처럼 **선명**(흐림 축 아님). 이벤트 모달에서
 * width:100%·max-height:200px·object-fit:cover로 표시되므로 가로로 넓은 480x240(2:1)로 저장한다.
 */
const EVENT_IMG_W = 480;
const EVENT_IMG_H = 240;

/**
 * 야밤 영상 커버 저장 규격 — `.yabam-vid__cover`가 16:10이라 240x150으로 저장한다.
 * 아이템과 같은 결(선명, id 1:1)이지만 화면별 규격이 아니라 이 한 값으로 고정이다.
 * ⚠️ 두 숫자를 손으로 적지 마라 — 세로는 16:10 비율에서 유도한다(어긋나면 cover가 잘라낸다).
 */
const YABAM_IMG_W = 240;
const YABAM_IMG_H = Math.round((YABAM_IMG_W * 10) / 16); // 150

/**
 * 성인 이미지의 고정 파일명. **사용자가 이름을 짓지 않는다 — 입력칸 자체가 없다.**
 *
 * ⚠️ 여기에 이름 입력을 되살리지 마라. 성인 축의 매칭(systems/mediaImages.ts의
 *    pickAdultImage)은 `tweet.isAdult`만 보고 **파일명을 전혀 읽지 않는다.** 이름을 받으면
 *    "`실루엣`이라고 지으면 실루엣 트윗에 붙겠지"라는 **없는 기대**를 만들 뿐이다.
 *    그 착각을 원천 차단하려고 고정한 것이다(사용자 확정). 장 구분은 서버의 uniqueName이
 *    붙이는 번호(`adult__2`)가 한다.
 */
const ADULT_NAME = "adult";
/** 창작 이미지 자동 파일명 — 성인과 같은 결(파일명이 매칭에 안 쓰인다). 장 구분은 서버 uniqueName의 번호가 한다. */
const CREATION_NAME = "creation";

/** 크롭 상태: 이미지 중심이 무대 어디에 놓이는지(cx,cy) + 확대율(zoom) */
let img: HTMLImageElement | null = null;
let zoom = 1;
let cx = STAGE_W / 2;
let cy = STAGE_W / 2;
let mode: Mode = "media";
let target: Target = TARGETS[0];

/**
 * 트윗 이미지의 저장 규격 — **표시 크기의 1/MEDIA_DIVISOR**(현재 1/6 = 83x40).
 *
 * ## ⚠️ 작은 게 오타가 아니다 — 뭉개는 게 목적이다
 * 트윗 이미지는 **일부러 저해상도로 저장한다. 원본 사진이 뭐였는지 알아볼 수 없게 하려는
 * 것**이 이 값의 존재 이유다(사용자 확정). 화면에서 MEDIA_DIVISOR배로 늘어나 크게 흐려지는데,
 * 그게 **버그가 아니라 기능**이다.
 *
 * 그러니 "화질이 나쁘다"는 이유로 MEDIA_DIVISOR를 낮추지 마라. 낮추는 순간 원본이 식별돼
 * 이 기능이 존재할 이유가 사라진다. 표시 크기(main.css의 `.tweet-media--img`)를 줄여
 * 선명하게 만드는 것도 같은 이유로 안 된다 — 실제로 한 번 그렇게 돼 있었고, 되돌린 것이다.
 *
 * ## ⚠️ 비율은 식으로 묶여 있다 — 손으로 두 숫자를 적지 마라
 * 저장본이 표시 자리(16/9, max-height 240 → 넓은 화면에서 495x240)와 다른 비율이면
 * `object-fit: cover`가 잘라낸다. TWEET_IMG_*를 나눠 쓰는 지금 형태면 비율이 어긋날 수 없다.
 *
 * ⚠️ TWEET_IMG_W/H는 `styles/main.css`의 `.tweet-media`(width:100%, 16/9, max-height:240px)와
 *    한 쌍이다. CSS를 바꾸면 여기도 바꿔라 — 안 그러면 미리보기가 거짓말을 하고 크롭이 어긋난다.
 *
 * 아이템 이미지(`TARGETS`의 240 / 160x120)는 **정반대다** — 상품 사진이라 선명해야 한다.
 * 두 축을 같은 규칙으로 통일하지 마라.
 */
const TWEET_IMG_W = 495;
const TWEET_IMG_H = 240;

/**
 * 저장본이 표시 크기의 몇 분의 1인지. **클수록 더 흐려진다**(=원본을 더 못 알아본다).
 * 5로 시작했다가 "예상보다 선명하다"고 해서 6으로 올렸다(사용자 확정) — 이 값이 이 기능의
 * 세기 조절 손잡이다. 더/덜 흐리게 하려면 여기만 만져라.
 */
const MEDIA_DIVISOR = 6;

const MEDIA_W = Math.round(TWEET_IMG_W / MEDIA_DIVISOR); // 83
const MEDIA_H = Math.round(TWEET_IMG_H / MEDIA_DIVISOR); // 40

/**
 * 너튜브 썸네일의 표시 크기 — 가로 카드(`.tube-card__thumb`, 16/9)의 실측값이다.
 *
 * 트윗과 **같은 이유로** 여기도 1/MEDIA_DIVISOR로 저장한다(원본 사진을 알아볼 수 없게).
 * 그러니 "화질이 나쁘다"고 나누기를 걷어내지 마라 — 흐린 게 이 축의 존재 이유다.
 *
 * ⚠️ 쇼츠(`.tube__short-thumb`, 150x267, 9:16)도 **이 가로 이미지를 그대로** 쓴다.
 *    object-fit:cover가 좌우를 크게 잘라내는데 그게 의도다(사용자 확정) —
 *    쇼츠용 세로 규격을 여기 추가하지 마라.
 *
 * ⚠️ 두 숫자를 손으로 적지 마라. 나눠 쓰는 지금 형태여야 저장본과 표시 자리의 비율이
 *    어긋나지 않는다(어긋나면 cover가 잘라낸다).
 */
const TUBE_IMG_W = 285;
const TUBE_IMG_H = 160;

const TUBE_W = Math.round(TUBE_IMG_W / MEDIA_DIVISOR); // 48
const TUBE_H = Math.round(TUBE_IMG_H / MEDIA_DIVISOR); // 27

/**
 * WebP 품질(0~1). `toDataURL`의 기본값은 0.92인데, 그건 이 게임엔 너무 후하다 —
 * 이미지가 늘어날수록 저장소·번들이 그대로 불어난다.
 *
 * 실측(240x240, 노이즈 많은 사진류 기준. 기본 0.92 = 20.0KB):
 * | q | 용량 | 기본 대비 |
 * |---|---|---|
 * | 0.92 | 20.0KB | 100% |
 * | 0.80 | 10.5KB | 53% |
 * | 0.70 | 7.7KB | **38%** |
 * | 0.60 | 6.6KB | 33% |
 * | 0.50 | 5.7KB | 29% |
 * 0.7 아래로는 줄어드는 폭이 급격히 작아진다(6.6→5.7→4.9). 거기가 무릎이다.
 *
 * **모드마다 다른 값을 쓰는 건 의도다:**
 * - 트윗·성인(83x40)·너튜브(48x27)는 **일부러 흐리게 만드는 게 목적**이라(MEDIA_W·TUBE_IMG_W 주석)
 *   품질을 아낄 이유가 없다. 게다가 이 크기면 q를 최저로 내려도 장당 1KB 남짓밖에 못 아낀다 —
 *   용량 문제의 원인이 아니다. 너튜브는 트윗보다도 작아(1/4 픽셀) 더더욱 그렇다.
 * - 아이템(240x240)은 **상품 사진이라 선명해야 한다.** 여기가 용량의 대부분이다
 *   (아이템 60종 × 20KB ≈ 1.2MB → 0.7이면 460KB).
 * 세 값을 하나로 통일하지 마라. 어느 한쪽이 반드시 손해를 본다.
 */
const WEBP_QUALITY: Record<Mode, number> = {
  media: 0.5,
  item: 0.7,
  youtube: 0.5,
  // 성인·트윗 카테고리는 트윗과 같은 자리(.tweet-media)에 같은 규격으로 그려진다 —
  // 값이 갈릴 이유가 없다.
  adult: 0.5,
  tweetcat: 0.5,
  // 창작도 트윗과 같은 자리(.tweet-media)에 그려진다 — 성인·트윗 카테고리와 같은 0.5.
  creation: 0.5,
  // 야밤 커버는 아이템과 같은 결(선명해야 하는 상품/영상 이미지)이라 0.7.
  yabam: 0.7,
  // 이벤트 이미지도 선명해야 하는 장면 이미지라 아이템과 같은 0.7.
  events: 0.7,
};

/**
 * 지금 저장될 규격. 트윗·성인·트윗 카테고리·너튜브는 표시 크기의 1/MEDIA_DIVISOR 고정,
 * 아이템은 화면이 정한다.
 * (성인·트윗 카테고리는 트윗과 같은 자리에 그려지므로 MEDIA_W/H를 그대로 쓴다 —
 *  새 상수를 만들지 마라.)
 */
function outSize(): { w: number; h: number } {
  if (mode === "item") return { w: target.w, h: target.h };
  if (mode === "yabam") return { w: YABAM_IMG_W, h: YABAM_IMG_H };
  if (mode === "events") return { w: EVENT_IMG_W, h: EVENT_IMG_H };
  return mode === "youtube" ? { w: TUBE_W, h: TUBE_H } : { w: MEDIA_W, h: MEDIA_H };
}
/** 무대 세로 — 무대가 곧 크롭 영역이라 저장 비율과 같아야 한다. */
function stageH(): number {
  const { w, h } = outSize();
  return Math.round((STAGE_W * h) / w);
}
/**
 * 지금 저장될 파일명(=미디어는 키워드, 아이템은 id, 너튜브는 영상 카테고리,
 * 트윗 카테고리는 트윗 속성, 성인은 고정).
 */
function outName(): string {
  if (mode === "item") return itemSelect.value;
  if (mode === "yabam") return yabamSelect.value;
  if (mode === "events") return eventSelect.value;
  if (mode === "adult") return ADULT_NAME;
  if (mode === "creation") return CREATION_NAME;
  if (mode === "tweetcat") return tweetCatSelect.value;
  return mode === "youtube" ? catSelect.value : nameInput.value.trim();
}

const stageCanvas = el("canvas", {});
const outCanvas = el("canvas", {});
const zoomCanvas = el("canvas", { class: "zoom" });
const nameInput = el("input", { type: "text", placeholder: "예: 커피 (확장자 없이)" });
const itemSelect = el("select", {});
const catSelect = el("select", {});
const tweetCatSelect = el("select", {});
const yabamSelect = el("select", {});
const eventSelect = el("select", {});
eventSelect.replaceChildren(
  ...GAME_EVENTS.map((e) => el("option", { value: e.id }, `${e.id} — ${e.title}`)),
);
const screenSelect = el("select", {});
const saveBtn = el("button", { class: "btn" }, "저장");
const msg = el("div", { class: "msg" });
const outCap = el("figcaption", {});
const zoomCap = el("figcaption", {}, "확대");
const savedBox = el("div", {});
const savedTitle = el("h2", {});

function setMsg(text: string, kind?: "ok" | "err"): void {
  msg.className = "msg" + (kind ? ` msg--${kind}` : "");
  msg.textContent = text;
}

/** 무대를 꽉 채우는(cover) 기본 배율 — 여기에 zoom을 곱한다. */
function baseScale(): number {
  if (!img) return 1;
  return Math.max(STAGE_W / img.naturalWidth, stageH() / img.naturalHeight);
}

/** 같은 크롭을 width 해상도로 그린다(무대=320폭, 출력=규격폭). 한 함수라 미리보기가 곧 결과다. */
function draw(canvas: HTMLCanvasElement, width: number): void {
  const c = canvas.getContext("2d");
  if (!c) return;
  c.clearRect(0, 0, canvas.width, canvas.height);
  if (!img) return;
  const k = width / STAGE_W;
  const s = baseScale() * zoom * k;
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  c.drawImage(img, cx * k - w / 2, cy * k - h / 2, w, h);
}

/** 규격이 바뀌면(모드·화면 전환) 캔버스와 무대의 실제 픽셀 크기를 다시 잡는다. */
function resize(): void {
  const { w, h } = outSize();
  const sh = stageH();
  stageCanvas.width = STAGE_W;
  stageCanvas.height = sh;
  stage.style.height = `${sh}px`;
  for (const c of [outCanvas, zoomCanvas]) {
    c.width = w;
    c.height = h;
  }
  // 저장 크기 그대로 한 번 + 게임에서 실제로 보일 크기 한 번.
  outCanvas.style.width = `${w}px`;
  outCanvas.style.height = `${h}px`;
  outCap.textContent = `실제 ${w}x${h}`;

  // 트윗·너튜브는 게임의 표시 크기(495x240 · 285x160) 그대로 띄운다. 흐리게 만드는 게 목적인
  // 이미지라 '임의의 200% 확대'로는 판정이 안 되고, **플레이어가 실제로 볼 크기**로 봐야
  // 원본이 알아볼 만한지 아닌지를 알 수 있다 — 그게 이 미리보기의 존재 이유다.
  // 아이템은 반대다: 저장본이 표시 크기보다 크고(240 → 화면 ~180) 선명해야 하는 쪽이라
  // '실제 크기'로 띄우면 판정이 안 된다. 디테일을 보라고 확대를 유지한다.
  // 아이템·야밤은 선명 규격(저장본 확대 미리보기 + pixelated) — 흐림 축과 반대.
  const blurry = mode !== "item" && mode !== "yabam";
  const zw = blurry
    ? mode === "youtube"
      ? TUBE_IMG_W
      : TWEET_IMG_W
    : Math.min(w * 2, ZOOM_MAX_W);
  zoomCanvas.style.width = `${zw}px`;
  zoomCanvas.style.height = `${Math.round((zw * h) / w)}px`;
  zoomCap.textContent = blurry
    ? `${mode === "youtube" ? "너튜브" : "트윗"} 실제 크기 (${zw}x${Math.round((zw * h) / w)})`
    : `확대 (${Math.round((zw / w) * 100)}%)`;
  // ⚠️ .zoom에는 image-rendering:pixelated가 걸려 있다(픽셀을 뜯어보라고 넣은 것).
  //    트윗·너튜브 모드에선 그걸 벗겨야 한다 — 게임은 이미지를 **부드럽게** 늘리므로, 픽셀을
  //    각지게 그리면 미리보기가 실물과 다른 그림이 된다. 흐릿함을 판정하러 보는 화면이
  //    거짓말을 하면 이 미리보기는 있으나 마나다.
  zoomCanvas.classList.toggle("zoom", !blurry);
  saveBtn.textContent = `${w}x${h} WebP로 저장`;
}

function redraw(): void {
  draw(stageCanvas, STAGE_W);
  draw(outCanvas, outSize().w);
  draw(zoomCanvas, outSize().w);
  validate();
}

/** 저장 전에 파일명 규칙을 검사해 즉시 알린다(서버가 400을 주기 전에). */
function validate(): boolean {
  const name = outName();
  const ok = SAFE_NAME.test(name);
  if (mode === "media") nameInput.classList.toggle("bad", name.length > 0 && !ok);
  saveBtn.disabled = !ok || !img;
  return ok;
}

function loadFile(file: File): void {
  if (!file.type.startsWith("image/")) {
    setMsg("이미지 파일만 열 수 있습니다.", "err");
    return;
  }
  const url = URL.createObjectURL(file);
  const next = new Image();
  next.onload = () => {
    img = next;
    zoom = 1;
    cx = STAGE_W / 2;
    cy = stageH() / 2;
    URL.revokeObjectURL(url);
    // 아이템 모드의 파일명은 고른 id다 — 파일 이름을 끌어오면 안 된다.
    if (mode === "media" && !nameInput.value) nameInput.value = file.name.replace(/\.[^.]+$/, "");
    setMsg("");
    redraw();
  };
  next.onerror = () => {
    URL.revokeObjectURL(url);
    setMsg("이미지를 읽지 못했습니다.", "err");
  };
  next.src = url;
}

async function save(): Promise<void> {
  if (!img || !validate()) return;
  const dataUrl = outCanvas.toDataURL("image/webp", WEBP_QUALITY[mode]);
  // ⚠️ webp 미지원 브라우저는 toDataURL이 조용히 PNG를 뱉는다. 서버도 거부하지만 여기서 먼저 잡는다.
  if (!dataUrl.startsWith("data:image/webp")) {
    setMsg("이 브라우저는 WebP 변환을 지원하지 않습니다(PNG로 대체됨). 저장하지 않았습니다.", "err");
    return;
  }
  saveBtn.disabled = true;
  setMsg("저장 중…");
  try {
    const res = await fetch("/__admin/save-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // dir는 서버가 아는 키만 받는다(자유 경로가 아니다). item 모드만 키 이름이 다르다(items).
      body: JSON.stringify({
        dir: mode === "item" ? "items" : mode,
        name: outName(),
        dataUrl,
      }),
    });
    // 빌드된 사이트엔 이 엔드포인트가 없다 — 404는 HTML을 주므로 res.json()이 터진다.
    // 상태코드가 아니라 content-type으로 가른다(400 JSON은 서버 문구를 그대로 보여줘야 하므로).
    if (!res.headers.get("content-type")?.includes("application/json")) {
      setMsg("개발 서버(npm run dev)에서만 저장됩니다.", "err");
      return;
    }
    const body = (await res.json()) as {
      ok: boolean;
      path?: string;
      name?: string;
      error?: string;
    };
    if (!body.ok) {
      setMsg(body.error ?? "저장에 실패했습니다.", "err");
      return;
    }
    // 서버가 중복을 비켜 다른 이름으로 저장했을 수 있다(커피 → 커피__2, animal → animal__2).
    // 그걸 알려주지 않으면 사용자는 덮어썼다고 오해한다. 매칭 키는 그대로라는 것도 함께 짚는다.
    const renamed = body.name && body.name !== outName();
    const kb = (Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75) / 1024).toFixed(1);
    // 조사까지 넣어 둔다 — '속성'은 받침이 있어 '는'이 아니라 '은'이다(속성는 ✗).
    const keyWord = mode === "youtube" ? "카테고리는" : mode === "tweetcat" ? "속성은" : "키워드는";
    // 성인은 이름이 고정이라 번호가 붙는 게 정상 동작이다 — 개명 경고를 띄우면 안 된다.
    // ('키워드는 그대로'라고 안내하는 것도 거짓말이다. 성인 축엔 키워드가 없다.)
    const note =
      renamed && mode !== "adult" && mode !== "creation"
        ? `저장됨: ${body.path} · ${kb}KB — 같은 이름이 있어 '${body.name}'로 저장했습니다(${keyWord} '${outName()}' 그대로).`
        : `저장됨: ${body.path} · ${kb}KB`;
    // 저장하면 src/ 아래에 파일이 생겨 dev 서버가 이 페이지를 통째로 새로고침한다
    // (data/*Images.ts의 eager glob이 갱신되며 full reload). 그래서 화면에 띄운 성공
    // 문구가 즉시 날아간다 — 새로고침 뒤에도 살아남도록 sessionStorage로 넘긴다.
    sessionStorage.setItem(SAVED_MSG_KEY, note);
    // 새로고침 후 같은 모드·선택으로 돌아오도록 현재 선택을 넘긴다.
    sessionStorage.setItem(
      SAVED_SEL_KEY,
      JSON.stringify({
        mode,
        screen: screenSelect.value,
        cat: catSelect.value,
        tweetCat: tweetCatSelect.value,
        yabam: yabamSelect.value,
      }),
    );
    setMsg(note, "ok");
  } catch (e) {
    setMsg(`저장 실패: ${String(e)}`, "err");
  } finally {
    validate();
  }
}

/* ===================== 모드 · 화면 · 아이템 선택 ===================== */

/** 아이템 목록 — 이미 이미지가 있으면 ✓. 없으면 뭐가 비었는지 몰라 중복·누락이 난다. */
function fillItems(): void {
  itemSelect.replaceChildren(
    ...target.items.map((it) =>
      el(
        "option",
        { value: it.id },
        `${ITEM_IMAGES[it.id] ? "✓" : "—"} ${it.name} (${it.id})`,
      ),
    ),
  );
}

/** 그 카테고리에 저장된 썸네일 장수. 한 카테고리에 여러 장을 둘 수 있어 개수가 곧 정보다. */
function tubeCount(cat: string): number {
  return YOUTUBE_IMAGES.filter((y) => y.category === cat).length;
}

/**
 * 너튜브 카테고리 목록 — 이미 이미지가 있으면 ✓와 장수. 없으면 뭐가 비었는지 몰라 누락이 난다.
 * 아이템과 달리 ✓가 "끝났다"는 뜻이 아니다(여러 장을 더 넣을 수 있다).
 */
function fillCats(): void {
  catSelect.replaceChildren(
    ...VIDEO_CATEGORIES.map((c) => {
      const n = tubeCount(c);
      return el("option", { value: c }, `${n > 0 ? `✓${n}장` : "—"} ${ATTRIBUTES[c].label} (${c})`);
    }),
  );
}

/** 야밤 영상 목록 — 이미 커버가 있으면 ✓. 아이템과 같은 id 1:1이라 ✓는 "교체 대상"이다. */
function fillYabam(): void {
  yabamSelect.replaceChildren(
    ...YABAM_VIDEOS.map((v) =>
      el("option", { value: v.id }, `${YABAM_IMAGES[v.id] ? "✓" : "—"} ${v.title} (${v.id})`),
    ),
  );
}

/** 그 트윗 속성에 저장된 이미지 장수. 한 속성에 여러 장을 둘 수 있어 개수가 곧 정보다. */
function tweetCatCount(attr: string): number {
  return TWEET_CAT_IMAGES.filter((t) => t.attribute === attr).length;
}

/**
 * 트윗 카테고리 목록 — `TWEET_CAT_IDS`(현재 아이돌·애니)를 그대로 읽는다.
 * **속성을 늘리려면 여기가 아니라 data/tweetCatImages.ts의 배열에 한 줄 추가하면 된다.**
 * 라벨은 ATTRIBUTES를 쓴다("아이돌덕"·"애니덕") — 게임 화면이 아니라 어드민이라 그대로 쓴다.
 */
function fillTweetCats(): void {
  tweetCatSelect.replaceChildren(
    ...TWEET_CAT_IDS.map((id) => {
      const n = tweetCatCount(id);
      return el("option", { value: id }, `${n > 0 ? `✓${n}장` : "—"} ${ATTRIBUTES[id].label} (${id})`);
    }),
  );
}

/** 이미 저장된 것들 — 뭐가 있는지 모르면 같은 걸 또 만든다. */
function fillSaved(): void {
  if (mode === "tweetcat") {
    savedTitle.textContent = `저장된 트윗 카테고리 이미지 (${TWEET_CAT_IMAGES.length})`;
    savedBox.replaceChildren(
      el(
        "div",
        { class: "saved" },
        ...TWEET_CAT_IDS.flatMap((id) => {
          const shots = TWEET_CAT_IMAGES.filter((t) => t.attribute === id);
          if (shots.length === 0) {
            return [
              el(
                "div",
                { class: "saved__item saved__item--empty" },
                el("div", { class: "saved__none" }, "없음"),
                el("div", { class: "saved__kw" }, ATTRIBUTES[id].label),
              ),
            ];
          }
          // 파일명(file)을 보여준다 — 한 속성에 여러 장이 있을 수 있어(idol/idol__2),
          // 속성으로 찍으면 목록에 같은 글자가 여러 번 뜨고 어느 게 어느 장인지 알 수 없다.
          return shots.map((t) =>
            el(
              "div",
              { class: "saved__item" },
              el("img", { src: t.url, alt: t.file }),
              el("div", { class: "saved__kw" }, t.file),
              el("div", { class: "saved__kw", style: "opacity:.6" }, ATTRIBUTES[id].label),
            ),
          );
        }),
      ),
    );
    return;
  }
  if (mode === "youtube") {
    savedTitle.textContent = `저장된 너튜브 썸네일 (${YOUTUBE_IMAGES.length})`;
    savedBox.replaceChildren(
      el(
        "div",
        { class: "saved" },
        ...VIDEO_CATEGORIES.flatMap((c) => {
          const shots = YOUTUBE_IMAGES.filter((y) => y.category === c);
          if (shots.length === 0) {
            return [
              el(
                "div",
                { class: "saved__item saved__item--empty" },
                el("div", { class: "saved__none" }, "없음"),
                el("div", { class: "saved__kw" }, ATTRIBUTES[c].label),
              ),
            ];
          }
          // 파일명(file)을 보여준다 — 한 카테고리에 여러 장이 있을 수 있어(animal/animal__2),
          // 카테고리로 찍으면 목록에 같은 글자가 여러 번 뜨고 어느 게 어느 장인지 알 수 없다.
          return shots.map((y) =>
            el(
              "div",
              { class: "saved__item" },
              el("img", { src: y.url, alt: y.file }),
              el("div", { class: "saved__kw" }, y.file),
              el("div", { class: "saved__kw", style: "opacity:.6" }, ATTRIBUTES[c].label),
            ),
          );
        }),
      ),
    );
    return;
  }
  if (mode === "adult") {
    // 몇 장인지가 곧 정보다 — 성인 트윗은 이 풀 전체에서 해시로 하나가 뽑히므로,
    // 장수가 그대로 "얼마나 다양하게 보이는가"다. 키워드가 없어 보여줄 게 파일명뿐이다.
    savedTitle.textContent = `저장된 성인 트윗 이미지 (${ADULT_IMAGES.length})`;
    savedBox.replaceChildren(
      ADULT_IMAGES.length === 0
        ? el("div", { class: "saved__empty" }, "아직 저장된 이미지가 없습니다.")
        : el(
            "div",
            { class: "saved" },
            ...ADULT_IMAGES.map((a) =>
              el(
                "div",
                { class: "saved__item" },
                el("img", { src: a.url, alt: a.file }),
                el("div", { class: "saved__kw" }, a.file),
              ),
            ),
          ),
    );
    return;
  }
  if (mode === "creation") {
    // 성인과 같은 결 — 장수가 곧 다양성이다(창작 트윗이 이 풀에서 해시로 하나를 뽑는다).
    savedTitle.textContent = `저장된 창작 이미지 (${CREATION_IMAGES.length})`;
    savedBox.replaceChildren(
      CREATION_IMAGES.length === 0
        ? el("div", { class: "saved__empty" }, "아직 저장된 이미지가 없습니다.")
        : el(
            "div",
            { class: "saved" },
            ...CREATION_IMAGES.map((c) =>
              el(
                "div",
                { class: "saved__item" },
                el("img", { src: c.url, alt: c.file }),
                el("div", { class: "saved__kw" }, c.file),
              ),
            ),
          ),
    );
    return;
  }
  if (mode === "media") {
    savedTitle.textContent = `저장된 트윗 이미지 (${MEDIA_IMAGES.length})`;
    savedBox.replaceChildren(
      MEDIA_IMAGES.length === 0
        ? el("div", { class: "saved__empty" }, "아직 저장된 이미지가 없습니다.")
        : el(
            "div",
            { class: "saved" },
            // 파일명(file)을 보여준다 — 같은 키워드에 여러 장이 있을 수 있어(커피/커피__2),
            // keyword로 찍으면 목록에 '커피'가 여러 번 뜨고 어느 게 어느 장인지 알 수 없다.
            ...MEDIA_IMAGES.map((m) =>
              el(
                "div",
                { class: "saved__item" },
                el("img", { src: m.url, alt: m.file }),
                el("div", { class: "saved__kw" }, m.file),
                // 접미사가 붙은 장은 어떤 키워드로 매칭되는지 따로 알려준다.
                m.file !== m.keyword
                  ? el("div", { class: "saved__kw", style: "opacity:.6" }, `→ ${m.keyword}`)
                  : null,
              ),
            ),
          ),
    );
    return;
  }
  if (mode === "yabam") {
    const doneY = YABAM_VIDEOS.filter((v) => YABAM_IMAGES[v.id]);
    savedTitle.textContent = `야밤 영상 커버 (${doneY.length}/${YABAM_VIDEOS.length})`;
    savedBox.replaceChildren(
      el(
        "div",
        { class: "saved" },
        ...YABAM_VIDEOS.map((v) => {
          const url = YABAM_IMAGES[v.id];
          return el(
            "div",
            { class: "saved__item" + (url ? "" : " saved__item--empty") },
            url
              ? el("img", { src: url, alt: v.title })
              : el("div", { class: "saved__none" }, "없음"),
            el("div", { class: "saved__kw" }, `${v.title} (${v.id})`),
          );
        }),
      ),
    );
    return;
  }
  if (mode === "events") {
    const doneE = GAME_EVENTS.filter((e) => EVENT_IMAGES[e.id]);
    savedTitle.textContent = `이벤트 이미지 (${doneE.length}/${GAME_EVENTS.length})`;
    savedBox.replaceChildren(
      el(
        "div",
        { class: "saved" },
        ...GAME_EVENTS.map((e) => {
          const url = EVENT_IMAGES[e.id];
          return el(
            "div",
            { class: "saved__item" + (url ? "" : " saved__item--empty") },
            url
              ? el("img", { src: url, alt: e.title })
              : el("div", { class: "saved__none" }, "없음"),
            el("div", { class: "saved__kw" }, `${e.title} (${e.id})`),
          );
        }),
      ),
    );
    return;
  }
  const done = target.items.filter((it) => ITEM_IMAGES[it.id]);
  savedTitle.textContent = `${target.label} 이미지 (${done.length}/${target.items.length})`;
  savedBox.replaceChildren(
    el(
      "div",
      { class: "saved" },
      ...target.items.map((it) => {
        const url = ITEM_IMAGES[it.id];
        return el(
          "div",
          { class: "saved__item" + (url ? "" : " saved__item--empty") },
          url
            ? el("img", { src: url, alt: it.name })
            : el("div", { class: "saved__none" }, "없음"),
          el("div", { class: "saved__kw" }, it.name),
        );
      }),
    ),
  );
}

/** 모드/화면이 바뀌면: 규격·폼·목록을 한꺼번에 맞춘다. */
function apply(): void {
  const isItem = mode === "item";
  const isTube = mode === "youtube";
  const isAdult = mode === "adult";
  const isTweetCat = mode === "tweetcat";
  const isYabam = mode === "yabam";
  const isCreation = mode === "creation";
  const isEvents = mode === "events";
  itemRow.style.display = isItem ? "" : "none";
  screenRow.style.display = isItem ? "" : "none";
  catRow.style.display = isTube ? "" : "none";
  tweetCatRow.style.display = isTweetCat ? "" : "none";
  yabamRow.style.display = isYabam ? "" : "none";
  eventRow.style.display = isEvents ? "" : "none";
  // 이벤트 모드: 고른 이벤트의 내용(제목·설명·선택지)을 옆에 띄운다.
  eventInfo.style.display = isEvents ? "" : "none";
  if (isEvents) {
    const ev = GAME_EVENTS.find((e) => e.id === eventSelect.value);
    eventInfo.replaceChildren(
      el("div", { class: "event-info__title" }, ev ? ev.title : "—"),
      el("div", { class: "event-info__desc" }, ev ? ev.description : ""),
      ...(ev
        ? ev.choices.map((c) => el("div", { class: "event-info__choice" }, `▸ ${c.label} — ${c.result}`))
        : []),
    );
  }
  // 파일명 입력은 트윗(키워드) 전용이다 — 아이템은 id, 너튜브는 영상 카테고리, 트윗 카테고리는
  // 트윗 속성을 목록에서 고르고, 성인은 이름이 아무 역할도 안 해서 아예 묻지 않는다
  // (ADULT_NAME 주석). 여기에 트윗 카테고리용 이름 입력을 되살리지 마라 — 매칭이 속성
  // 정확일치라 목록에 없는 이름은 어떤 트윗에도 안 붙는다(사용자 확정).
  const named = isItem || isTube || isAdult || isTweetCat || isYabam || isCreation || isEvents;
  nameRow.style.display = named ? "none" : "";
  mediaNotes.style.display = named ? "none" : "";
  itemNote.style.display = named ? "" : "none";
  if (isTweetCat) {
    const n = tweetCatCount(tweetCatSelect.value);
    itemNote.textContent =
      `트윗 카테고리 이미지 ${MEDIA_W}x${MEDIA_H} (트윗과 같은 규격 — 표시 ${TWEET_IMG_W}x${TWEET_IMG_H}의 1/${MEDIA_DIVISOR}, 일부러 흐리게).` +
      ` 파일명은 트윗 속성(${tweetCatSelect.value || "—"})으로 저장되고, 같은 속성에 여러 장을 두면` +
      ` 트윗 id 해시로 하나가 뽑힙니다. 현재 ${n}장.` +
      ` 본문 글자가 아니라 tweet.attribute 정확일치입니다(키워드 모드와 다릅니다).` +
      ` ⚠️ 이 축은 성인 축을 이깁니다 — 성인물 보기를 켜도 아이돌 트윗엔 아이돌 이미지가 붙습니다.`;
  } else if (isAdult) {
    itemNote.textContent =
      `성인 트윗 이미지 ${MEDIA_W}x${MEDIA_H} (트윗과 같은 규격 — 표시 ${TWEET_IMG_W}x${TWEET_IMG_H}의 1/${MEDIA_DIVISOR}, 일부러 흐리게).` +
      ` 파일명은 '${ADULT_NAME}'으로 자동 저장됩니다(adult, adult__2 …) — 이름은 매칭에 쓰이지 않습니다.` +
      ` 성인 미디어 트윗이면 저장된 ${ADULT_IMAGES.length}장 전체가 후보이고, 트윗 id 해시로 하나가 뽑힙니다.` +
      ` 키워드가 없으니 '어떤 트윗에 붙일지'는 고를 수 없습니다.`;
  } else if (isCreation) {
    itemNote.textContent =
      `창작 이미지 ${MEDIA_W}x${MEDIA_H} (트윗과 같은 규격 — 표시 ${TWEET_IMG_W}x${TWEET_IMG_H}의 1/${MEDIA_DIVISOR}, 일부러 흐리게).` +
      ` 파일명은 '${CREATION_NAME}'으로 자동 저장됩니다(creation, creation__2 …) — 이름은 매칭에 쓰이지 않습니다.` +
      ` 1차/2차 창작 트윗이면 저장된 ${CREATION_IMAGES.length}장 전체가 후보이고, 트윗 id 해시로 하나가 뽑힙니다.` +
      ` 창작 트윗은 무조건 미디어 형태이고, 이 축이 계열(애니)·성인 축보다 먼저입니다.`;
  } else if (isEvents) {
    itemNote.textContent =
      `이벤트 이미지 ${EVENT_IMG_W}x${EVENT_IMG_H} (아이템처럼 선명).` +
      ` 파일명은 이벤트 id(${eventSelect.value || "—"})로 저장되고, id 1:1 매칭입니다(확률·해시 없음).` +
      ` 같은 이벤트를 다시 저장하면 이미지가 교체됩니다. 이벤트 창(선택지·결과 화면) 상단에 붙습니다.`;
  } else if (isItem) {
    itemNote.textContent = `${target.label} 규격 ${target.w}x${target.h} · 파일명은 아이템 id(${itemSelect.value || "—"})로 저장됩니다.`;
  } else if (isYabam) {
    itemNote.textContent =
      `야밤 영상 커버 ${YABAM_IMG_W}x${YABAM_IMG_H} (16:10, 아이템처럼 선명).` +
      ` 파일명은 영상 id(${yabamSelect.value || "—"})로 저장되고, id 1:1 정확 매칭입니다(확률·해시 없음).` +
      ` 같은 영상을 다시 저장하면 커버가 교체됩니다.`;
  } else if (isTube) {
    const n = tubeCount(catSelect.value);
    itemNote.textContent =
      `너튜브 썸네일 ${TUBE_W}x${TUBE_H} (표시 ${TUBE_IMG_W}x${TUBE_IMG_H}의 1/${MEDIA_DIVISOR} — 일부러 흐리게).` +
      ` 파일명은 카테고리(${catSelect.value || "—"})로 저장되고, 같은 카테고리에 여러 장을 두면` +
      ` 영상 id 해시로 하나가 뽑힙니다. 현재 ${n}장.` +
      ` 쇼츠(9:16)에도 이 가로 이미지가 좌우 잘려서 들어갑니다.`;
  } else {
    itemNote.textContent = "";
  }
  // 규격이 바뀌면 크롭 중심도 새 무대 기준으로 되돌린다(안 그러면 이미지가 무대 밖에 남는다).
  cx = STAGE_W / 2;
  cy = stageH() / 2;
  resize();
  fillSaved();
  redraw();
}

const modeSelect = el(
  "select",
  {},
  el("option", { value: "media" }, "미디어 트윗 (키워드 부분일치)"),
  el("option", { value: "item" }, "아이템 (id 1:1)"),
  el("option", { value: "youtube" }, "너튜브 (카테고리 정확일치)"),
  el("option", { value: "adult" }, "성인 트윗 (isAdult 매칭 · 이름 없음)"),
  el("option", { value: "tweetcat" }, "트윗 카테고리 (속성 정확일치)"),
  el("option", { value: "yabam" }, "야밤 영상 (id 1:1)"),
  el("option", { value: "creation" }, "창작 (1차·2차 매칭 · 이름 없음)"),
  el("option", { value: "events" }, "이벤트 (id 1:1 · 선명)"),
);
const MODES: Mode[] = ["media", "item", "youtube", "adult", "tweetcat", "yabam", "creation", "events"];
modeSelect.addEventListener("change", () => {
  mode = MODES.find((m) => m === modeSelect.value) ?? "media";
  apply();
});
catSelect.addEventListener("change", () => apply());
tweetCatSelect.addEventListener("change", () => apply());
yabamSelect.addEventListener("change", () => apply());
eventSelect.addEventListener("change", () => apply());

screenSelect.replaceChildren(
  ...TARGETS.map((t) => el("option", { value: t.key }, `${t.label} (${t.w}x${t.h})`)),
);
screenSelect.addEventListener("change", () => {
  target = TARGETS.find((t) => t.key === screenSelect.value) ?? TARGETS[0];
  fillItems();
  apply();
});
itemSelect.addEventListener("change", () => apply());

/* ===================== 상호작용(드래그 이동 · 휠/슬라이더 확대) ===================== */

const zoomRange = el("input", { type: "range", min: "1", max: "5", step: "0.01", value: "1" });

function setZoom(next: number): void {
  zoom = Math.min(5, Math.max(1, next));
  zoomRange.value = String(zoom);
  redraw();
}

const stage = el(
  "div",
  { class: "stage" },
  stageCanvas,
  el("div", { class: "stage__hint" }, "드래그로 이동 · Shift+드래그 축 고정 · 휠로 확대/축소"),
);

let dragging = false;
let lastX = 0;
let lastY = 0;
// 드래그 시작점 + 그때의 크롭 중심. Shift 축 고정은 '이동량'을 기준으로 하므로 시작점이 필요하다.
let startX = 0;
let startY = 0;
let baseCx = 0;
let baseCy = 0;
stage.addEventListener("pointerdown", (e: PointerEvent) => {
  if (!img) return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  startX = e.clientX;
  startY = e.clientY;
  baseCx = cx;
  baseCy = cy;
  stage.classList.add("stage--drag");
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener("pointermove", (e: PointerEvent) => {
  if (!dragging) return;
  // 무대는 CSS로 320px 폭 그대로라 클라이언트 픽셀 = 무대 좌표.
  if (e.shiftKey) {
    // Shift: 시작점 대비 더 많이 움직인 축 하나로 고정(수직 또는 수평만).
    // 시작점 기준이라 '지배 축'이 드래그 도중 흔들리지 않는다(마지막 프레임 기준이면 떨린다).
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) >= Math.abs(dy)) {
      cx = baseCx + dx;
      cy = baseCy;
    } else {
      cx = baseCx;
      cy = baseCy + dy;
    }
  } else {
    cx += e.clientX - lastX;
    cy += e.clientY - lastY;
  }
  lastX = e.clientX;
  lastY = e.clientY;
  redraw();
});
const endDrag = (e: PointerEvent) => {
  if (!dragging) return;
  dragging = false;
  stage.classList.remove("stage--drag");
  stage.releasePointerCapture(e.pointerId);
};
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);
stage.addEventListener(
  "wheel",
  (e: WheelEvent) => {
    if (!img) return;
    e.preventDefault();
    setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  },
  { passive: false },
);
zoomRange.addEventListener("input", () => setZoom(Number(zoomRange.value)));
nameInput.addEventListener("input", () => validate());
saveBtn.addEventListener("click", () => void save());

/* ===================== 화면 ===================== */

const fileInput = el("input", { type: "file", accept: "image/*" });
fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) loadFile(f);
});

const drop = el(
  "div",
  { class: "drop" },
  el("div", {}, "이미지를 여기로 끌어다 놓거나, 파일을 선택하세요"),
  el("div", { style: "margin-top:8px" }, fileInput),
);
for (const type of ["dragenter", "dragover"]) {
  drop.addEventListener(type, (e) => {
    e.preventDefault();
    drop.classList.add("drop--over");
  });
}
for (const type of ["dragleave", "drop"]) {
  drop.addEventListener(type, () => drop.classList.remove("drop--over"));
}
drop.addEventListener("drop", (e: DragEvent) => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (f) loadFile(f);
});

const screenRow = el("div", { class: "row" }, el("label", {}, "화면"), screenSelect);
const itemRow = el("div", { class: "row" }, el("label", {}, "아이템"), itemSelect);
const catRow = el("div", { class: "row" }, el("label", {}, "카테고리"), catSelect);
const tweetCatRow = el("div", { class: "row" }, el("label", {}, "트윗 속성"), tweetCatSelect);
const yabamRow = el("div", { class: "row" }, el("label", {}, "야밤 영상"), yabamSelect);
const eventRow = el("div", { class: "row" }, el("label", {}, "이벤트"), eventSelect);
/** 이벤트 모드에서 선택한 이벤트의 내용(제목·설명·선택지)을 보여주는 패널 — '내용 보면서 등록'. */
const eventInfo = el("div", { class: "event-info" });
const nameRow = el("div", { class: "row" }, el("label", {}, "파일명"), nameInput);
const itemNote = el("p", { class: "note" });
const mediaNotes = el(
  "div",
  {},
  el(
    "p",
    { class: "note" },
    "한글·영문·숫자·공백·_·- 만, 1~50자. 게임 속 미디어 트윗에 나오는 단어로 지어야 자동으로 붙습니다. " +
      "'핸드폰 배터리'처럼 공백을 넣으면 그 구절이 통째로 들어간 트윗에만 붙습니다.",
  ),
  // 실측 경고 — 이 두 단어는 프롬프트의 구조적 접미사라("…담은 사진") 무차별 매칭된다.
  // 가장 자연스럽게 고를 법한 파일명이 하필 가장 위험해서 여기 적어둔다.
  el(
    "p",
    { class: "note note--warn" },
    "⚠️ '사진'·'영상'은 피하세요 — 미디어 트윗의 59%·20%에 무차별로 붙습니다. " +
      "'커피'·'고양이'처럼 두 글자 이상 내용어가 안전합니다(1~5%).",
  ),
);

const root = document.getElementById("app");
if (root) {
  mount(
    root,
    el(
      "header",
      { class: "top" },
      el("h1", {}, "🖼 어드민 · 이미지 편집기"),
      el("div", {
        class: "sub",
        html:
          '트윗 이미지(키워드) · 아이템 이미지(id 1:1) · 너튜브 썸네일(카테고리) · 성인 트윗(isAdult) · ' +
          '트윗 카테고리(속성) · 야밤 영상(id 1:1) · <a href="/admin.html">← 숨은 이벤트 도감</a>',
      }),
    ),
    el(
      "div",
      { class: "wrap" },
      el(
        "div",
        { class: "cols" },
        el(
          "div",
          { class: "panel", style: "flex:1;min-width:360px" },
          el("h2", {}, "크롭"),
          el("div", { class: "row" }, el("label", {}, "모드"), modeSelect),
          screenRow,
          itemRow,
          catRow,
          tweetCatRow,
          yabamRow,
          eventRow,
          eventInfo,
          el(
            "p",
            { class: "note" },
            "크롭 영역 = 무대 전체입니다. 비율과 저장 크기는 모드·화면이 정합니다.",
          ),
          drop,
          stage,
          el("div", { class: "row" }, el("label", {}, "확대"), zoomRange),
        ),
        el(
          "div",
          { class: "panel", style: "flex:1;min-width:300px" },
          el("h2", {}, "결과"),
          el(
            "div",
            { class: "preview" },
            el("figure", {}, outCanvas, outCap),
            el("figure", {}, zoomCanvas, zoomCap),
          ),
          nameRow,
          itemNote,
          mediaNotes,
          saveBtn,
          msg,
        ),
      ),
      el(
        "div",
        { class: "panel", style: "margin-top:20px" },
        savedTitle,
        el("p", { class: "note" }, "방금 저장한 파일이 안 보이면 새로고침하세요."),
        savedBox,
      ),
    ),
  );
  fillItems();
  fillCats();
  fillTweetCats();
  fillYabam();

  // 저장 직전의 모드·선택을 되살린다(있으면). 드롭다운이 채워진 뒤여야 .value가 먹는다.
  // apply()보다 먼저 — apply()가 이 상태로 화면을 그린다.
  const sel = sessionStorage.getItem(SAVED_SEL_KEY);
  if (sel !== null) {
    sessionStorage.removeItem(SAVED_SEL_KEY);
    try {
      const s = JSON.parse(sel) as {
        mode: Mode;
        screen: string;
        cat: string;
        tweetCat: string;
        yabam?: string;
      };
      if (MODES.includes(s.mode)) {
        mode = s.mode;
        modeSelect.value = s.mode;
      }
      // 없는 값이면 브라우저가 무시하므로 별도 검증 불필요.
      if (s.screen) {
        screenSelect.value = s.screen;
        target = TARGETS.find((t) => t.key === s.screen) ?? target;
      }
      if (s.cat) catSelect.value = s.cat;
      if (s.tweetCat) tweetCatSelect.value = s.tweetCat;
      if (s.yabam) yabamSelect.value = s.yabam;
    } catch {
      // 손상된 값은 무시하고 기본(media)로 시작.
    }
  }

  apply();

  // 저장 → dev 서버 새로고침으로 날아간 성공 문구를 복원한다(새로고침 자체가 목록 갱신이다).
  // 저장 직전에 넣어둔 **완성된 문구**를 그대로 되살린다(접두사를 다시 붙이지 마라 —
  // save()가 이미 '저장됨: …'과 중복 개명 안내까지 담아 넘긴다).
  const saved = sessionStorage.getItem(SAVED_MSG_KEY);
  if (saved !== null) {
    sessionStorage.removeItem(SAVED_MSG_KEY);
    setMsg(`${saved} · 목록에 반영되었습니다.`, "ok");
  }
}
