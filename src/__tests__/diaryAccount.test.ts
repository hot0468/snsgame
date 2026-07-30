import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  linesForHandle,
  makeCharacterTweet,
  makeDiaryTweet,
  profileFromAuthor,
} from "@/data/accounts";
import { homeFeedTweets } from "@/systems/exploreSystem";

/**
 * 관찰일기 계정(@daily_crush_log) 회귀 테스트.
 *
 * 이 파일이 지키는 것: **하루에 딱 한 줄, 날짜 순서대로, 다 쓰면 멈춘다**.
 * - 랜덤 pick 풀(makeCharacterTweet)에 다시 들어가면 같은 날 여러 줄이 뒤섞여 떠서
 *   '일기'라는 설정이 무너진다.
 * - 홈 피드가 확률 판정으로 되돌아가면 일기가 없는 날이 생긴다.
 * - 프로필이 문구 전체를 깔면(다른 고정 계정의 규약) 아직 안 쓴 날의 일기가 미리 보인다.
 */

const HANDLE = "daily_crush_log";
const LINES = linesForHandle(HANDLE)!;

describe("관찰일기 계정", () => {
  it("하루 한 줄, 날짜 순서대로 나온다", () => {
    expect(LINES.length).toBeGreaterThanOrEqual(30);
    for (let day = 1; day <= LINES.length; day++) {
      expect(makeDiaryTweet(day)?.text, `${day}일차`).toBe(LINES[day - 1]);
    }
  });

  it("문구를 다 쓰면 트윗이 멈춘다(반복하지 않는다)", () => {
    expect(makeDiaryTweet(LINES.length)).not.toBeNull();
    for (const day of [LINES.length + 1, LINES.length + 2, LINES.length * 3]) {
      expect(makeDiaryTweet(day), `${day}일차`).toBeNull();
    }
  });

  it("같은 날 여러 번 불러도 같은 줄이다", () => {
    const texts = new Set(Array.from({ length: 20 }, () => makeDiaryTweet(7)?.text));
    expect(texts.size).toBe(1);
  });

  it("프로필에는 그 날짜까지 쓴 분량만 최신순으로 깔린다", () => {
    const prof = profileFromAuthor("그 사람 관찰일기", HANDLE, "daily", false, 4);
    expect(prof.timeline).toHaveLength(4);
    expect(prof.timeline.map((t) => t.text)).toEqual(LINES.slice(0, 4).reverse());
    expect(prof.timeline.map((t) => t.createdDay)).toEqual([4, 3, 2, 1]);
    // 다 쓴 뒤엔 마지막 줄에서 멈춘다(문구 수를 넘지 않는다)
    const later = profileFromAuthor("그 사람 관찰일기", HANDLE, "daily", false, LINES.length + 50);
    expect(later.timeline).toHaveLength(LINES.length);
  });

  it("랜덤 캐릭터 계정 풀에는 들어가지 않는다", () => {
    for (let i = 0; i < 300; i++) {
      expect(makeCharacterTweet(5).authorHandle).not.toBe(HANDLE);
    }
  });

  it("홈 피드에 매일 정확히 한 칸 들어가고, 다 쓴 뒤엔 안 들어간다", () => {
    const s = createInitialState();
    s.day = 9;
    for (let i = 0; i < 20; i++) {
      const mine = homeFeedTweets(s).filter((t) => t.authorHandle === HANDLE);
      expect(mine).toHaveLength(1);
      expect(mine[0].text).toBe(makeDiaryTweet(9)!.text);
    }
    s.day = LINES.length + 1;
    for (let i = 0; i < 20; i++) {
      expect(homeFeedTweets(s).filter((t) => t.authorHandle === HANDLE)).toHaveLength(0);
    }
  });
});
