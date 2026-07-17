/**
 * 아이템 썸네일 이미지 — 쇼핑·피망마켓·마켓걸리버·남의방.
 *
 * **파일명이 곧 아이템 id다.** `src/assets/items/pm_yoga_mat.webp`를 넣으면
 * 피망마켓의 그 물건에 붙는다 — 이 파일을 고칠 필요가 없다. glob이 전부다.
 *
 * ⚠️ 트윗 이미지(data/mediaImages.ts)와 **다른 축**이다. 저쪽은 파일명이 키워드라
 *    부분일치 + 해시로 고른다. 여기는 id 1:1 정확 매칭이라 확률도 해시도 없다.
 *    폴더가 나뉜 이유가 그것이니 두 폴더를 합치지 마라.
 *
 * 이미지는 어드민 페이지(admin-media.html)의 「아이템」 모드에서 화면별 규격
 * (정사각 240 / 남의방 4:3 160x120)으로 크롭해 저장한다.
 */

const files = import.meta.glob<string>("../assets/items/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

/** 아이템 id → 이미지 URL. 없는 id가 대부분이라 조회 실패가 정상이다. */
export const ITEM_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split("/").pop()!.replace(/\.webp$/, ""), url]),
);

/** 아이템 id에 붙일 이미지 URL. 없으면 null — 호출부는 기존 표시로 폴백한다. */
export function imageForItem(id: string): string | null {
  return ITEM_IMAGES[id] ?? null;
}
