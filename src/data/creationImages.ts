/**
 * 창작(1차·2차) 트윗에 붙는 이미지 목록 — 성인 축(adultImages)과 같은 결의 **플래그 매칭 풀**이다.
 *
 * ⚠️ **파일명이 매칭에 쓰이지 않는다.** 매칭은 `tweet.creation`(원작/2차 여부)만 본다
 *    (systems/mediaImages.ts의 pickCreationImage). 그래서 어드민이 이름을 묻지 않고
 *    `creation`·`creation__2`… 로 자동 저장한다. keyword 필드를 되살리지 마라.
 *
 * ## 왜 별도 풀인가
 * 창작 트윗은 "직접 그린 그림"이라 계열(anime) 카테고리 이미지·성인 이미지와 결이 다르다.
 * 1차/2차를 한 풀로 두는 건 의도다(사용자 요청: '창작 별도 탭' 하나). 원작/2차 구분이
 * 필요해지면 file 접두사로 나누면 되지만, 지금은 creation 여부만으로 붙인다.
 * 폴더가 비어 있으면 창작 트윗은 그림 자리(.tweet-media 플레이스홀더)만 뜬다 — 그래도
 * '무조건 미디어 형태'라는 계약은 지켜진다(placeholder도 미디어 자리다).
 *
 * 이미지는 어드민 편집기(admin-media.html)의 「창작」 모드에서 **83x40** WebP로 크롭해
 * 저장한다. 트윗과 같은 자리(.tweet-media)에 그려지므로 규격도 트윗과 같다.
 */

export interface CreationImage {
  /** 확장자를 뺀 실제 파일명(`creation__2`). 어드민 목록에서 장끼리 구분하는 데만 쓴다. */
  file: string;
  /** 번들된 이미지 URL */
  url: string;
}

const files = import.meta.glob<string>("../assets/creation/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export const CREATION_IMAGES: CreationImage[] = Object.entries(files).map(([path, url]) => ({
  file: path.split("/").pop()!.replace(/\.webp$/, ""),
  url,
}));
