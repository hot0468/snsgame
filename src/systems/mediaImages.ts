import type { Tweet } from "@/core/types";
import type { MediaImage } from "@/data/mediaImages";
import type { AdultImage } from "@/data/adultImages";
import type { TweetCatImage } from "@/data/tweetCatImages";
import { MEDIA_IMAGES } from "@/data/mediaImages";
import { ADULT_IMAGES } from "@/data/adultImages";
import { TWEET_CAT_IMAGES } from "@/data/tweetCatImages";
import { hashInt } from "@/utils/random";

/**
 * 미디어 트윗 ↔ 이미지 매칭. **세 경로가 있다:**
 * - 카테고리 풀(assets/tweetcat/): 파일명(트윗 속성)이 `tweet.attribute`와 정확히 같으면 붙는다.
 * - 성인 풀(assets/adult/): `tweet.isAdult`만 보고 붙는다. 파일명을 안 본다.
 * - 키워드 풀(assets/media/): 파일명(키워드)이 본문·사진설명에 들어 있으면 붙는다.
 * 우선순위는 pickTweetImage 주석 참고 — **카테고리가 성인을 이긴다. 뒤집기 전에 반드시 읽어라.**
 */

/**
 * 후보 목록을 받아 트윗에 붙일 이미지를 고른다.
 *
 * ⚠️ **여기서 Math.random·pick을 쓰면 안 된다.** 앱은 스토어가 바뀔 때마다 화면을
 *    통째로 다시 그린다(ui/app.ts). 렌더마다 난수를 굴리면 같은 트윗의 이미지가
 *    매번 바뀌어 깜빡인다. 그래서 트윗 id를 시드로 한 해시에 고정한다.
 *    systems/certification.ts의 certAppearsToday가 같은 이유로 남긴 선례다.
 *
 * (MEDIA_IMAGES는 실제 폴더 기반이라 비어 있을 수 있어, 테스트를 위해 후보를 인자로 받는다.)
 */
export function pickImage(tweet: Tweet, images: readonly MediaImage[]): string | null {
  if (!tweet.media) return null;
  const haystack = `${tweet.text} ${tweet.media.prompt}`;
  const matches = images.filter((img) => haystack.includes(img.keyword));
  if (matches.length === 0) return null;
  return matches[hashInt(`mediaImg:${tweet.id}`) % matches.length].url;
}

/**
 * 성인 트윗 전용 풀에서 택1 — **파일명도 본문도 보지 않는다. `isAdult`만 본다.**
 *
 * 성인 미디어 트윗이면 성인 풀 **전체**가 후보이고, 그중 하나를 트윗 id 해시로 고른다
 * (pickImage와 같은 이유로 난수 금지 — 렌더마다 이미지가 깜빡인다).
 * 시드 접두사가 pickImage와 다른 건 의도다 — 같으면 두 풀에서 같은 인덱스가 뽑혀
 * 장수가 같을 때 배치가 서로 붙는다.
 *
 * 성인 트윗이 아니면 null이다 — 이게 이 축의 핵심 계약이다.
 * 비성인 트윗에 성인 이미지가 붙으면 안 된다.
 */
export function pickAdultImage(tweet: Tweet, images: readonly AdultImage[]): string | null {
  if (!tweet.media || !tweet.isAdult || images.length === 0) return null;
  return images[hashInt(`adultImg:${tweet.id}`) % images.length].url;
}

/**
 * 트윗 속성 전용 풀에서 택1 — **`tweet.attribute` 정확일치. 본문 글자를 뒤지지 않는다.**
 *
 * 키워드 축(pickImage)과 헷갈리지 마라. 저기는 파일명이 본문에 **들어 있으면** 걸리는
 * 부분일치고, 여기는 파일명이 속성과 **같아야만** 걸린다. `idol.webp`는 아이돌 트윗에만
 * 붙고, 본문에 "idol"이 있든 없든 상관없다.
 *
 * 시드 접두사가 다른 축들과 다른 건 의도다 — 같으면 두 풀에서 같은 인덱스가 뽑혀
 * 장수가 같을 때 배치가 서로 붙는다(pickAdultImage 주석과 같은 이유).
 *
 * (풀은 실제 폴더 기반이라 비어 있을 수 있어, 테스트를 위해 후보를 인자로 받는다.)
 */
export function pickTweetCatImage(tweet: Tweet, images: readonly TweetCatImage[]): string | null {
  if (!tweet.media) return null;
  const matches = images.filter((img) => img.attribute === tweet.attribute);
  if (matches.length === 0) return null;
  return matches[hashInt(`tweetCatImg:${tweet.id}`) % matches.length].url;
}

