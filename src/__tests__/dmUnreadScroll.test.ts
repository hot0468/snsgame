import { describe, it, expect } from "vitest";
import type { DMThread } from "@/core/types";
import { firstUnreadIndex, anchorFits } from "@/ui/sns/snsPages";

/** 테스트용 최소 스레드 — 스크롤 위치 계산은 messages·readCount만 본다. */
function thread(froms: ("me" | "partner")[], readCount?: number): DMThread {
  return {
    id: "t1",
    partnerName: "상대",
    partnerHandle: "them",
    attribute: "daily",
    isAdult: false,
    messages: froms.map((from, i) => ({ id: `m${i}`, from, text: `말${i}`, day: 1 })),
    unread: true,
    readCount,
    metOffline: false,
    wantsToMeet: false,
  };
}

describe("쪽지 안 읽은 첫 줄 위치", () => {
  it("readCount가 있으면 그 지점이 안 읽은 첫 줄이다", () => {
    expect(firstUnreadIndex(thread(["me", "partner", "partner", "partner"], 2))).toBe(2);
  });

  it("readCount가 메시지 수보다 크면 마지막 줄로 잡는다(꼬인 세이브 방어)", () => {
    expect(firstUnreadIndex(thread(["me", "partner"], 99))).toBe(1);
  });

  it("구세이브(readCount 없음)는 마지막 상대 말 뭉치의 첫 줄로 어림한다", () => {
    // me, partner, me, partner, partner → 마지막 뭉치는 index 3부터
    expect(firstUnreadIndex(thread(["me", "partner", "me", "partner", "partner"]))).toBe(3);
  });

  it("빈 스레드는 0", () => {
    expect(firstUnreadIndex(thread([]))).toBe(0);
  });
});

/**
 * 앵커 수명. 읽음 처리 dispatch가 microtask 뒤 재렌더를 한 번 더 부르므로
 * 앵커는 그 렌더까지 살아 있어야 한다(한 렌더만 쓰고 지우면 맨 아래로 튄다).
 */
describe("안 읽은 첫 줄 앵커 수명", () => {
  const t = thread(["me", "partner", "partner"], 1);

  it("같은 스레드·같은 길이면 유지된다(읽음 처리 뒤 재렌더)", () => {
    expect(anchorFits({ threadId: "t1", len: 3 }, t)).toBe(true);
  });

  it("답장으로 말이 늘면 버린다", () => {
    expect(anchorFits({ threadId: "t1", len: 2 }, t)).toBe(false);
  });

  it("다른 스레드로 옮기면 버린다", () => {
    expect(anchorFits({ threadId: "other", len: 3 }, t)).toBe(false);
  });

  it("앵커가 없거나 스레드가 없으면 false", () => {
    expect(anchorFits(null, t)).toBe(false);
    expect(anchorFits({ threadId: "t1", len: 3 }, null)).toBe(false);
  });
});
