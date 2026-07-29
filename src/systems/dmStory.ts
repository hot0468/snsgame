import type { DMThread, GameState, SkillStatId } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import type { EventEffect } from "@/data/events";
import {
  BAKYURA_STORY,
  COLLECTOR_STORY,
  DM_STORIES,
  chaptersFor,
  KANRA_STORY,
  NOCOLOR_STORY,
  SAIKA_STORY,
  SETTON_STORY,
  TARO_STORY,
  dmStoryById,
  dmStoryNode,
  type DmStory,
  type DmStoryChoice,
} from "@/data/dmStory";
import { uid } from "@/utils/random";
import { changeFollowers } from "./followers";
import { clampAction, clampResource, gainSkill } from "./stats";

/**
 * 스토리 DM 진행 — 분기 대화를 노드 단위로 전진시킨다.
 *
 * ⚠️ 이 파일은 `systems/events.ts`(applyEffect)를 **부르지 않는다.** events.ts가 dm.ts를
 *    import하고 있어서(spawnFanDM) 순환이 생긴다. 대신 `EventEffect`를 **타입으로만** 빌려 쓰고
 *    선언형 필드만 여기서 직접 적용한다(customKey·unlockAttribute는 지원하지 않는다 — 필요해지면
 *    이 파일에 추가하라. 스토리 하나 때문에 이벤트 엔진을 통째로 끌어올 이유는 없다).
 */

/** 스토리 선택의 효과를 적용하고, 그중 팔로워 증감분을 돌려준다(토스트 표시용). */
function applyStoryEffect(state: GameState, effect: EventEffect | undefined): number {
  if (!effect) return 0;
  const res = state.resources;
  if (effect.action) res.action = clampAction(state, res.action + effect.action);
  if (effect.mental) res.mental = clampResource(res.mental + effect.mental);
  if (effect.morality) res.morality = clampResource(res.morality + effect.morality);
  if (effect.reputation) res.reputation = clampResource(res.reputation + effect.reputation);
  if (effect.money) state.money += effect.money;
  if (effect.skills) {
    for (const [k, v] of Object.entries(effect.skills)) {
      // flat: 선택지 결과가 서사로 확정 고지되고 대가를 이미 치렀다(stats.ts FLAT_GAIN 규칙).
      gainSkill(state, k as SkillStatId, v ?? 0, { flat: true });
    }
  }
  let delta = effect.followers ?? 0;
  if (effect.followersPct) {
    delta += Math.round((getActiveAccount(state).followers * effect.followersPct) / 100);
  }
  if (delta) changeFollowers(state, delta);
  return delta;
}

/** 이 스레드가 지금 보여줄 스토리 선택지들(스토리 스레드가 아니면 null). */
export function storyChoices(thread: DMThread): DmStoryChoice[] | null {
  const story = dmStoryById(thread.story?.id);
  if (!story || !thread.story) return null;
  return dmStoryNode(story, thread.story.node)?.choices ?? null;
}

/**
 * 스토리가 끝난 스레드인가 — 끝났으면 **답장 자체를 막는다**(선택지·직접 입력 모두).
 * 스토리 상대가 잡담 풀로 떨어지면 서사가 끝난 캐릭터가 "오늘 뭐 했어요?"를 되뇌어 결말이 망가진다.
 * 판정 근거는 `thread.story`가 지워졌는데 상대가 스토리 계정인 것 — 새 필드·세이브 변경이 필요 없다.
 */
export function isStoryOver(thread: DMThread): boolean {
  return !thread.story && isStoryHandle(thread.partnerHandle);
}

/** 상대가 노드에 들어오며 하는 말들을 스레드에 넣는다. */
function pushIntro(state: GameState, thread: DMThread, story: DmStory, nodeId: string): void {
  const node = dmStoryNode(story, nodeId);
  if (!node) return;
  for (const text of node.intro) {
    thread.messages.push({ id: uid("dmm"), from: "partner", text, day: state.day });
  }
  thread.unread = true;
}

/**
 * 스토리 스레드에서 한 수 진행한다 — 고른 문장과 그 즉답을 넣고 다음 노드로 넘어간다.
 * 마지막 노드(next=null)에 닿으면 `thread.story`를 지워 평범한 DM으로 되돌린다.
 * @returns 적용된 팔로워 증감과 상대의 즉답. 진행할 수 없으면 null.
 */
export function advanceDmStory(
  state: GameState,
  thread: DMThread,
  choice: DmStoryChoice,
): { followerDelta: number; partnerText: string } | null {
  const story = dmStoryById(thread.story?.id);
  if (!story || !thread.story) return null;

  thread.messages.push({ id: uid("dmm"), from: "me", text: choice.me, day: state.day });
  thread.messages.push({ id: uid("dmm"), from: "partner", text: choice.reply, day: state.day });
  thread.unread = false;

  const followerDelta = applyStoryEffect(state, choice.effect);

  if (choice.next) {
    thread.story = { id: story.id, node: choice.next };
    pushIntro(state, thread, story, choice.next);
  } else {
    delete thread.story; // 스토리 종료 — 이후엔 평범한 DM 스레드로 돌아간다
  }
  return { followerDelta, partnerText: choice.reply };
}

/** 스토리 DM 스레드를 새로 연다. 이미 진행했거나 끝난 스토리면 아무것도 하지 않는다. */
export function spawnDmStory(state: GameState, story: DmStory): boolean {
  const key = `dmStory_${story.id}`;
  if (state.eggs.done[key]) return false;
  state.eggs.done[key] = true;

  const thread: DMThread = {
    id: uid("dm"),
    partnerName: story.partnerName,
    partnerHandle: story.partnerHandle,
    attribute: "daily",
    isAdult: false,
    messages: [],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    // 스토리 흐름을 만남 제안이 가로채면 안 된다(maybePropose 차단용 기존 플래그 재사용).
    scam: true,
    story: { id: story.id, node: story.startNode },
  };
  getActiveAccount(state).dms.unshift(thread);
  pushIntro(state, thread, story, story.startNode);
  return true;
}

