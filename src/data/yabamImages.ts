/**
 * 야밤 영상 커버 이미지 — 야밤 사이트 성인영상 카드.
 *
 * **파일명이 곧 영상 id다.** `src/assets/yabam/yv1.webp`를 넣으면 그 영상 커버에 붙는다 —
 * 이 파일을 고칠 필요가 없다. glob이 전부다.
 *
 * ⚠️ 아이템 이미지(data/itemImages.ts)와 **같은 결**이다 — id 1:1 정확 매칭이라 확률도
 *    해시도 없고, 선명하게(q=0.7) 저장한다. 트윗·성인·너튜브 축(키워드/카테고리 + 해시,
 *    일부러 흐림)과는 다르다. 폴더를 합치지 마라.
 *
 * 이미지는 어드민 페이지(admin-media.html)의 「야밤 영상」 모드에서 240x150(16:10)으로
 * 크롭해 저장한다(.yabam-vid__cover가 16:10).
 */

const files = import.meta.glob<string>("../assets/yabam/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

/** 영상 id → 커버 이미지 URL. 없는 id가 대부분이라 조회 실패가 정상이다. */
export const YABAM_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split("/").pop()!.replace(/\.webp$/, ""), url]),
);

/** 영상 id에 붙일 커버 URL. 없으면 null — 호출부는 기존 그라데이션으로 폴백한다. */
export function imageForYabamVideo(id: string): string | null {
  return YABAM_IMAGES[id] ?? null;
}
