/**
 * 너튜브 영상 썸네일 이미지 목록.
 *
 * **파일명이 곧 영상 카테고리(VideoAttribute)다.** `src/assets/youtube/animal.webp`를 넣으면
 * 동물 카테고리 영상에 자동으로 붙는다 — 이 파일을 고칠 필요가 없다.
 * 그러니 목록을 손으로 적는 방식으로 바꾸지 마라. glob이 전부다.
 *
 * ⚠️ **트윗(data/mediaImages.ts)·아이템(data/itemImages.ts)과 다른 세 번째 축이다.**
 *    - 트윗: 파일명이 키워드라 본문 **부분일치** + 해시로 택1.
 *    - 아이템: 파일명이 id라 **1:1 정확 매칭**, 확률 없음.
 *    - 여기: 파일명이 카테고리라 **카테고리 정확일치** + 영상 id 해시로 택1.
 *      제목 글자를 뒤지지 않는다(트윗과 헷갈리지 마라).
 *    폴더가 셋으로 나뉜 이유가 그것이니 합치지 마라.
 *
 * 이미지는 어드민 편집기(admin-media.html)의 「너튜브」 모드에서 **48x27** WebP로 크롭해 저장한다.
 * 이 작은 규격은 실수가 아니다 — 가로 썸네일 표시 크기(285x160)의 정확히 1/6이라 화면에서
 * 6배로 늘어나 흐려지며, 원본 사진이 뭐였는지 알아볼 수 없게 한다(트윗과 같은 이유).
 * 아이템 이미지는 정반대로 선명해야 한다 — 세 축을 통일하지 마라.
 */

/**
 * 중복 저장 시 파일명에 붙는 접미사 구분자(`animal` → `animal__2`).
 *
 * ⚠️ `vite.config.ts`의 `DEDUP_SEP`가 이 값으로 접미사를 **붙이고**, 여기서 **뗀다.**
 *    한쪽만 바꾸면 `animal__2`의 카테고리가 `animal__2`가 되어 어떤 영상에도 안 붙는다.
 *
 * 한 카테고리에 여러 장을 두는 건 의도다 — `imageForVideo`가 영상 id 해시로 그중 하나를 고른다.
 */
const DEDUP_SEP = "__";

export interface YoutubeImage {
  /**
   * 매칭에 쓰는 영상 카테고리(VideoAttribute). 파일명에서 `__숫자` 접미사를 뗀 것이다.
   * `animal.webp`와 `animal__2.webp`는 **둘 다 카테고리가 `animal`** 이고 함께 후보에 들어간다.
   */
  category: string;
  /** 확장자를 뺀 실제 파일명(`animal__2`). 어드민 목록에서 장끼리 구분하는 데 쓴다. */
  file: string;
  /** 번들된 이미지 URL */
  url: string;
}

const files = import.meta.glob<string>("../assets/youtube/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export const YOUTUBE_IMAGES: YoutubeImage[] = Object.entries(files).map(([path, url]) => {
  const file = path.split("/").pop()!.replace(/\.webp$/, "");
  return { category: file.split(DEDUP_SEP)[0], file, url };
});
