import { describe, it, expect } from "vitest";
import type { Tweet } from "@/core/types";
import type { MediaImage } from "@/data/mediaImages";
import { pickImage } from "@/systems/mediaImages";

/**
 * 미디어 트윗 이미지 매칭 회귀 테스트.
 *
 * 핵심은 **결정론**이다. 앱은 스토어가 바뀔 때마다 화면을 통째로 다시 그리므로,
 * 매칭에 난수가 들어가면 같은 트윗의 이미지가 렌더마다 바뀌어 깜빡인다.
 *
 * MEDIA_IMAGES는 실제 폴더 기반이라 비어 있을 수 있어(그러면 무엇을 넣어도 통과한다),
 * 후보 배열을 직접 넘기는 pickImage를 검증한다.
 */

const IMAGES: MediaImage[] = [
  { keyword: "커피", url: "/커피.webp" },
  { keyword: "고양이", url: "/고양이.webp" },
  { keyword: "노을", url: "/노을.webp" },
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
    ...over,
  } as Tweet;
}

describe("pickImage", () => {
  it("키워드가 본문에만 있어도 매칭한다", () => {
    const t = tweet({ text: "오늘 커피 맛있다", media: { kind: "photo", prompt: "책상 사진" } });
    expect(pickImage(t, IMAGES)).toBe("/커피.webp");
  });

  it("키워드가 사진설명에만 있어도 매칭한다", () => {
    const t = tweet({ text: "오늘 하루", media: { kind: "photo", prompt: "창밖 노을 사진" } });
    expect(pickImage(t, IMAGES)).toBe("/노을.webp");
  });

  it("키워드가 어디에도 없으면 null", () => {
    const t = tweet({ text: "배고프다", media: { kind: "photo", prompt: "라면 사진" } });
    expect(pickImage(t, IMAGES)).toBeNull();
  });

  it("media가 없는 트윗은 null", () => {
    expect(pickImage(tweet({ text: "커피 커피 커피" }), IMAGES)).toBeNull();
  });

  it("후보가 여럿이어도 같은 트윗은 100번 조회해도 같은 이미지", () => {
    const t = tweet({ text: "커피 마시는 고양이", media: { kind: "photo", prompt: "노을 배경" } });
    const first = pickImage(t, IMAGES);
    expect(first).not.toBeNull();
    for (let i = 0; i < 100; i++) expect(pickImage(t, IMAGES)).toBe(first);
  });

  it("트윗 id가 다르면 이미지가 갈린다(전부 같은 걸로 고정되지 않는다)", () => {
    const results = new Set(
      Array.from({ length: 50 }, (_, i) =>
        pickImage(
          tweet({ id: `t${i}`, text: "커피 마시는 고양이", media: { kind: "photo", prompt: "노을 배경" } }),
          IMAGES,
        ),
      ),
    );
    expect(results.size).toBe(3);
  });
});

/**
 * 중복 이름 접미사(`커피__2`) 회귀.
 *
 * 파일명이 곧 키워드라, 중복 저장으로 붙는 `__N`을 떼지 않으면 그 장은 **영영 안 붙는다**
 * ("커피__2"라는 글자가 든 트윗은 없다). typecheck로는 절대 안 잡히고, 화면에서도
 * "그냥 다른 이미지가 뽑혔나" 싶어 넘어가기 쉬운 종류의 버그다.
 *
 * ⚠️ 구분자는 vite.config.ts의 DEDUP_SEP과 **한 쌍**이다. 한쪽만 바꾸면 여기서 깨진다.
 */
describe("중복 이름 접미사 — 파일명 __N을 떼고 매칭한다", () => {
  const tweet = (id: string, text: string): Tweet =>
    ({
      id,
      authorName: "a",
      authorHandle: "a",
      attribute: "daily",
      isAdult: false,
      text,
      createdDay: 1,
      likes: 0,
      retweets: 0,
      gainedFollowers: 0,
      media: { kind: "photo", prompt: "" },
    }) as Tweet;

  // data/mediaImages.ts가 파일명에서 만들어내는 것과 같은 모양
  const img = (file: string): MediaImage => ({
    keyword: file.split("__")[0],
    file,
    url: `/${file}.webp`,
  });

  it("접미사가 붙은 장도 원래 키워드로 매칭된다", () => {
    const got = pickImage(tweet("t1", "커피 마시는 중"), [img("커피__2")]);
    expect(got).toBe("/커피__2.webp");
  });

  it("같은 키워드의 여러 장이 모두 후보가 된다", () => {
    const pool = [img("커피"), img("커피__2"), img("커피__3")];
    const picked = new Set(
      Array.from({ length: 60 }, (_, i) => pickImage(tweet(`t${i}`, "커피 한 잔"), pool)),
    );
    // 트윗 id마다 해시로 갈리므로 한 장에 고정되면 안 된다
    expect(picked.size).toBeGreaterThan(1);
    for (const url of picked) expect(pool.some((p) => p.url === url)).toBe(true);
  });

  it("접미사가 키워드를 넓히지 않는다 — '커피__2'는 커피 트윗에만 붙는다", () => {
    expect(pickImage(tweet("t1", "녹차 마시는 중"), [img("커피__2")])).toBeNull();
  });

  it("숫자가 든 정당한 키워드를 망가뜨리지 않는다", () => {
    // 뒤 숫자만 떼는 규칙이었다면 '아이폰15'가 '아이폰'으로 뭉개져 오매칭이 났다.
    expect(pickImage(tweet("t1", "아이폰15 개봉"), [img("아이폰15")])).toBe("/아이폰15.webp");
    expect(pickImage(tweet("t2", "아이폰 개봉"), [img("아이폰15")])).toBeNull();
  });
});
