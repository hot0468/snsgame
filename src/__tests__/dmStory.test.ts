import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import type { Account, GameState, Tweet } from "@/core/types";
import { DM_STORIES, KANRA_STORY, NOCOLOR_STORY, SAIKA_STORY, TARO_STORY } from "@/data/dmStory";
import {
  KANRA_HANDLE,
  NOCOLOR_HANDLE,
  SAIKA_ENGAGE_TRIGGER,
  SAIKA_HANDLE,
  TARO_HANDLE,
  spawnKanraStory,
  spawnTaroStory,
} from "@/systems/dmStory";
import { dmReplyOptions, replyDM } from "@/systems/dm";
import { onFollow } from "@/systems/eggs";
import { reactToTweet, retweetTweet } from "@/systems/exploreSystem";

/**
 * 스토리 DM 회귀 테스트.
 * 그래프 무결성(끊긴 next·고아 노드)은 조용히 대화가 멈추는 버그라 눈으로 못 잡는다 — 여기서 막는다.
 */

function kanraTweet(state: GameState): Tweet {
  return {
    id: "rumor_test",
    authorName: KANRA_STORY.partnerName,
    authorHandle: KANRA_HANDLE,
    attribute: "daily",
    isAdult: false,
    text: "오늘의 소문 정산 들어갑니다 ✨",
    createdDay: state.day,
    likes: 0,
    retweets: 0,
    gainedFollowers: 0,
  };
}

const storyThread = (s: GameState) => getActiveAccount(s).dms.find((t) => t.story?.id === "kanra");

describe("스토리 그래프 무결성", () => {
  it("모든 선택지의 next가 실재하는 노드를 가리킨다", () => {
    for (const story of DM_STORIES) {
      const ids = new Set(story.nodes.map((n) => n.id));
      expect(ids.has(story.startNode), `${story.id}: 시작 노드가 없다`).toBe(true);
      for (const node of story.nodes) {
        expect(node.intro.length, `${story.id}.${node.id}: intro 없음`).toBeGreaterThan(0);
        expect(node.choices.length, `${story.id}.${node.id}: 선택지 없음`).toBeGreaterThan(0);
        for (const c of node.choices) {
          if (c.next !== null) {
            expect(ids.has(c.next), `${story.id}.${node.id} → 없는 노드 '${c.next}'`).toBe(true);
          }
          expect(c.me.trim(), `${story.id}.${node.id}: me 비어 있음`).not.toBe("");
          expect(c.reply.trim(), `${story.id}.${node.id}: reply 비어 있음`).not.toBe("");
        }
      }
    }
  });

  it("도달할 수 없는 고아 노드가 없다", () => {
    for (const story of DM_STORIES) {
      const reached = new Set([story.startNode]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const node of story.nodes) {
          if (!reached.has(node.id)) continue;
          for (const c of node.choices) {
            if (c.next && !reached.has(c.next)) {
              reached.add(c.next);
              grew = true;
            }
          }
        }
      }
      const orphans = story.nodes.filter((n) => !reached.has(n.id)).map((n) => n.id);
      expect(orphans, `${story.id}: 도달 불가 노드`).toEqual([]);
    }
  });

  it("어느 분기로 가든 끝이 난다(무한 루프 없음)", () => {
    for (const story of DM_STORIES) {
      // 노드 수보다 많이 전진하면 사이클이다. 각 노드에서 모든 선택지를 따라간다.
      const walk = (nodeId: string, depth: number, seen: string[]): void => {
        expect(depth, `${story.id}: 사이클 의심 ${seen.join("→")}`).toBeLessThanOrEqual(
          story.nodes.length,
        );
        const node = story.nodes.find((n) => n.id === nodeId)!;
        for (const c of node.choices) {
          if (c.next) walk(c.next, depth + 1, [...seen, c.next]);
        }
      };
      walk(story.startNode, 0, [story.startNode]);
    }
  });
});

