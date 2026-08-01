import type { DMThread, GameState, SkillStatId } from "@/core/types";
import { getActiveAccount, pushTimeline } from "@/core/state";
import type { EventEffect } from "@/data/events";
import {
  BAKYURA_STORY,
  BAN_STORY,
  COLLECTOR_STORY,
  DM_STORIES,
  chaptersFor,
  GETO_STORY,
  IKOMA_STORY,
  ACTING_STORY,
  AIDE_STORY,
  BARKEEP_STORY,
  BENT_STORY,
  BLOOD_STORY,
  BRIEFING_STORY,
  BURNING_STORY,
  BLADE_STORY,
  BOSS_STORY,
  BRO_STORY,
  CALC_STORY,
  CAPTAIN_STORY,
  CAT_STORY,
  CHARGE_STORY,
  CHIEF_STORY,
  CLASSMATE_STORY,
  COUNSEL_STORY,
  DOC_STORY,
  FIRSTYEAR_STORY,
  FORMER_STORY,
  FROST_STORY,
  GIANT_STORY,
  GLASSES_STORY,
  GRIT_STORY,
  HAIR_STORY,
  HIMEHIME_STORY,
  HIRE_STORY,
  HUNGRY_STORY,
  INFOLADY_STORY,
  INTERN_STORY,
  KANRA_STORY,
  KUNOICHI_STORY,
  LEAD_STORY,
  MAYO_STORY,
  OPERATOR_STORY,
  PANDA_STORY,
  QUIET_STORY,
  RING_STORY,
  SADIST_STORY,
  SILK_STORY,
  SMILE_STORY,
  SNIPER_STORY,
  SNIPERTWO_STORY,
  STOPWATCH_STORY,
  SUPERVISOR_STORY,
  THUNDER_STORY,
  TRADER_STORY,
  TSUN_STORY,
  TWIN_ELDER_STORY,
  TWIN_YOUNGER_STORY,
  UMBRELLA_STORY,
  VAN_STORY,
  VOLT_STORY,
  WHEEL_STORY,
  WIG_STORY,
  WINGS_STORY,
  WOLF_STORY,
  NOCOLOR_STORY,
  SAIKA_STORY,
  SENSEI_STORY,
  SETTON_STORY,
  SHIELD_STORY,
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

/**
 * 스토리 DM이 주는 **스킬만** 깎는 계수.
 *
 * 회차 하나가 3노드 × 선택 1개고 노드마다 20~50이 붙어서, 한 계정을 3회차 완주하면 스킬이
 * 200~250 오른다. 스토리 계정이 57명이라 이대로 두면 열 명만 만나도 지식이 상한(999)을 찍는다.
 * 리소스(정신력·도덕성·평판)와 팔로워·돈은 서사 대가라 그대로 두고, **누적이 곧 만렙인 스킬만**
 * 줄인다. ⚠️ `flat: true`라 체감 감쇄를 안 타므로 여기서 안 줄이면 어디서도 안 줄어든다.
 */
export const DM_STORY_SKILL_RATE = 0.4;

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
      gainSkill(state, k as SkillStatId, Math.round((v ?? 0) * DM_STORY_SKILL_RATE), {
        flat: true,
      });
    }
  }
  let delta = effect.followers ?? 0;
  if (effect.followersPct) {
    delta += Math.round((getActiveAccount(state).followers * effect.followersPct) / 100);
  }
  if (delta) changeFollowers(state, delta);
  return delta;
}

/**
 * 다음 노드의 말이 아직 도착하지 않은 스레드인가("내일 보낼게요" 대기 중).
 * 대기 중엔 선택지도 직접 입력도 막는다 — 안 막으면 약속을 기다리는 상대와 잡담이 되어
 * 다음 날 도착하는 문장이 뜬금없어진다.
 */
export function isStoryPending(thread: DMThread): boolean {
  return thread.story?.pendingDay != null;
}

