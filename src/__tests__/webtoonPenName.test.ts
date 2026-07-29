import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { WEBTOON_BUZZ, WEBTOON_BUZZ_ADULT } from "@/data/webtoonBuzz";
import { authorBuzzTier, signAuthorContract, webtoonBuzzTweets } from "@/systems/author";
import { searchTweetsByWord } from "@/systems/exploreSystem";
import { loadGame } from "@/systems/save";

/**
 * 웹툰 작가 필명 → SNS 검색 반응.
 * 필명이 비면 검색 대상이 사라져 기능 자체가 죽으므로, 어떤 경로로 계약해도 필명은 항상 채워져야 한다.
 */

function contracted(penName: string, adult = false) {
  const s = createInitialState();
  signAuthorContract(s, adult, penName);
  return s;
}

describe("작가 필명", () => {
  it("데뷔 시 정한 필명이 계약에 저장된다", () => {
    const s = contracted("먹구름");
    expect(s.authorContract?.penName).toBe("먹구름");
  });

  it("필명을 비우면 계정명으로 채운다(검색 대상이 없어지지 않게)", () => {
    const s = createInitialState();
    signAuthorContract(s, false, "   ");
    expect(s.authorContract?.penName).toBe(getActiveAccount(s).name);
    expect(s.authorContract?.penName).not.toBe("");
  });

  it("구세이브(필명 없음)를 불러오면 계정명으로 복구된다", () => {
    const raw = contracted("먹구름") as any;
    delete raw.authorContract.penName;

    const s = loadGame(JSON.stringify(raw))!;
    expect(s.authorContract!.penName).toBe(getActiveAccount(s).name);
  });
});

describe("필명 검색 반응", () => {
  it("필명으로 검색하면 내 웹툰 반응 트윗이 뜬다", () => {
    const s = contracted("먹구름");
    const buzz = webtoonBuzzTweets(s, "먹구름");

    expect(buzz.length).toBeGreaterThan(0);
    for (const t of buzz) expect(t.text).toContain("먹구름");
    // {pen} 치환이 빠지면 화면에 그대로 노출된다
    for (const t of buzz) expect(t.text).not.toContain("{pen}");
  });

  it("공백·@·대소문자가 달라도 같은 필명으로 본다", () => {
    const s = contracted("Ink Cloud");
    for (const q of ["ink cloud", "  InkCloud ", "@inkcloud"]) {
      expect(webtoonBuzzTweets(s, q).length, q).toBeGreaterThan(0);
    }
  });

  it("다른 단어로 검색하면 반응이 섞이지 않는다", () => {
    const s = contracted("먹구름");
    expect(webtoonBuzzTweets(s, "햇살")).toEqual([]);
  });

  it("계약 전에는 아무 반응도 없다", () => {
    const s = createInitialState();
    expect(webtoonBuzzTweets(s, "먹구름")).toEqual([]);
  });

  it("성인물 계약이면 성인 반응 풀에서 나온다", () => {
    const s = contracted("먹구름", true);
    const tier = authorBuzzTier(s);
    const adultLines = WEBTOON_BUZZ_ADULT[tier].map((l) => l.replaceAll("{pen}", "먹구름"));
    const generalLines = WEBTOON_BUZZ[tier].map((l) => l.replaceAll("{pen}", "먹구름"));

    for (const t of webtoonBuzzTweets(s, "먹구름")) {
      expect(adultLines).toContain(t.text);
      expect(generalLines).not.toContain(t.text);
      expect(t.isAdult).toBe(true);
    }
  });

  it("인기 구간이 높을수록 반응이 많이 뜬다", () => {
    const quiet = contracted("먹구름");
    expect(authorBuzzTier(quiet)).toBe(0);

    const famous = contracted("먹구름");
    famous.accounts[0].followers = 5_000_000; // 월급 급등 → 최고 구간
    expect(authorBuzzTier(famous)).toBe(3);
    expect(webtoonBuzzTweets(famous, "먹구름").length).toBeGreaterThan(
      webtoonBuzzTweets(quiet, "먹구름").length,
    );
  });

  it("SNS 검색 결과 맨 앞에 반응이 붙는다", () => {
    const s = contracted("먹구름");
    const results = searchTweetsByWord(s, "먹구름");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].text).toContain("먹구름");
  });
});