/** 사이카사이카에게 반응을 몇 번 쌓으면 그쪽이 알아보는지(좋아요+리트윗 합산) */
export const SAIKA_ENGAGE_TRIGGER = 3;

/**
 * 이 계정의 **다음 회차**를 연다(1회차면 새 스레드, 2회차부터는 같은 스레드에 이어 붙인다).
 *
 * 회차 해금 규칙:
 * - 아직 안 본 회차 중 가장 앞선 것 하나만 연다(`eggs.done`이 회차별로 잠근다).
 * - **앞 회차를 끝내야** 다음이 열린다(스레드에 진행 중인 story가 있으면 아무 일도 없다).
 *   → 트리거를 연타해도 회차가 한꺼번에 소진되지 않는다. 날짜 간격은 따로 두지 않는다:
 *     한 회차를 끝까지 걸어야 하는 것 자체가 이미 충분한 간격이다.
 * - 마지막 회차까지 다 봤으면 null(그 계정 DM은 `isStoryOver`로 영영 닫힌다).
 *
 * @returns 새로 연 스토리(활동 기록 문구에 쓴다). 열 게 없으면 null.
 */
export function spawnStoryFor(state: GameState, handle: string): DmStory | null {
  const chapters = chaptersFor(handle);
  if (!chapters.length) return null;
  const next = chapters.find((s) => !state.eggs.done[`dmStory_${s.id}`]);
  if (!next) return null;

  const thread = getActiveAccount(state).dms.find((t) => t.partnerHandle === handle);
  if (!thread) return spawnDmStory(state, next) ? next : null;
  if (thread.story) return null; // 진행 중인 회차가 있다 — 끝내야 다음이 열린다

  // 2회차부터는 스레드를 새로 만들지 않는다. 같은 상대가 며칠 뒤 다시 말을 거는 모양이라
  // 대화 이력이 이어지고, 쪽지함에 같은 사람이 두 줄로 뜨지도 않는다.
  state.eggs.done[`dmStory_${next.id}`] = true;
  thread.story = { id: next.id, node: next.startNode };
  pushIntro(state, thread, next, next.startNode);
  return next;
}

/** 스토리 트리거 동사 — 계정끼리 겹쳐도 된다(판정이 핸들 단위라 같이 열리지 않는다). */
type StoryTrigger = "like" | "retweet" | "follow" | "engage";

const STORY_TRIGGERS: Record<string, StoryTrigger> = {
  [KANRA_STORY.partnerHandle]: "like",
  [SETTON_STORY.partnerHandle]: "like",
  [NOCOLOR_STORY.partnerHandle]: "retweet",
  [BAKYURA_STORY.partnerHandle]: "retweet",
  [TARO_STORY.partnerHandle]: "follow",
  [COLLECTOR_STORY.partnerHandle]: "follow",
  [SAIKA_STORY.partnerHandle]: "engage",
};

/**
 * 그 동사가 이 계정의 트리거면 다음 회차를 연다(`systems/eggs.ts`의 훅들이 부른다).
 * 계정마다 동사가 하나씩 정해져 있어, 좋아요로 리트윗 계정이 열리는 일은 없다.
 */
export function maybeSpawnStoryFor(
  state: GameState,
  handle: string,
  trigger: StoryTrigger,
): DmStory | null {
  if (STORY_TRIGGERS[handle] !== trigger) return null;
  return spawnStoryFor(state, handle);
}

/** 활동 기록에 남길 문구(스토리가 선언한 게 없으면 상대 이름으로 만든다). */
export function storyArrivalTitle(story: DmStory): string {
  return story.arrivalTitle ?? `${story.partnerName}의 DM`;
}

/**
 * 트리거 판정용 핸들 — `data/accounts.ts`의 RUMOR_AUTHORS와 철자가 같아야 한다.
 * ⚠️ 트리거 **동사**는 계정끼리 겹쳐도 된다(좋아요=칸라·셋톤 / 리트윗=무색·바큐라 / 팔로우=타로·수집가).
 *    판정이 **핸들 단위**라 한 번의 행동으로 둘이 같이 열리지 않기 때문이다.
 *    새 스토리를 붙일 땐 동사가 아니라 **핸들이 겹치지 않는지**를 확인하라.
 */
export const KANRA_HANDLE = KANRA_STORY.partnerHandle;
export const NOCOLOR_HANDLE = NOCOLOR_STORY.partnerHandle;
export const TARO_HANDLE = TARO_STORY.partnerHandle;
export const SAIKA_HANDLE = SAIKA_STORY.partnerHandle;
export const SETTON_HANDLE = SETTON_STORY.partnerHandle;
export const BAKYURA_HANDLE = BAKYURA_STORY.partnerHandle;
export const COLLECTOR_HANDLE = COLLECTOR_STORY.partnerHandle;

/**
 * 이 핸들이 스토리 계정인가.
 * ⚠️ 스토리 계정에는 **범용 DM 이스터에그를 붙이면 안 된다.** 찐친 DM("우리 이제 찐친 아니에요?")이
 *    칸라칸라나 사이카사이카 입에서 나오면 캐릭터가 그 자리에서 무너진다(`systems/eggs.ts` bumpEngage).
 */
export function isStoryHandle(handle: string): boolean {
  return DM_STORIES.some((s) => s.partnerHandle === handle);
}
