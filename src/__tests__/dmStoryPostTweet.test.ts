import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { DM_STORIES } from "@/data/dmStory";
import { advanceDmStory, storyChoices } from "@/systems/dmStory";
import type { DmStory, DmStoryChoice } from "@/data/dmStory";
import type { DMThread, GameState } from "@/core/types";

/**
 * 스토리 DM의 `postTweet` 계약 회귀 테스트.
 *
 * 지키는 것: **"제가 올릴게요"라고 답하면 실제로 내 타임라인에 그 글이 올라간다.**
 * 다음 노드가 "어제 그 글 잘 퍼졌더라"로 시작하는 스토리가 여럿이라, 안 올라가면
 * 그 대사가 통째로 거짓말이 된다(data/dmStory.ts의 sentence 노드 주석 참조).
 *
 * ⚠️ 선택지 문구로 "게시를 약속했는지"를 자동 판별하지는 않는다 — "안 올릴게요"처럼
 *    부정형이 섞여 있어 오탐이 난다. 대신 postTweet이 달린 선택은 **반드시 게시된다**는
 *    기계적 계약만 고정한다.
 */

/** 모든 스토리의 (스토리, 노드, 선택지) 중 postTweet이 달린 것들. */
function postingChoices(): { story: DmStory; node: string; choice: DmStoryChoice }[] {
  const out: { story: DmStory; node: string; choice: DmStoryChoice }[] = [];
  for (const story of DM_STORIES) {
    for (const node of story.nodes) {
      for (const choice of node.choices) {
        if (choice.postTweet) out.push({ story, node: node.id, choice });
      }
    }
  }
  return out;
}

/**
 * 그 스토리 스레드를 특정 노드에 세워 둔 상태를 만든다.
 * spawnStoryFor는 핸들·회차 해금을 따지므로 여기선 스레드를 직접 세운다 —
 * 검증 대상은 '선택 → 게시'이지 스레드 생성 경로가 아니다.
 */
function stateAtNode(story: DmStory, node: string): { s: GameState; thread: DMThread } {
  const s = createInitialState();
  const thread: DMThread = {
    id: `t_${story.id}`,
    partnerName: "상대",
    partnerHandle: `h_${story.id}`,
    attribute: "daily",
    isAdult: false,
    messages: [],
    unread: false,
    story: { id: story.id, node },
  };
  getActiveAccount(s).dms.push(thread);
  return { s, thread };
}

describe("스토리 DM — 올린다고 하면 실제로 올라간다", () => {
  it("postTweet이 달린 선택지가 하나 이상 있다", () => {
    expect(postingChoices().length).toBeGreaterThan(0);
  });

  it("postTweet 문구는 비어 있지 않다", () => {
    for (const { story, node, choice } of postingChoices()) {
      expect(choice.postTweet!.trim().length, `${story.id}/${node}`).toBeGreaterThan(0);
    }
  });

  it("고르면 그 문장이 그대로 내 타임라인 맨 앞에 올라간다", () => {
    for (const { story, node, choice } of postingChoices()) {
      const { s, thread } = stateAtNode(story, node);
      const before = getActiveAccount(s).timeline.length;

      // 그 노드에서 실제로 고를 수 있는 선택지인지 먼저 확인한 뒤 진행한다.
      const live = (storyChoices(thread) ?? []).find((c) => c.me === choice.me);
      expect(live, `${story.id}/${node}: 선택지를 못 찾았다`).toBeTruthy();
      advanceDmStory(s, thread, live!);

      const after = getActiveAccount(s).timeline;
      expect(after.length, `${story.id}/${node}: 트윗이 안 올라갔다`).toBe(before + 1);
      expect(after[0].text, `${story.id}/${node}`).toBe(choice.postTweet);
    }
  });

  it("이번에 문구를 채운 선택지 5개가 실제로 게시된다", () => {
    // 게시를 약속해놓고 아무 일도 안 일어나던 선택지들. 문구가 지워지면 여기서 걸린다.
    const promised = [
      "정정 글 올릴게요. 지금이라도.",
      "제가 올릴게요. 그 정도는 할 수 있어요",
      "제가 흐릴게요. 그날 그 시간에 저도 그 근처에 있었다고 쓸게요",
      "미안한데 이건 못 참아요. 제가 제일 먼저 올릴게요",
      "제가 올릴게요. 우리 이름으로요",
    ];
    const withTweet = new Set(postingChoices().map((p) => p.choice.me));
    for (const me of promised) {
      expect(withTweet.has(me), `"${me}" 에 postTweet이 없다`).toBe(true);
    }
  });
});