/** 이 스레드가 지금 보여줄 스토리 선택지들(스토리 스레드가 아니면 null). */
export function storyChoices(thread: DMThread): DmStoryChoice[] | null {
  const story = dmStoryById(thread.story?.id);
  if (!story || !thread.story) return null;
  if (isStoryPending(thread)) return []; // 대기 중 — 스토리 스레드이지만 지금 고를 건 없다
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
  if (choice.postTweet) postStoryTweet(state, choice.postTweet);

  if (choice.next) {
    const delay = choice.delayDays ?? 0;
    thread.story = { id: story.id, node: choice.next };
    // 약속한 며칠 뒤에 도착한다 — 지금은 노드만 예약하고 말은 넣지 않는다(onNewDay가 넣는다).
    if (delay > 0) thread.story.pendingDay = state.day + delay;
    else pushIntro(state, thread, story, choice.next);
  } else {
    delete thread.story; // 스토리 종료 — 이후엔 평범한 DM 스레드로 돌아간다
  }
  return { followerDelta, partnerText: choice.reply };
}

/**
 * 스토리 선택지가 시킨 문장을 내 계정으로 실제 게시한다(칸라의 대행 트윗 등).
 * 일반 트윗 경로(systems/tweetSystem.ts)를 타지 않는다 — 행동력·게시 슬롯을 쓰지 않고
 * 팔로워 계산도 하지 않는다(대가는 이미 choice.effect에 적혀 있다).
 */
function postStoryTweet(state: GameState, text: string): void {
  const account = getActiveAccount(state);
  pushTimeline(account, {
    id: uid("story_tweet"),
    authorName: account.name,
    authorHandle: account.handle,
    attribute: "daily",
    isAdult: false,
    text,
    createdDay: state.day,
    likes: 0,
    retweets: 0,
    gainedFollowers: 0,
  });
  account.lastTweetDay = state.day;
}

/**
 * 도착일이 된 스토리 노드의 말을 스레드에 넣는다(time.onNewDay에서 호출).
 * "내일 아침에 보낼게요"를 실제로 다음 날 지키게 하는 쪽 절반 — 예약은 advanceDmStory가 한다.
 */