/**
 * 이미지가 **어느 풀에서 왔는지**. UI가 성인 이미지에만 블러를 얹는 데 쓴다.
 *
 * ⚠️ UI가 `tweet.isAdult`로 블러를 판정하면 **틀린다.** 아래 우선순위 때문에 isAdult가 붙은
 *    아이돌 트윗은 *아이돌* 이미지를 받는데(카테고리가 이긴다), isAdult로 가리면 그 아이돌
 *    이미지까지 뭉갠다. 실제로 성인물 보기가 켜지면 아이돌 트윗의 ~18%가 그 경우다.
 *    그래서 URL만 주지 않고 출처를 함께 준다.
 */
export type TweetImageSource = "cat" | "adult" | "keyword";

export interface TweetImage {
  url: string;
  source: TweetImageSource;
}

/**
 * 트윗에 붙일 이미지. 세 풀의 **우선순위는 카테고리 → 성인 → 키워드다.**
 *
 * 1. `tweet.attribute`의 카테고리 풀에 이미지가 있으면 → 그 풀에서 해시로 택1
 * 2. 아니면 성인 트윗이고 성인 풀이 비어 있지 않으면 → 성인 풀에서 해시로 택1
 * 3. 아니면 → 키워드 부분일치 경로
 *
 * ## ⚠️ 왜 카테고리가 성인보다 **먼저**인가 — 뒤집지 마라 (사용자 확정)
 * `data/accounts.ts`의 makeForeignTweet이
 * `isAdult = adultOnly || (adultMode && chance(0.2))`로 성인 여부를 정한다.
 * 즉 **성인물 보기가 켜지면 아이돌 트윗의 약 18%가 isAdult를 달고 나온다**
 * (행사 트윗을 뺀 20% — 실측: 전 카테고리 ~20%). 성인을 먼저 보게 순서를 뒤집으면
 * 애써 등록한 아이돌 이미지가 그 18%에는 안 붙고 성인 이미지가 대신 붙는다.
 * **이건 우연히 겹치는 게 아니라 구조다** — 성인물 보기를 켠 플레이어에게는 아이돌
 * 트윗 다섯 개 중 하나꼴로 계속 일어난다.
 * 카테고리 매칭(속성 정확일치)이 isAdult(20% 확률 도장)보다 구체적이기도 하다.
 *
 * 각 풀이 비어 있으면 `??`가 알아서 다음 경로로 떨어뜨린다 — 폴더가 비었다고 트윗이
 * 이미지를 잃지 않는다. 그래서 tweetcat/에 아무것도 없으면 기존 2축 동작 그대로다.
 *
 * (세 풀 모두 실제 폴더 기반이라 비어 있을 수 있어, 테스트를 위해 후보를 인자로 받는다.)
 */
export function pickTweetImage(
  tweet: Tweet,
  adultImages: readonly AdultImage[],
  mediaImages: readonly MediaImage[],
  catImages: readonly TweetCatImage[] = [],
): TweetImage | null {
  const cat = pickTweetCatImage(tweet, catImages);
  if (cat) return { url: cat, source: "cat" };
  const adult = pickAdultImage(tweet, adultImages);
  if (adult) return { url: adult, source: "adult" };
  const keyword = pickImage(tweet, mediaImages);
  return keyword ? { url: keyword, source: "keyword" } : null;
}

/** 트윗에 붙일 이미지. 미디어 트윗이 아니거나 매칭이 없으면 null. */
export function imageForTweet(tweet: Tweet): TweetImage | null {
  return pickTweetImage(tweet, ADULT_IMAGES, MEDIA_IMAGES, TWEET_CAT_IMAGES);
}

/**
 * 표시용 이미지 해석 — 게시 시점에 박제된 `tweet.mediaImage`가 있으면 그걸 쓰고(내 트윗),
 * 없으면 imageForTweet으로 매번 해석한다(NPC/피드 트윗). 렌더(인라인·팝업)는 이걸 써야
 * 내가 등록한 트윗의 이미지가 등록 풀 변화에도 다음날 바뀌지 않는다.
 */
export function resolvedTweetImage(tweet: Tweet): TweetImage | null {
  if (tweet.mediaImage) {
    return { url: tweet.mediaImage.url, source: tweet.mediaImage.adult ? "adult" : "keyword" };
  }
  return imageForTweet(tweet);
}
