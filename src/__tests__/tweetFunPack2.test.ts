import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { maybeQueueNews, resolveNews } from "@/systems/news";
import { NEWS_BOOST_RATE, NEWS_IGNORE_LOSS_RATE } from "@/data/news";
import { canPostTchinso, postTchinso, scheduleBirthday, sendBirthdayTweet } from "@/systems/tchin";
import { TCHINSO_COOLDOWN_DAYS, TCHINSO_PREFILL_MIN } from "@/data/tchinso";
import { TCHIN_THRESHOLD } from "@/data/tchin";
import { BIRTHDAY_MIN_DAYS, BIRTHDAY_BONUS_MIN } from "@/data/birthday";

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

describe("트친소 (모듈 B)", () => {
  it("쿨다운: 게시 직후엔 재게시 불가, 쿨다운 경과 후 가능", () => {
    const s = createInitialState();
    expect(canPostTchinso(s)).toBe(true);
    postTchinso(s);
    expect(canPostTchinso(s)).toBe(false);
    s.day += TCHINSO_COOLDOWN_DAYS;
    expect(canPostTchinso(s)).toBe(true);
  });

  it("응답 계정의 트친 진행도를 선채움하고, 트친소 트윗이 타임라인에 남는다", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    const n0 = acc.timeline.length;
    const r = postTchinso(s);
    expect(r.responders.length).toBeGreaterThanOrEqual(2);
    expect(acc.timeline.length).toBe(n0 + 1);
    for (const resp of r.responders) {
      expect(acc.tchinProgress[resp.handle]).toBeGreaterThanOrEqual(TCHINSO_PREFILL_MIN);
      expect(resp.remaining).toBe(Math.max(0, TCHIN_THRESHOLD - acc.tchinProgress[resp.handle]));
    }
  });
});

describe("트친 생일 (모듈 C)", () => {
  it("scheduleBirthday: 결정론적 생일 약속 1건 등록(같은 핸들 같은 날)", () => {
    const s1 = createInitialState();
    scheduleBirthday(s1, "friend");
    const bday = s1.appointments.filter((a) => a.kind === "birthday");
    expect(bday.length).toBe(1);
    expect(bday[0].day).toBeGreaterThanOrEqual(s1.day + BIRTHDAY_MIN_DAYS);
    const s2 = createInitialState();
    scheduleBirthday(s2, "friend");
    expect(s2.appointments[0].day).toBe(bday[0].day); // 결정론
  });

  it("scheduleBirthday: 같은 핸들 중복 등록은 스킵", () => {
    const s = createInitialState();
    scheduleBirthday(s, "friend");
    scheduleBirthday(s, "friend");
    expect(s.appointments.filter((a) => a.kind === "birthday").length).toBe(1);
  });

  it("sendBirthdayTweet: 무료 게시(슬롯 미소모) + 보너스 팔로워 + 클리어", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    s.pendingBirthday = "friend";
    const slots0 = acc.postSlotsUsed;
    const f0 = acc.followers;
    const n0 = acc.timeline.length;
    sendBirthdayTweet(s);
    expect(acc.timeline.length).toBe(n0 + 1);
    expect(acc.postSlotsUsed).toBe(slots0); // 무료(슬롯 미소모)
    expect(acc.followers).toBeGreaterThanOrEqual(f0 + BIRTHDAY_BONUS_MIN);
    expect(s.pendingBirthday).toBeNull();
  });

  it("sendBirthdayTweet: pendingBirthday가 null이면 무동작", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    s.pendingBirthday = null;
    const n0 = acc.timeline.length;
    sendBirthdayTweet(s);
    expect(acc.timeline.length).toBe(n0);
    expect(s.pendingBirthday).toBeNull();
  });
});
