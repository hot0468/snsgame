import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { maybeQueueNews, resolveNews } from "@/systems/news";
import { NEWS_BOOST_RATE, NEWS_IGNORE_LOSS_RATE } from "@/data/news";

describe("기사화 (모듈 A)", () => {
  it("maybeQueueNews: 예약되면 스냅샷이 담기고, 중복 예약은 스킵", () => {
    const s = createInitialState();
    // 강제로 예약: 확률을 우회하기 위해 직접 세팅 경로를 검증 — 예약 상태를 만들고 필드 확인.
    s.pendingNews = { tweetId: "t1", tweetText: "원문", gain: 1000, distorted: false };
    const before = s.pendingNews;
    maybeQueueNews(s, "t2", "다른글", 2000); // 이미 예약 → 스킵
    expect(s.pendingNews).toBe(before);
  });

  it("maybeQueueNews: gain<=0이면 예약하지 않는다(떡상 아님)", () => {
    const s = createInitialState();
    maybeQueueNews(s, "t1", "원문", 0);
    expect(s.pendingNews).toBeNull();
  });

  it("resolveNews('ack'): 정상 2차 유입 + 클리어", () => {
    const s = createInitialState();
    s.pendingNews = { tweetId: "t1", tweetText: "원문", gain: 1000, distorted: false };
    const acc = getActiveAccount(s);
    const f0 = acc.followers;
    const delta = resolveNews(s, "ack");
    expect(delta).toBe(Math.round(1000 * NEWS_BOOST_RATE));
    expect(acc.followers).toBe(f0 + delta);
    expect(s.pendingNews).toBeNull();
  });

  it("resolveNews('ignore'): 왜곡 무시 손실 + 클리어", () => {
    const s = createInitialState();
    s.pendingNews = { tweetId: "t1", tweetText: "원문", gain: 1000, distorted: true };
    const delta = resolveNews(s, "ignore");
    expect(delta).toBe(-Math.round(1000 * NEWS_IGNORE_LOSS_RATE));
    expect(s.pendingNews).toBeNull();
  });

  it("resolveNews('clarify'): 해명 트윗이 타임라인에 남고 클리어", () => {
    const s = createInitialState();
    s.pendingNews = { tweetId: "t1", tweetText: "원문", gain: 1000, distorted: true };
    const acc = getActiveAccount(s);
    const n0 = acc.timeline.length;
    resolveNews(s, "clarify");
    expect(acc.timeline.length).toBe(n0 + 1);
    expect(s.pendingNews).toBeNull();
  });

  it("resolveNews: 예약이 없으면 0을 반환하고 부작용 없음", () => {
    const s = createInitialState();
    s.pendingNews = null;
    expect(resolveNews(s, "ack")).toBe(0);
    expect(s.pendingNews).toBeNull();
  });
});
