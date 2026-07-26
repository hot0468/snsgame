import { describe, it, expect } from "vitest";
import type { Tweet } from "@/core/types";
import type { MediaImage } from "@/data/mediaImages";
import type { AdultImage } from "@/data/adultImages";
import type { TweetCatImage } from "@/data/tweetCatImages";
import { pickTweetCatImage, pickTweetImage } from "@/systems/mediaImages";

/**
 * 트윗 카테고리 이미지 축(다섯 번째 축) 회귀 테스트.
 *
 * **핵심 계약은 세 줄이다:**
 * 1. `tweet.attribute` **정확일치**로만 붙는다 — 애니 트윗에 아이돌 이미지가 새면 안 된다.
 * 2. **카테고리가 성인을 이긴다.** isAdult가 붙은 아이돌 트윗도 아이돌 이미지를 받아야 한다.
 *    (accounts.ts의 `adultMode && chance(0.2)` 때문에 아이돌 트윗의 약 18%가 isAdult다 —
 *     우연이 아니라 구조라서, 이 순서가 뒤집히면 아이돌 이미지가 그 18%에서 통째로 사라진다.)
 * 3. 같은 트윗 id면 항상 같은 URL(결정론) — 앱이 스토어 변경마다 통째로 재렌더하므로
 *    난수가 섞이면 이미지가 깜빡인다.
 *
 * 풀은 실제 폴더 기반이라 비어 있을 수 있어(그러면 무엇을 넣어도 통과한다),
 * 후보 배열을 직접 넘기는 pickTweetCatImage·pickTweetImage를 검증한다.
 */

const CATS: TweetCatImage[] = [
  { attribute: "idol", file: "idol", url: "/idol.webp" },
  { attribute: "idol", file: "idol__2", url: "/idol__2.webp" },
  { attribute: "anime", file: "anime", url: "/anime.webp" },
];
const IDOL_URLS = ["/idol.webp", "/idol__2.webp"];

const ADULT: AdultImage[] = [
  { file: "adult", url: "/adult.webp" },
  { file: "adult__2", url: "/adult__2.webp" },
];

const MEDIA: MediaImage[] = [
  { keyword: "커피", file: "커피", url: "/커피.webp" },
  { keyword: "노출", file: "노출", url: "/노출.webp" },
];

function tweet(over: Partial<Tweet>): Tweet {
  return {
    id: "t1",
    authorName: "테스터",
    authorHandle: "@tester",
    attribute: "daily",
    isAdult: false,
    text: "",
    createdDay: 1,
    likes: 0,
    media: { kind: "photo", prompt: "" },
    ...over,
  } as Tweet;
}

describe("pickTweetCatImage — attribute 정확일치", () => {
  it("아이돌 트윗은 아이돌 풀에서 뽑는다", () => {
    expect(IDOL_URLS).toContain(pickTweetCatImage(tweet({ attribute: "idol" }), CATS));
  });

  it("애니 트윗은 아이돌 풀을 절대 안 뽑는다 — 축이 새면 안 된다", () => {
    const url = pickTweetCatImage(tweet({ attribute: "anime" }), CATS);
    expect(url).toBe("/anime.webp");
    expect(IDOL_URLS).not.toContain(url);
  });

  it("등록되지 않은 속성(일상)은 null — 아무거나 붙지 않는다", () => {
    expect(pickTweetCatImage(tweet({ attribute: "daily" }), CATS)).toBeNull();
  });

  it("본문 글자를 보지 않는다 — 부분일치 축과 헷갈리면 안 된다", () => {
    // 본문에 'idol'이 있어도 속성이 일상이면 안 붙고,
    const t1 = tweet({ attribute: "daily", text: "idol 최고" });
    expect(pickTweetCatImage(t1, CATS)).toBeNull();
    // 본문이 전혀 무관해도 속성이 아이돌이면 붙는다.
    const t2 = tweet({ attribute: "idol", text: "배고프다" });
    expect(IDOL_URLS).toContain(pickTweetCatImage(t2, CATS));
  });

  it("media가 없는 트윗은 null (사진 없는 트윗에 이미지를 붙이면 안 된다)", () => {
    expect(pickTweetCatImage(tweet({ attribute: "idol", media: undefined }), CATS)).toBeNull();
  });

  it("카테고리 풀이 비면 null", () => {
    expect(pickTweetCatImage(tweet({ attribute: "idol" }), [])).toBeNull();
  });

  it("같은 트윗 id면 100번 조회해도 같은 URL (결정론 — 난수를 쓰면 깜빡인다)", () => {
    const t = tweet({ attribute: "idol", text: "최애 무대" });
    const first = pickTweetCatImage(t, CATS);
    expect(first).not.toBeNull();
    for (let i = 0; i < 100; i++) expect(pickTweetCatImage(t, CATS)).toBe(first);
  });

  it("트윗 id가 다르면 갈린다 (한 장에 고정되지 않는다)", () => {
    const urls = new Set(
      Array.from({ length: 50 }, (_, i) =>
        pickTweetCatImage(tweet({ id: `c${i}`, attribute: "idol" }), CATS),
      ),
    );
    expect(urls).toEqual(new Set(IDOL_URLS));
  });
});

