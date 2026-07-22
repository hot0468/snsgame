import { describe, it, expect } from "vitest";
import { createAccount, pushTimeline, TIMELINE_MAX } from "@/core/state";
import type { Tweet } from "@/core/types";

/**
 * 타임라인 누적 상한 회귀 테스트.
 *
 * 이 파일이 지키는 것: 게시 트윗이 무한히 쌓이지 않는 것.
 * 전체 재렌더가 타임라인을 통째로 DOM 카드로 그리고, 저장이 상태를 통째로 직렬화하므로,
 * 상한이 없으면 장시간 플레이에서 상호작용마다 렉이 끼고 localStorage 쿼터를 넘겨 저장이 조용히 실패한다.
 *
 * pushTimeline이 (1) 최신을 앞에 넣고 (2) postCount로 총수를 세고 (3) TIMELINE_MAX로 잘라야 한다.
 * 새 게시 경로가 timeline.unshift를 직접 부르면 이 불변식이 깨지므로, 반드시 헬퍼를 거치게 고정한다.
 */

const tw = (id: string): Tweet => ({ id }) as Tweet;

describe("타임라인 누적 상한", () => {
  it("TIMELINE_MAX를 넘으면 오래된 것부터 잘린다", () => {
    const acc = createAccount("나", "me", "daily");
    for (let i = 0; i < TIMELINE_MAX + 50; i++) pushTimeline(acc, tw(`t${i}`));
    expect(acc.timeline.length).toBe(TIMELINE_MAX);
  });

  it("잘려도 총 게시물 수(postCount)는 계속 는다", () => {
    const acc = createAccount("나", "me", "daily");
    const total = TIMELINE_MAX + 123;
    for (let i = 0; i < total; i++) pushTimeline(acc, tw(`t${i}`));
    expect(acc.postCount).toBe(total);
  });

  it("최신 트윗이 항상 맨 앞에 있다", () => {
    const acc = createAccount("나", "me", "daily");
    for (let i = 0; i < TIMELINE_MAX + 10; i++) pushTimeline(acc, tw(`t${i}`));
    expect(acc.timeline[0].id).toBe(`t${TIMELINE_MAX + 9}`);
  });

  it("상한 이하에서는 그대로 쌓인다", () => {
    const acc = createAccount("나", "me", "daily");
    pushTimeline(acc, tw("a"));
    pushTimeline(acc, tw("b"));
    expect(acc.timeline.length).toBe(2);
    expect(acc.postCount).toBe(2);
    expect(acc.timeline[0].id).toBe("b");
  });
});
