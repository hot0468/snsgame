import type { DMThread, GameState, SkillStatId } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import type { EventEffect } from "@/data/events";
import {
  DM_STORIES,
  KANRA_STORY,
  NOCOLOR_STORY,
  SAIKA_STORY,
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

/** 칸라칸라 스토리를 연다(그의 소문 트윗에 **좋아요**를 눌렀을 때). */
export function spawnKanraStory(state: GameState): boolean {
  return spawnDmStory(state, KANRA_STORY);
}

/** 무색의 무리 스토리를 연다(그들의 트윗을 **리트윗**했을 때 — 퍼뜨려야 눈에 띈다). */
export function spawnNocolorStory(state: GameState): boolean {
  return spawnDmStory(state, NOCOLOR_STORY);
}

/** 이름없는 타로 스토리를 연다(그를 **팔로우**했을 때 — 소심한 쪽이 그제야 용기를 낸다). */
export function spawnTaroStory(state: GameState): boolean {
  return spawnDmStory(state, TARO_STORY);
}

/** 사이카사이카에게 반응을 몇 번 쌓으면 그쪽이 알아보는지(좋아요+리트윗 합산) */
export const SAIKA_ENGAGE_TRIGGER = 3;

/**
 * 사이카사이카 스토리를 연다(반응 **누적** — 동사 하나가 아니라 횟수가 조건이다).
 * 앞의 셋이 좋아요·리트윗·팔로우를 하나씩 가져가 남은 동사가 없어, 조건 자체를 바꿨다.
 * 찐친 이스터에그(5회)보다 먼저 걸리도록 임계값을 낮게 둔다.
 */
export function spawnSaikaStory(state: GameState): boolean {
  return spawnDmStory(state, SAIKA_STORY);
}

/**
 * 트리거 판정용 핸들 — `data/accounts.ts`의 RUMOR_AUTHORS와 철자가 같아야 한다.
 * ⚠️ 스토리 3종은 트리거 동사를 일부러 갈라 뒀다: 칸라=좋아요 / 무색=리트윗 / 타로=팔로우.
 *    새 스토리를 붙일 때도 겹치지 않는 동사를 골라라 — 겹치면 한 번의 행동으로 둘이 동시에 열린다.
 */
export const KANRA_HANDLE = KANRA_STORY.partnerHandle;
export const NOCOLOR_HANDLE = NOCOLOR_STORY.partnerHandle;
export const TARO_HANDLE = TARO_STORY.partnerHandle;
export const SAIKA_HANDLE = SAIKA_STORY.partnerHandle;

/**
 * 이 핸들이 스토리 계정인가.
 * ⚠️ 스토리 계정에는 **범용 DM 이스터에그를 붙이면 안 된다.** 찐친 DM("우리 이제 찐친 아니에요?")이
 *    칸라칸라나 사이카사이카 입에서 나오면 캐릭터가 그 자리에서 무너진다(`systems/eggs.ts` bumpEngage).
 */
export function isStoryHandle(handle: string): boolean {
  return DM_STORIES.some((s) => s.partnerHandle === handle);
}