describe("스토리 트리거는 서로 겹치지 않는다", () => {
  // 칸라=좋아요 1회 / 무색=리트윗 1회 / 타로=팔로우 1회 / 사이카=반응 누적.
  // 앞의 셋은 '동사'가 갈려 있고 사이카만 '횟수'라, 단발 행동으로는 사이카가 안 열린다.
  // 겹치면 한 번의 행동으로 둘이 동시에 열린다.
  const openedIds = (s: GameState) =>
    getActiveAccount(s)
      .dms.filter((t) => t.story)
      .map((t) => t.story!.id)
      .sort();

  const tweetOf = (s: GameState, handle: string, name: string): Tweet => ({
    ...kanraTweet(s),
    id: "t_" + handle,
    authorName: name,
    authorHandle: handle,
  });

  it("좋아요는 칸라칸라만 연다", () => {
    const s = createInitialState();
    reactToTweet(s, tweetOf(s, KANRA_HANDLE, "칸라칸라"), true);
    reactToTweet(s, tweetOf(s, NOCOLOR_HANDLE, "무색의 무리"), true);
    reactToTweet(s, tweetOf(s, TARO_HANDLE, "이름없는 타로"), true);
    expect(openedIds(s)).toEqual(["kanra"]);
  });

  it("리트윗은 무색의 무리만 연다", () => {
    const s = createInitialState();
    retweetTweet(s, tweetOf(s, NOCOLOR_HANDLE, "무색의 무리"));
    retweetTweet(s, tweetOf(s, TARO_HANDLE, "이름없는 타로"));
    expect(openedIds(s)).toEqual(["nocolor"]);
  });

  it("팔로우는 이름없는 타로만 연다", () => {
    const s = createInitialState();
    const acct = (handle: string, name: string): Account => ({
      id: "acct_" + handle,
      name,
      handle,
      attribute: "daily",
      isAdult: false,
      bio: "",
      followers: 100,
      timeline: [],
      followed: false,
    });
    onFollow(s, acct(TARO_HANDLE, "이름없는 타로"));
    onFollow(s, acct(KANRA_HANDLE, "칸라칸라"));
    onFollow(s, acct(NOCOLOR_HANDLE, "무색의 무리"));
    expect(openedIds(s)).toEqual(["taro"]);
  });

  it("세 동사를 다 쓰면 셋 다 열린다", () => {
    const s = createInitialState();
    reactToTweet(s, tweetOf(s, KANRA_HANDLE, "칸라칸라"), true);
    retweetTweet(s, tweetOf(s, NOCOLOR_HANDLE, "무색의 무리"));
    onFollow(s, {
      id: "a",
      name: "이름없는 타로",
      handle: TARO_HANDLE,
      attribute: "daily",
      isAdult: false,
      bio: "",
      followers: 100,
      timeline: [],
      followed: false,
    });
    expect(openedIds(s)).toEqual(["kanra", "nocolor", "taro"]);
  });
});

describe("사이카사이카 스토리 (반응 누적 트리거)", () => {
  const saikaTweet = (s: GameState, i: number): Tweet => ({
    ...kanraTweet(s),
    id: "t_saika_" + i,
    authorName: SAIKA_STORY.partnerName,
    authorHandle: SAIKA_HANDLE,
    text: "오늘도 사람들을 보았습니다 다들 참 사랑스럽습니다",
  });
  const thread = (s: GameState) => getActiveAccount(s).dms.find((t) => t.story?.id === "saika");

  it("반응이 임계값에 닿아야 열린다 — 한두 번으로는 안 열린다", () => {
    const s = createInitialState();
    reactToTweet(s, saikaTweet(s, 1), true);
    expect(thread(s)).toBeUndefined();
    for (let i = 2; i <= SAIKA_ENGAGE_TRIGGER; i++) reactToTweet(s, saikaTweet(s, i), true);
    expect(thread(s)).toBeDefined();
    expect(thread(s)!.story!.node).toBe(SAIKA_STORY.startNode);
  });

  it("좋아요와 리트윗이 합산된다", () => {
    const s = createInitialState();
    reactToTweet(s, saikaTweet(s, 1), true);
    retweetTweet(s, saikaTweet(s, 2));
    reactToTweet(s, saikaTweet(s, 3), true);
    expect(thread(s)).toBeDefined();
  });

  it("악플은 집계에 안 들어간다(호감 상호작용만 센다)", () => {
    const s = createInitialState();
    for (let i = 1; i <= SAIKA_ENGAGE_TRIGGER + 2; i++) reactToTweet(s, saikaTweet(s, i), false);
    expect(thread(s), "악플만으로는 열리면 안 된다").toBeUndefined();
  });

  it("반응을 더 쌓아도 스레드는 하나뿐이다", () => {
    const s = createInitialState();
    for (let i = 1; i <= 10; i++) reactToTweet(s, saikaTweet(s, i), true);
    expect(getActiveAccount(s).dms.filter((t) => t.story?.id === "saika")).toHaveLength(1);
  });
});

