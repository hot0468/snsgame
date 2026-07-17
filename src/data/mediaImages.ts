/**
 * 미디어 트윗에 붙는 이미지 목록.
 *
 * **파일명이 곧 키워드다.** `src/assets/media/커피.webp`를 넣으면 "커피"가 들어간
 * 미디어 트윗에 자동으로 붙는다 — 이 파일을 고칠 필요가 없다.
 * 그러니 목록을 손으로 적는 방식으로 바꾸지 마라. glob이 전부다.
 *
 * 이미지는 어드민 편집기(admin-media.html)에서 **83x40** WebP로 크롭해 저장한다.
 * 이 작은 규격은 실수가 아니다 — 표시 크기(495x240)의 정확히 1/6이라 화면에서 6배로 늘어나
 * 흐려지게 만들어, 원본 사진이 뭐였는지 알아볼 수 없게 하려는 것이다
 * (admin/mediaEditor.ts의 MEDIA_W·MEDIA_DIVISOR 참고).
 * 아이템 이미지(data/itemImages.ts)는 정반대로 선명해야 한다 — 두 축을 통일하지 마라.
 */

/**
 * 중복 저장 시 파일명에 붙는 접미사 구분자(`커피` → `커피__2`).
 *
 * ⚠️ `vite.config.ts`의 `DEDUP_SEP`가 이 값으로 접미사를 **붙이고**, 여기서 **뗀다.**
 *    한쪽만 바꾸면 `커피__2`의 키워드가 `커피__2`가 되어 어떤 트윗에도 안 붙는다.
 *
 * 한 키워드에 여러 장을 두는 건 의도다 — `imageForTweet`이 트윗 id 해시로 그중 하나를 고른다.
 */
const DEDUP_SEP = "__";

export interface MediaImage {
  /**
   * 매칭에 쓰는 단어. 파일명에서 `__숫자` 접미사를 뗀 것이다.
   * `커피.webp`와 `커피__2.webp`는 **둘 다 키워드가 `커피`** 이고, 같은 트윗 후보에 함께 들어간다.
   */
  keyword: string;
  /** 확장자를 뺀 실제 파일명(`커피__2`). 어드민 목록에서 장끼리 구분하는 데 쓴다. */
  file: string;
  /** 번들된 이미지 URL */
  url: string;
}

const files = import.meta.glob<string>("../assets/media/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export const MEDIA_IMAGES: MediaImage[] = Object.entries(files).map(([path, url]) => {
  // glob 키(path)는 %-인코딩되지 않은 원본 파일명이다(url 쪽만 인코딩된다).
  // 그래서 디코딩하지 않는다 — decodeURIComponent를 넣으면 '100%.webp' 같은 파일명에서
  // 모듈 로드 자체가 터진다.
  const file = path.split("/").pop()!.replace(/\.webp$/, "");
  return { keyword: file.split(DEDUP_SEP)[0], file, url };
});
