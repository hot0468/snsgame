/**
 * 포토카드 프레임 그림 — **그림은 '모양'만 제공하고, 색은 등급이 칠한다.**
 *
 * 카드 위에 덮이는 층의 알파 채널을 마스크로 쓰기 때문에(styles/photoCard.css `.pcard__framing`),
 * 그림 자체가 무슨 색이든 화면에는 등급별 그라데이션(은색→파랑→보라→홀로그램)으로 나온다.
 * 덕분에 **파일 하나로 4등급이 다 나온다** — 등급마다 색만 다른 그림을 따로 구할 필요가 없다.
 *
 * 파일 놓는 법(`src/assets/frames/`):
 * - `card.png` … 모든 등급이 쓰는 기본 모양
 * - `common` · `rare` · `sr` · `ssr` … 그 등급만 다른 모양을 쓰고 싶을 때(없으면 card로 폴백)
 *
 * ⚠️ **가운데가 뚫린(알파 0) 그림이어야 한다.** 선/장식 부분만 불투명해야 그 부분에만 색이 칠해진다.
 *    배경이 흰색으로 채워진 그림을 넣으면 카드 전체가 등급색으로 덮여 사진이 사라진다.
 *    png(알파)·알파 있는 webp·svg만 쓰고 jpg는 넣지 마라.
 * ⚠️ 비율은 카드와 같은 **5:7 세로형**에 가깝게. 다른 비율은 늘려 붙이므로 조금 찌그러진다.
 * ⚠️ 아이템 사진(data/itemImages.ts)과 다른 축이다 — 저쪽은 파일명이 아이템 id다. 폴더를 합치지 마라.
 */

const files = import.meta.glob<string>("../assets/frames/*.{png,webp,svg}", {
  eager: true,
  query: "?url",
  import: "default",
});

/** 파일명(확장자 뗀 것) → URL. 키는 등급 이름이거나 기본 모양인 `card`다. */
export const FRAME_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [
    // ⚠️ 확장자 목록은 위 glob와 반드시 같이 고쳐라 — 한쪽만 늘리면 키에 확장자가 남아
    //    등급 이름과 안 맞고, 프레임이 조용히 안 붙는다(실제로 svg를 추가하며 겪었다).
    path.split("/").pop()!.replace(/\.(png|webp|svg)$/, ""),
    url,
  ]),
);

/** 이 등급에 씌울 프레임 모양. 등급 전용 파일 > 기본(card) 순. 둘 다 없으면 null(CSS 테두리). */
export function frameForRarity(rarity: string): string | null {
  return FRAME_IMAGES[rarity] ?? FRAME_IMAGES.card ?? null;
}