describe("스토리 계정엔 범용 찐친 DM이 붙지 않는다", () => {
  it("칸라칸라에 5회 반응해도 찐친 스레드가 생기지 않는다", () => {
    const s = createInitialState();
    for (let i = 0; i < 6; i++) {
      reactToTweet(s, { ...kanraTweet(s), id: "t" + i }, true);
    }
    const kanraThreads = getActiveAccount(s).dms.filter((t) => t.partnerHandle === KANRA_HANDLE);
    expect(kanraThreads, "칸라칸라 스레드는 스토리 하나뿐이어야 한다").toHaveLength(1);
    expect(kanraThreads[0].messages.some((m) => m.text.includes("찐친"))).toBe(false);
  });

  it("일반 계정은 찐친 DM이 그대로 뜬다(회귀 방지)", () => {
    const s = createInitialState();
    const plain: Tweet = { ...kanraTweet(s), authorName: "구름토끼", authorHandle: "cloud_rabbit" };
    for (let i = 0; i < 6; i++) reactToTweet(s, { ...plain, id: "p" + i }, true);
    expect(
      getActiveAccount(s).dms.some((t) => t.messages.some((m) => m.text.includes("찐친"))),
    ).toBe(true);
  });
});

describe("무색의 무리 스토리", () => {
  const nocolorTweet = (state: GameState): Tweet => ({
    ...kanraTweet(state),
    id: "rumor_nocolor",
    authorName: NOCOLOR_STORY.partnerName,
    authorHandle: NOCOLOR_HANDLE,
    text: "우리는 색이 없다. 그래서 어떤 색과도 섞인다",
  });
  const thread = (s: GameState) => getActiveAccount(s).dms.find((t) => t.story?.id === "nocolor");

  it("리트윗해야 열린다 — 좋아요로는 안 열린다", () => {
    const s = createInitialState();
    reactToTweet(s, nocolorTweet(s), true);
    expect(thread(s), "좋아요는 무색의 무리 트리거가 아니다").toBeUndefined();

    retweetTweet(s, nocolorTweet(s));
    expect(thread(s)).toBeDefined();
    expect(thread(s)!.story!.node).toBe(NOCOLOR_STORY.startNode);
  });

  it("칸라칸라와 트리거가 겹치지 않는다", () => {
    const s = createInitialState();
    reactToTweet(s, kanraTweet(s), true); // 칸라만 열려야 한다
    expect(getActiveAccount(s).dms.filter((t) => t.story).map((t) => t.story!.id)).toEqual([
      "kanra",
    ]);
  });

  it("두 번 리트윗해도 한 번만 열린다", () => {
    const s = createInitialState();
    retweetTweet(s, nocolorTweet(s));
    retweetTweet(s, { ...nocolorTweet(s), id: "rumor_nocolor2" });
    expect(getActiveAccount(s).dms.filter((t) => t.story?.id === "nocolor")).toHaveLength(1);
  });

  it("끝까지 진행하면 스토리가 닫힌다", () => {
    const s = createInitialState();
    retweetTweet(s, nocolorTweet(s));
    const t = thread(s)!;
    // invite(무심) → suspect(무심) = 종료 분기
    replyDM(s, t, "cool");
    expect(t.story!.node).toBe("suspect");
    replyDM(s, t, "cool");
    expect(t.story).toBeUndefined();
  });
});

describe("이름없는 타로 스토리", () => {
  it("친절 루트로 데뷔 노드까지 가고, 응원 엔딩이 평판·정신력을 올린다", () => {
    const s = createInitialState();
    spawnTaroStory(s);
    const t = getActiveAccount(s).dms.find((x) => x.story?.id === "taro")!;

    // hello(친절) → confide(친절) → debut
    replyDM(s, t, "friendly");
    expect(t.story!.node).toBe("confide");
    replyDM(s, t, "friendly");
    expect(t.story!.node).toBe("debut");

    // 반전 고백이 데뷔 노드 안내문에 들어 있다(모든 분기가 이걸 보고 결말을 고른다).
    expect(t.messages.some((m) => m.text.includes("그쪽 글을 보고"))).toBe(true);

    s.resources.mental = 50;
    s.resources.reputation = 50;
    replyDM(s, t, "friendly");
    expect(t.story).toBeUndefined();
    expect(s.resources.mental).toBe(60);
    expect(s.resources.reputation).toBe(58);
  });

  it("초반에 밀어내면 위축 노드에서 조용히 끝난다", () => {
    const s = createInitialState();
    spawnTaroStory(s);
    const t = getActiveAccount(s).dms.find((x) => x.story?.id === "taro")!;
    replyDM(s, t, "cool");
    expect(t.story!.node).toBe("hesitate");
    replyDM(s, t, "cool");
    expect(t.story).toBeUndefined();
  });
});