export function deliverPendingStoryNodes(state: GameState): void {
  for (const thread of getActiveAccount(state).dms) {
    const pending = thread.story?.pendingDay;
    if (pending == null || state.day < pending) continue;
    const story = dmStoryById(thread.story!.id);
    if (!story) continue;
    delete thread.story!.pendingDay;
    pushIntro(state, thread, story, thread.story!.node);
  }
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
export type StoryTrigger = "like" | "retweet" | "follow" | "engage";

const STORY_TRIGGERS: Record<string, StoryTrigger> = {
  [KANRA_STORY.partnerHandle]: "like",
  [SETTON_STORY.partnerHandle]: "like",
  [NOCOLOR_STORY.partnerHandle]: "retweet",
  [BAKYURA_STORY.partnerHandle]: "retweet",
  [TARO_STORY.partnerHandle]: "follow",
  [COLLECTOR_STORY.partnerHandle]: "follow",
  [SAIKA_STORY.partnerHandle]: "engage",
  // 듀라라라 계정이 아닌 첫 스토리(월드 트리거 갈래) — 핸들이 안 겹치니 동사는 리트윗을 재사용한다.
  [IKOMA_STORY.partnerHandle]: "retweet",
  // 주술회전 갈래. 팔로우가 트리거인 건 "제 계정을 팔로우하셨더군요"로 1회차가 시작하기 때문이다.
  [GETO_STORY.partnerHandle]: "follow",
  // 탈환사 갈래. 리트윗인 건 "네가 퍼뜨린 덕에 의뢰가 들어왔다"가 1회차의 문이기 때문이다.
  [BAN_STORY.partnerHandle]: "retweet",
  // 리딩방(specialAccounts의 전용 트윗 계정). 좋아요인 건 팔로우가 1회성이라 2·3회차를 열 수 없기
  // 때문이다 — 이 계정은 계정 탐색에서 만나 팔로우하면 그걸로 끝이다.
  [LEAD_STORY.partnerHandle]: "like",
  // 자전거부 갈래 3인. 형(웃는 스프린터)만 리트윗인 건 "내 글을 퍼갔더라"가 1회차의 문이기 때문이고,
  // 나머지 둘은 좋아요다 — 셋 다 핸들이 달라 한 번의 행동으로 같이 열리지 않는다.
  [HIMEHIME_STORY.partnerHandle]: "like",
  [SMILE_STORY.partnerHandle]: "retweet",
  [BRO_STORY.partnerHandle]: "like",
  // 자전거부 나머지 3인. 조용한 신입만 리트윗인 건 "코멘트도 없는 숫자 글을 퍼갔다"가 1회차의 문이라서다.
  [QUIET_STORY.partnerHandle]: "retweet",
  [CHARGE_STORY.partnerHandle]: "like",
  [TSUN_STORY.partnerHandle]: "like",
  // 자전거부 3학년·매니저. 주장만 리트윗인 건 "팀 얘기가 밖으로 나가는 건 좋은 일"이 1회차의 문이라서다.
  [HAIR_STORY.partnerHandle]: "like",
  [CAPTAIN_STORY.partnerHandle]: "retweet",
  [STOPWATCH_STORY.partnerHandle]: "like",
  // 산의 날개와 방위대 2인. 근성 부대장만 좋아요인 건 "촌스럽다는 소리만 듣던 글에 반응이 왔다"가
  // 1회차의 문이고, 나머지 둘은 퍼간 행위 자체가 문이라 리트윗이다.
  [WINGS_STORY.partnerHandle]: "retweet",
  [GRIT_STORY.partnerHandle]: "like",
  [BENT_STORY.partnerHandle]: "retweet",
  // 방위대 3인 추가. 저격수만 리트윗인 건 "인기 없는 자리 얘기를 누가 퍼갔다"가 1회차의 문이라서다.
  [HUNGRY_STORY.partnerHandle]: "like",
  [SNIPER_STORY.partnerHandle]: "retweet",
  [ACTING_STORY.partnerHandle]: "like",
  // 오퍼레이터·방패·쌍둥이 형. 오퍼레이터만 리트윗인 건 "후방 얘기가 밖으로 나갔다"가 1회차의 문이라서다.
  [OPERATOR_STORY.partnerHandle]: "retweet",
  [SHIELD_STORY.partnerHandle]: "like",
  [TWIN_ELDER_STORY.partnerHandle]: "like",
  // 쌍둥이 동생만 리트윗인 건 "형 글만 퍼지는 계정에서 조용한 쪽이 퍼졌다"가 1회차의 문이라서다.
  // 형제가 같은 동사였으면 한쪽 트윗에 반응할 때 다른 쪽이 안 열리는 이유를 설명하기 어색해진다.
  [TWIN_YOUNGER_STORY.partnerHandle]: "retweet",
  [SENSEI_STORY.partnerHandle]: "like",
  [FIRSTYEAR_STORY.partnerHandle]: "like",
  // 1학년 셋 + 2학년. 말수 적은 동급생만 좋아요인 건 "별일 없는 게 제일 좋다"는 계정에 온
  // 조용한 반응이 1회차의 문이라서고, 나머지 둘은 퍼간 행위 자체가 문이라 리트윗이다.
  [CALC_STORY.partnerHandle]: "retweet",
  [CLASSMATE_STORY.partnerHandle]: "like",
  [RING_STORY.partnerHandle]: "retweet",
  // 무기광·마스코트·보조감독·심부름집·지사·부장. 퍼간 행위 자체가 문인 셋은 리트윗,
  // 조용한 계정에 반응이 왔다는 게 문인 셋은 좋아요다.
  [BLADE_STORY.partnerHandle]: "like",
  [PANDA_STORY.partnerHandle]: "retweet",
  [SUPERVISOR_STORY.partnerHandle]: "like",
  [BOSS_STORY.partnerHandle]: "like",
  [WIG_STORY.partnerHandle]: "retweet",
  [MAYO_STORY.partnerHandle]: "retweet",
  // 에도 갈래 나머지. 짝이 되는 계정은 동사를 갈라 뒀다(사장/실무, 부장/1번대) — 한쪽 트윗에
  // 반응했을 때 다른 쪽이 왜 안 열리는지가 서사로 설명돼야 하기 때문이다.
  [TRADER_STORY.partnerHandle]: "like",
  [GLASSES_STORY.partnerHandle]: "retweet",
  [UMBRELLA_STORY.partnerHandle]: "like",
  [SADIST_STORY.partnerHandle]: "retweet",
  [CHIEF_STORY.partnerHandle]: "like",
  [AIDE_STORY.partnerHandle]: "retweet",
  // 이계도시 갈래. 파트너끼리는 동사를 갈랐다(번개 짐승=좋아요 / 뱀눈 탈환사=리트윗).
  [KUNOICHI_STORY.partnerHandle]: "like",
  [COUNSEL_STORY.partnerHandle]: "retweet",
  [THUNDER_STORY.partnerHandle]: "like",
  [SILK_STORY.partnerHandle]: "retweet",
  [VAN_STORY.partnerHandle]: "like",
  [DOC_STORY.partnerHandle]: "retweet",
  [INFOLADY_STORY.partnerHandle]: "retweet",
  [VOLT_STORY.partnerHandle]: "like",
  [BARKEEP_STORY.partnerHandle]: "like",
  [HIRE_STORY.partnerHandle]: "retweet",
  [INTERN_STORY.partnerHandle]: "like",
  [GIANT_STORY.partnerHandle]: "retweet",
  [FORMER_STORY.partnerHandle]: "retweet",
  [BURNING_STORY.partnerHandle]: "like",
  [WOLF_STORY.partnerHandle]: "retweet",
  [FROST_STORY.partnerHandle]: "like",
  [SNIPERTWO_STORY.partnerHandle]: "like",
  [BLOOD_STORY.partnerHandle]: "retweet",
  [BRIEFING_STORY.partnerHandle]: "retweet",
  [CAT_STORY.partnerHandle]: "like",
  // 운전수 둘은 동사를 갈랐다(운반 전문 배달꾼=좋아요 / 차 모는 운반 담당=리트윗).
  [WHEEL_STORY.partnerHandle]: "retweet",
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

/** 이 계정의 스토리를 여는 동사(스토리 계정이 아니면 null). 도감 힌트 표시용. */
export function storyTriggerFor(handle: string): StoryTrigger | null {
  return STORY_TRIGGERS[handle] ?? null;
}

/** 이 계정에서 **본 회차 수**(도감 진행률용). 스토리 계정이 아니면 0. */
export function seenChapterCount(state: GameState, handle: string): number {
  return chaptersFor(handle).filter((s) => state.eggs.done[`dmStory_${s.id}`]).length;
}

/**
 * 지금 트리거를 쓰면 **새 회차가 열리는가**(팔로우 목록 배지용).
 * `spawnStoryFor`와 같은 판정을 상태 변경 없이 그대로 본다 — 조건이 갈리면 배지가 거짓말을 한다.
 */
export function hasNextChapter(state: GameState, handle: string): boolean {
  const chapters = chaptersFor(handle);
  if (!chapters.length) return false;
  if (!chapters.some((s) => !state.eggs.done[`dmStory_${s.id}`])) return false;
  const thread = getActiveAccount(state).dms.find((t) => t.partnerHandle === handle);
  return !thread?.story; // 진행 중인 회차가 있으면 아직 안 열린다
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
export const IKOMA_HANDLE = IKOMA_STORY.partnerHandle;
export const GETO_HANDLE = GETO_STORY.partnerHandle;

/**
 * 이 핸들이 스토리 계정인가.
 * ⚠️ 스토리 계정에는 **범용 DM 이스터에그를 붙이면 안 된다.** 찐친 DM("우리 이제 찐친 아니에요?")이
 *    칸라칸라나 사이카사이카 입에서 나오면 캐릭터가 그 자리에서 무너진다(`systems/eggs.ts` bumpEngage).
 */
export function isStoryHandle(handle: string): boolean {
  return DM_STORIES.some((s) => s.partnerHandle === handle);
}
