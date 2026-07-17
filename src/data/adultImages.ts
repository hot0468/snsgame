/**
 * 성인 트윗에 붙는 이미지 목록 — **네 번째 축**이다.
 *
 * ⚠️ **파일명이 아무 역할도 하지 않는다.** 트윗(키워드)·너튜브(카테고리)·아이템(id)과
 *    달리, 이 축의 매칭은 `tweet.isAdult`만 본다(systems/mediaImages.ts의 pickAdultImage).
 *    그래서 어드민이 이름을 묻지 않고 `adult`·`adult__2`… 로 자동 저장한다.
 *    여기에 keyword 필드를 되살리지 마라 — 파일명으로 매칭할 것 같은 착각만 만든다.
 *    (같은 이유로 `__N` 접미사를 떼는 DEDUP_SEP 분리도 필요 없다. 뗄 키워드가 없다.)
 *
 * ## 왜 media/에 섞지 않고 폴더를 나눴나 (실측 근거)
 * 성인 트윗에 `성인물.webp`를 넣어봐야 **0개 매칭**이다. 매칭이 isAdult를 안 보고 본문·
 * 프롬프트에서 글자만 찾는데, 성인 미디어 트윗 77개는 전부 은유로 쓰여 있어
 * ("불 끄고 찍으니 분위기가 다르네") "성인물"·"섹시" 같은 단어가 아예 없다.
 * `노출`·`야한`·`속옷`은 77개 중 1개씩(커버율 1%)만 걸리고, `노출`은 비성인 트윗에도 걸린다.
 * 그래서 키워드를 버리고 isAdult로 매칭하는 전용 축을 만든 것이다 — 다시 합치지 마라.
 *
 * 파일을 넣는 것으로 끝이다(glob) — 이 파일을 고칠 필요가 없으니 목록을 손으로 적는
 * 방식으로 바꾸지 마라.
 *
 * 이미지는 어드민 편집기(admin-media.html)의 「성인 트윗」 모드에서 **83x40** WebP로
 * 크롭해 저장한다. 트윗과 같은 자리(.tweet-media)에 그려지므로 규격도 트윗과 같다
 * (표시 495x240의 1/6 — 일부러 흐리게. admin/mediaEditor.ts의 MEDIA_W 주석 참고).
 */

export interface AdultImage {
  /** 확장자를 뺀 실제 파일명(`adult__2`). 어드민 목록에서 장끼리 구분하는 데만 쓴다. */
  file: string;
  /** 번들된 이미지 URL */
  url: string;
}

const files = import.meta.glob<string>("../assets/adult/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export const ADULT_IMAGES: AdultImage[] = Object.entries(files).map(([path, url]) => ({
  file: path.split("/").pop()!.replace(/\.webp$/, ""),
  url,
}));