describe("칸라칸라 스토리 진행", () => {
  it("칸라칸라 트윗에 좋아요를 누르면 DM이 열리고, 두 번은 안 열린다", () => {
    const s = createInitialState();
    reactToTweet(s, kanraTweet(s), true);

    const t = storyThread(s);
    expect(t, "스토리 스레드가 생겨야 한다").toBeDefined();
    expect(t!.partnerHandle).toBe(KANRA_HANDLE);
    expect(t!.story!.node).toBe(KANRA_STORY.startNode);
    // 시작 노드의 인사말이 그대로 들어간다.
    expect(t!.messages.map((m) => m.text)).toEqual(KANRA_STORY.nodes[0].intro);

    reactToTweet(s, kanraTweet(s), true);
    expect(getActiveAccount(s).dms.filter((x) => x.story?.id === "kanra")).toHaveLength(1);
  });

  it("선택지는 현재 노드 것이고, 고르면 다음 노드로 넘어간다", () => {
    const s = createInitialState();
    spawnKanraStory(s);
    const t = storyThread(s)!;

    const node = KANRA_STORY.nodes.find((n) => n.id === t.story!.node)!;
    const opts = dmReplyOptions(s, t);
    expect(opts.map((o) => o.me)).toEqual(node.choices.map((c) => c.me));

    const chosen = node.choices[0];
    replyDM(s, t, chosen.tone);
    expect(t.story!.node).toBe(chosen.next);
    // 내 문장 → 즉답 → 다음 노드 인사말 순으로 쌓인다.
    const texts = t.messages.map((m) => m.text);
    expect(texts).toContain(chosen.me);
    expect(texts).toContain(chosen.reply);
    const nextNode = KANRA_STORY.nodes.find((n) => n.id === chosen.next)!;
    expect(texts.slice(-nextNode.intro.length)).toEqual(nextNode.intro);
  });

  it("대담 선택지는 성인물 해제 없이도 보인다(수위가 아니라 분기다)", () => {
    const s = createInitialState();
    expect(s.adultMode).toBe(false);
    spawnKanraStory(s);
    expect(dmReplyOptions(s, storyThread(s)!).some((o) => o.tone === "bold")).toBe(true);
  });

  it("끝 노드를 고르면 스토리가 끝나고 효과가 적용된다", () => {
    const s = createInitialState();
    spawnKanraStory(s);
    const t = storyThread(s)!;

    // start → insist(무심) → 거절(무심, next=null, 정신력+3·도덕성+2)
    replyDM(s, t, "cool");
    expect(t.story!.node).toBe("insist");
    s.resources.mental = 50; // 초기값 100은 상한이라 +3이 클램프된다 — 여유를 두고 잰다
    const mental = s.resources.mental;
    const morality = s.resources.morality;

    replyDM(s, t, "cool");
    expect(t.story, "끝나면 story가 지워져야 한다").toBeUndefined();
    expect(s.resources.mental).toBe(mental + 3);
    expect(s.resources.morality).toBe(morality + 2);

    // 스토리가 끝난 뒤엔 평범한 DM으로 돌아간다(선택지가 계속 나온다).
    expect(dmReplyOptions(s, t).length).toBeGreaterThan(0);
  });

  it("팔로워 % 효과가 현재 팔로워 기준으로 적용된다", () => {
    const s = createInitialState();
    spawnKanraStory(s);
    const t = storyThread(s)!;
    getActiveAccount(s).followers = 10_000;

    // start(친절) → offer(친절) → deal(친절, 팔로워+400) → twist
    replyDM(s, t, "friendly");
    replyDM(s, t, "friendly");
    replyDM(s, t, "friendly");
    expect(t.story!.node).toBe("twist");
    expect(getActiveAccount(s).followers).toBe(10_400);

    // twist 무심 엔딩은 팔로워를 안 건드린다
    replyDM(s, t, "cool");
    expect(t.story).toBeUndefined();
    expect(getActiveAccount(s).followers).toBe(10_400);
  });
});