describe("pickTweetImage — 우선순위: 카테고리 > 성인 > 키워드", () => {
  it("⚠️ isAdult가 붙은 아이돌 트윗도 아이돌 풀에서 뽑는다 — 이 축의 핵심 계약", () => {
    // 성인물 보기를 켜면 accounts.ts가 아이돌 트윗의 약 18%에 isAdult를 찍는다.
    // 성인이 먼저 오면 등록한 아이돌 이미지가 그 18%에서 통째로 사라진다.
    const t = tweet({ attribute: "idol", isAdult: true, text: "불 끄고 찍으니 분위기가 다르네" });
    const url = pickTweetImage(t, ADULT, MEDIA, CATS)?.url;
    expect(IDOL_URLS).toContain(url);
    expect(ADULT.map((a) => a.url)).not.toContain(url);
  });

  it("isAdult 아이돌 트윗이 키워드에도 걸릴 때조차 카테고리가 이긴다", () => {
    const t = tweet({ attribute: "idol", isAdult: true, text: "노출 있는 컷" });
    const hit = pickTweetImage(t, ADULT, MEDIA, CATS);
    expect(IDOL_URLS).toContain(hit?.url);
    // 출처가 cat이어야 블러가 안 얹힌다 — 이 축의 핵심 계약이 UI까지 이어지는 지점.
    expect(hit?.source).toBe("cat");
  });

  it("비성인 아이돌 트윗은 키워드에 걸려도 카테고리가 이긴다", () => {
    const t = tweet({ attribute: "idol", isAdult: false, text: "커피 한 잔" });
    expect(IDOL_URLS).toContain(pickTweetImage(t, ADULT, MEDIA, CATS)?.url);
  });

  it("카테고리 풀이 비면 성인 → 키워드로 떨어진다", () => {
    const t = tweet({ attribute: "idol", isAdult: true, text: "노출 있는 컷" });
    expect(ADULT.map((a) => a.url)).toContain(pickTweetImage(t, ADULT, MEDIA, [])?.url);
  });

  it("카테고리에 없는 속성의 성인 트윗은 성인 풀을 탄다 (기존 4축 유지)", () => {
    const t = tweet({ attribute: "daily", isAdult: true, text: "노출 있는 컷" });
    expect(ADULT.map((a) => a.url)).toContain(pickTweetImage(t, ADULT, MEDIA, CATS)?.url);
  });

  it("카테고리·성인 어디에도 안 걸리면 키워드 경로 (회귀 — 일상 트윗의 커피)", () => {
    const t = tweet({ attribute: "daily", isAdult: false, text: "커피 한 잔" });
    expect(pickTweetImage(t, ADULT, MEDIA, CATS)).toEqual({ url: "/커피.webp", source: "keyword" });
  });

  it("셋 다 못 걸리면 null", () => {
    const t = tweet({ attribute: "daily", isAdult: false, text: "배고프다" });
    expect(pickTweetImage(t, ADULT, MEDIA, CATS)).toBeNull();
  });

  it("catImages를 생략하면 기존 2축 동작 그대로 (기본값 회귀)", () => {
    const t = tweet({ attribute: "idol", isAdult: true, text: "노출 있는 컷" });
    expect(ADULT.map((a) => a.url)).toContain(pickTweetImage(t, ADULT, MEDIA)?.url);
  });
});

describe("창작 축 — creation 풀이 최우선", () => {
  const CREA = [
    { file: "creation", url: "/creation.webp" },
    { file: "creation__2", url: "/creation__2.webp" },
  ];
  const CREA_URLS = CREA.map((c) => c.url);

  it("1차/2차 창작 트윗은 계열(애니) 카테고리보다 창작 풀이 먼저다", () => {
    const t = tweet({ attribute: "anime", creation: "original", text: "그림 그려봄" });
    const hit = pickTweetImage(t, ADULT, MEDIA, CATS, CREA);
    expect(hit?.source).toBe("creation");
    expect(CREA_URLS).toContain(hit?.url);
  });

  it("창작이 아니면 창작 풀을 절대 안 뽑는다 (축이 새면 안 된다)", () => {
    const t = tweet({ attribute: "anime", text: "일반 애니 트윗" });
    expect(pickTweetImage(t, ADULT, MEDIA, CATS, CREA)?.source).toBe("cat");
  });

  it("창작 트윗인데 창작 풀이 비면 계열 카테고리로 폴백 (그래도 미디어)", () => {
    const t = tweet({ attribute: "anime", creation: "fan" });
    expect(pickTweetImage(t, ADULT, MEDIA, CATS, [])?.source).toBe("cat");
  });

  it("같은 트윗 id면 항상 같은 창작 URL (결정론 — 깜빡임 방지)", () => {
    const t = tweet({ id: "cr1", attribute: "anime", creation: "original" });
    const first = pickTweetImage(t, ADULT, MEDIA, CATS, CREA)?.url;
    expect(first).toBeTruthy();
    for (let i = 0; i < 100; i++)
      expect(pickTweetImage(t, ADULT, MEDIA, CATS, CREA)?.url).toBe(first);
  });
});
