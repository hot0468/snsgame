import { describe, it, expect } from "vitest";
import type { Tweet } from "@/core/types";
import type { MediaImage } from "@/data/mediaImages";
import type { AdultImage } from "@/data/adultImages";
import { pickAdultImage, pickTweetImage } from "@/systems/mediaImages";

/**
 * 성인 트윗 이미지 축(네 번째 축) 회귀 테스트.
 *
 * **핵심 계약은 두 줄이다:**
 * 1. 비성인 트윗에 성인 이미지가 **절대 붙지 않는다.**
 * 2. 같은 트윗 id면 항상 같은 URL(결정론) — 앱이 스토어 변경마다 통째로 재렌더하므로
 *    난수가 섞이면 이미지가 깜빡인다.
 *
 * 풀은 실제 폴더 기반이라 비어 있을 수 있어(그러면 무엇을 넣어도 통과한다),
 * 후보 배열을 직접 넘기는 pickAdultImage·pickTweetImage를 검증한다.
 */

const ADULT: AdultImage[] = [
  { file: "adult", url: "/adult.webp" },
  { file: "adult__2", url: "/adult__2.webp" },
  { file: "adult__3", url: "/adult__3.webp" },
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

describe("pickAdultImage — isAdult만 본다", () => {
  it("성인 미디어 트윗은 키워드가 하나도 없어도 성인 풀에서 뽑는다", () => {
    // 실제 성인 트윗은 은유로 쓰여 있어 '성인물'·'섹시' 같은 단어가 없다. 그래도 붙어야 한다.
    const t = tweet({ isAdult: true, text: "불 끄고 찍으니 분위기가 다르네" });
    expect(ADULT.map((a) => a.url)).toContain(pickAdultImage(t, ADULT));
  });

  it("비성인 트윗은 성인 풀에서 절대 안 뽑는다 — 이 축의 핵심 계약", () => {
    const t = tweet({ isAdult: false, text: "불 끄고 찍으니 분위기가 다르네" });
    expect(pickAdultImage(t, ADULT)).toBeNull();
  });

  it("media가 없는 성인 트윗은 null (사진 없는 트윗에 이미지를 붙이면 안 된다)", () => {
    const t = tweet({ isAdult: true, text: "야한 얘기", media: undefined });
    expect(pickAdultImage(t, ADULT)).toBeNull();
  });

  it("성인 풀이 비면 null", () => {
    expect(pickAdultImage(tweet({ isAdult: true }), [])).toBeNull();
  });

  it("같은 트윗 id면 100번 조회해도 같은 URL (결정론 — 난수를 쓰면 깜빡인다)", () => {
    const t = tweet({ isAdult: true, text: "무드 셀카" });
    const first = pickAdultImage(t, ADULT);
    expect(first).not.toBeNull();
    for (let i = 0; i < 100; i++) expect(pickAdultImage(t, ADULT)).toBe(first);
  });

  it("트윗 id가 다르면 갈린다 (한 장에 고정되지 않는다)", () => {
    const urls = new Set(
      Array.from({ length: 50 }, (_, i) => pickAdultImage(tweet({ id: `a${i}`, isAdult: true }), ADULT)),
    );
    expect(urls.size).toBe(3);
  });
});

describe("pickTweetImage — 우선순위: 성인 풀이 이긴다", () => {
  it("성인 트윗이 키워드와 성인 풀에 동시에 걸리면 성인이 이긴다", () => {
    // '노출'은 media 풀에 키워드로 있지만, 성인 트윗이므로 성인 축이 이겨야 한다.
    const t = tweet({ isAdult: true, text: "노출 있는 컷" });
    expect(pickTweetImage(t, ADULT, MEDIA)?.url).not.toBe("/노출.webp");
    const got = pickTweetImage(t, ADULT, MEDIA);
    expect(ADULT.map((a) => a.url)).toContain(got?.url);
    // 출처가 성인이어야 UI가 블러를 얹는다(ui/components.ts).
    expect(got?.source).toBe("adult");
  });

  it("성인 풀이 비면 키워드 경로로 떨어진다 (폴더가 비었다고 이미지를 잃지 않는다)", () => {
    const t = tweet({ isAdult: true, text: "노출 있는 컷" });
    expect(pickTweetImage(t, [], MEDIA)).toEqual({ url: "/노출.webp", source: "keyword" });
  });

  it("비성인 트윗은 성인 풀이 있어도 키워드 경로를 탄다", () => {
    const t = tweet({ isAdult: false, text: "커피 한 잔" });
    expect(pickTweetImage(t, ADULT, MEDIA)).toEqual({ url: "/커피.webp", source: "keyword" });
  });

  it("비성인 트윗은 키워드가 없으면 null — 성인 풀로 새지 않는다", () => {
    const t = tweet({ isAdult: false, text: "배고프다" });
    expect(pickTweetImage(t, ADULT, MEDIA)).toBeNull();
  });

  it("성인 트윗이 성인 풀·키워드 어디에도 못 걸리면 null", () => {
    const t = tweet({ isAdult: true, text: "배고프다" });
    expect(pickTweetImage(t, [], MEDIA)).toBeNull();
  });
});
