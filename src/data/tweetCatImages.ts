/**
 * 트윗 카테고리 이미지 목록 — **다섯 번째 축**이다.
 *
 * **파일명이 곧 트윗 속성(AttributeId)이다.** `src/assets/tweetcat/idol.webp`를 넣으면
 * `attribute === "idol"`인 미디어 트윗에 자동으로 붙는다 — 이 파일을 고칠 필요가 없다.
 * 그러니 목록을 손으로 적는 방식으로 바꾸지 마라. glob이 전부다.
 *
 * ⚠️ **앞선 네 축과 매칭 규칙이 다르다 — 합치지 마라.**
 *    - 트윗 키워드(media/): 파일명이 키워드라 본문 **부분일치** + 해시로 택1.
 *    - 성인(adult/): **`isAdult`만** 본다. 파일명을 안 읽는다.
 *    - 너튜브(youtube/): 파일명이 **영상** 카테고리(VideoAttribute). 트윗과 무관하다.
 *    - 아이템(items/): 파일명이 id라 **1:1 정확 매칭**, 확률 없음.
 *    - 여기: 파일명이 **트윗 속성**이라 `tweet.attribute` **정확일치** + 트윗 id 해시로 택1.
 *      본문 글자를 뒤지지 않는다(키워드 축과 헷갈리지 마라).
 *
 * 우선순위는 systems/mediaImages.ts의 `pickTweetImage` 주석을 봐라 — **이 축이 성인 축을
 * 이긴다.** 그 순서에는 실측 근거가 있으니 뒤집기 전에 반드시 읽어라.
 *
 * 이미지는 어드민 편집기(admin-media.html)의 「트윗 카테고리」 모드에서 **83x40** WebP로
 * 크롭해 저장한다. 트윗과 같은 자리(.tweet-media)에 그려지므로 규격도 트윗과 같다
 * (표시 495x240의 1/6 — 일부러 흐리게. admin/mediaEditor.ts의 MEDIA_W 주석 참고).
 */
import type { AttributeId } from "@/core/types";

/**
 * 중복 저장 시 파일명에 붙는 접미사 구분자(`idol` → `idol__2`).
 *
 * ⚠️ `vite.config.ts`의 `DEDUP_SEP`가 이 값으로 접미사를 **붙이고**, 여기서 **뗀다.**
 *    한쪽만 바꾸면 `idol__2`의 속성이 `idol__2`가 되어 어떤 트윗에도 안 붙는다.
 *
 * 한 속성에 여러 장을 두는 건 의도다 — `imageForTweet`이 트윗 id 해시로 그중 하나를 고른다.
 */
const DEDUP_SEP = "__";

/**
 * 이미지를 등록할 수 있는 트윗 속성 — 현재 아이돌·애니·배우·게임·강아지·고양이·식물.
 *
 * 속성은 18종이지만(core/types.ts의 AttributeId) 그 전부에 이미지를 두지는 않는다.
 * 등록되지 않은 속성의 트윗은 기존 키워드 축(media/)이 그대로 처리한다.
 *
 * **확장 지점: 여기에 한 줄 추가하면 끝이다.** 어드민 드롭다운(admin/mediaEditor.ts의
 * `fillTweetCats`)이 이 배열을 그대로 읽으므로 어드민을 따로 고칠 필요가 없다.
 * `AttributeId` 타입이 걸려 있어 오타·없는 속성은 typecheck에서 잡힌다.
 */
export const TWEET_CAT_IDS: AttributeId[] = ["idol", "anime", "actor", "gaming", "dog", "cat", "plant"];

export interface TweetCatImage {
  /**
   * 매칭에 쓰는 트윗 속성. 파일명에서 `__숫자` 접미사를 뗀 것이다.
   * `idol.webp`와 `idol__2.webp`는 **둘 다 속성이 `idol`** 이고 함께 후보에 들어간다.
   */
  attribute: string;
  /** 확장자를 뺀 실제 파일명(`idol__2`). 어드민 목록에서 장끼리 구분하는 데 쓴다. */
  file: string;
  /** 번들된 이미지 URL */
  url: string;
}

const files = import.meta.glob<string>("../assets/tweetcat/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export const TWEET_CAT_IMAGES: TweetCatImage[] = Object.entries(files).map(([path, url]) => {
  const file = path.split("/").pop()!.replace(/\.webp$/, "");
  return { attribute: file.split(DEDUP_SEP)[0], file, url };
});
