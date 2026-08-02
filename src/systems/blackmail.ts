import type { GameState } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import {
  BLACKMAIL_AMOUNTS,
  BLACKMAIL_LEAK_LINES,
  BLACKMAIL_LINES,
  BLACKMAIL_MAX_STAGE,
  BLACKMAIL_MEET_DEMANDS,
  BLACKMAIL_MEET_SCENES,
  BLACKMAIL_MONEY_DEMANDS,
  BLACKMAIL_PAID_REPLY,
  BLACKMAIL_REFUSED_REPLY,
  type BlackmailMeetScene,
  type BlackmailSource,
} from "@/data/blackmail";
import { changeFollowers } from "./followers";
import { pushKakao } from "./kakao";
import { clampMental, clampResource, gainSkill } from "./stats";
import { addSchedule } from "./time";
import { chance, pick, uid } from "@/utils/random";

/**
 * 협박·유출 축 — 강압 조우에서 찍힌 것이 며칠 뒤 돌아온다.
 *
 * 기존 강압 조우는 전부 그 자리에서 끝났다. 이 축만 **시간을 두고 다시 온다**:
 *   강압 씬(촬영 언급) → 씨 심김 → 며칠 뒤 카톡 → 돈/만남/거절 → (거절이면) 유출
 *
 * ⚠️ **한 번에 하나만 굴러간다.** 여러 건이 겹치면 카톡이 협박으로 도배되고, 어느 건에
 *    답한 건지 플레이어가 추적할 수 없다. 진행 중이면 새 씨는 조용히 무시한다.
 *
 * ⚠️ **'강압/범죄 안 보기'(adultNoCoercion)를 켠 계정에는 씨가 심기지 않는다.** 강압 씬을
 *    안 보는 사람에게 그 후속만 오면 맥락 없는 협박이 된다.
 */

/** 첫 연락까지 걸리는 날. 그 자리에서 오면 조우의 일부로 읽혀 '나중에 온다'는 공포가 안 산다. */
export const BLACKMAIL_FIRST_DELAY = 5;
/** 한 번 응한 뒤 다음 요구까지 걸리는 날. */
export const BLACKMAIL_NEXT_DELAY = 7;
/** 요구가 만남일 확률(나머지는 돈). */
export const BLACKMAIL_MEET_CHANCE = 0.45;

/** 유출 시 잃는 팔로워 비율. */
export const LEAK_FOLLOWER_LOSS = 0.25;
/** 유출 시 잃는 평판(0~100 스케일). */
export const LEAK_REPUTATION_LOSS = 22;
/** 유출 시 잃는 정신력. */
export const LEAK_MENTAL_LOSS = 26;

/** 지금 협박이 굴러가는 중인지. */
export function hasBlackmail(state: GameState): boolean {
  return state.blackmail !== null;
}

/**
 * 강압 씬을 겪은 자리에서 부른다 — 촬영이 언급된 씬만 씨를 심는다.
 *
 * @returns 실제로 심었으면 true(이미 진행 중이거나 조건 미달이면 false)
 */
export function seedBlackmail(state: GameState, source: BlackmailSource): boolean {
  if (state.gameOver) return false;
  if (!state.adultMode || state.adultNoCoercion) return false;
  if (state.blackmail) return false;
  state.blackmail = {
    source,
    stage: 0,
    nextDay: state.day + BLACKMAIL_FIRST_DELAY,
    demand: chance(BLACKMAIL_MEET_CHANCE) ? "meet" : "money",
    paidTotal: 0,
    threadId: null,
  };
  return true;
}

/** 이번 단계의 요구 금액. */
export function blackmailAmount(stage: number): number {
  const i = Math.min(Math.max(stage, 0), BLACKMAIL_AMOUNTS.length - 1);
  return BLACKMAIL_AMOUNTS[i];
}

/**
 * 도착일이 됐으면 협박 카톡을 보낸다(`time.onNewDay`가 부른다).
 *
 * ⚠️ **멱등해야 한다.** 이미 답을 안 한 스레드가 떠 있으면 또 보내지 않는다 —
 *    독촉이 쌓이면 어느 카드에 답한 건지 알 수 없어진다.
 */
export function maybeSpawnBlackmailDM(state: GameState): boolean {
  const bm = state.blackmail;
  if (!bm || state.gameOver) return false;
  if (state.day < bm.nextDay) return false;
  // 아직 답 안 한 협박 카톡이 있으면 새로 보내지 않는다.
  if (bm.threadId && state.kakao.some((t) => t.id === bm.threadId && t.blackmail && !t.blackmail.resolved)) {
    return false;
  }

  const lines = BLACKMAIL_LINES[bm.source];
  const amount = blackmailAmount(bm.stage);
  const demandLine =
    bm.demand === "money"
      ? `${BLACKMAIL_MONEY_DEMANDS[Math.min(bm.stage, BLACKMAIL_MONEY_DEMANDS.length - 1)]} ` +
        `${amount.toLocaleString("ko-KR")}원입니다.`
      : BLACKMAIL_MEET_DEMANDS[Math.min(bm.stage, BLACKMAIL_MEET_DEMANDS.length - 1)];

  const thread = pushKakao(
    state,
    lines.sender,
    // 첫 연락에서만 "무엇을 찍었는지"를 밝힌다. 2회차부터는 이미 아는 사이라 요구만 온다.
    bm.stage === 0 ? [...lines.intro, demandLine] : [demandLine],
    { hue: 355 },
  );
  thread.blackmail = { stage: bm.stage, demand: bm.demand, amount, resolved: false };
  bm.threadId = thread.id;
  return true;
}

/** 스레드의 협박 카드를 닫고, 다음 단계를 예약하거나 끝낸다. */
function advance(state: GameState, threadId: string, ended: boolean): void {
  const bm = state.blackmail;
  const thread = state.kakao.find((t) => t.id === threadId);
  if (thread?.blackmail) thread.blackmail.resolved = true;
  if (!bm) return;
  if (ended) {
    state.blackmail = null;
    return;
  }
  // 마지막 단계에서 또 응하면 상대가 만족하고 손을 뗀다 — 무한 반복은 축이 아니라 벌이다.
  if (bm.stage >= BLACKMAIL_MAX_STAGE) {
    state.blackmail = null;
    return;
  }
  bm.stage += 1;
  bm.nextDay = state.day + BLACKMAIL_NEXT_DELAY;
  bm.demand = chance(BLACKMAIL_MEET_CHANCE) ? "meet" : "money";
  bm.threadId = null;
}

/**
 * 요구한 돈을 보낸다.
 * @returns 실제로 보냈으면 true(잔고 부족이면 false — 아무것도 바꾸지 않는다)
 */
export function payBlackmail(state: GameState, threadId: string): boolean {
  const bm = state.blackmail;
  const thread = state.kakao.find((t) => t.id === threadId);
  if (!bm || !thread?.blackmail || thread.blackmail.resolved) return false;
  const amount = thread.blackmail.amount;
  if (state.money < amount) return false;

  state.money -= amount;
  bm.paidTotal += amount;
  state.resources.mental = clampMental(state, state.resources.mental - 6);
  thread.messages.push({
    id: uid("kkom"),
    from: "me",
    text: "보냈습니다. 이제 끝인 거죠.",
    day: state.day,
  });
  thread.messages.push({ id: uid("kkom"), from: "them", text: BLACKMAIL_PAID_REPLY, day: state.day });
  addSchedule(state, `협박 송금 -${amount.toLocaleString("ko-KR")}원`, "system");
  advance(state, threadId, false);
  return true;
}

/**
 * 만남 요구에 응한다.
 * @returns 겪은 씬(요구가 만남이 아니거나 이미 끝난 카드면 null)
 */
export function acceptBlackmailMeet(state: GameState, threadId: string): BlackmailMeetScene | null {
  const bm = state.blackmail;
  const thread = state.kakao.find((t) => t.id === threadId);
  if (!bm || !thread?.blackmail || thread.blackmail.resolved) return null;
  if (thread.blackmail.demand !== "meet") return null;

  const scene = BLACKMAIL_MEET_SCENES[Math.min(bm.stage, BLACKMAIL_MEET_SCENES.length - 1)];
  gainSkill(state, "lewd", scene.lewdGain);
  gainSkill(state, "pervert", scene.pervertGain);
  state.resources.mental = clampMental(state, state.resources.mental + scene.mentalDelta);
  state.resources.morality = clampResource(state.resources.morality + scene.moralityDelta);
  if (scene.unlockGroup) getActiveAccount(state).groupUnlocked = true;

  thread.messages.push({ id: uid("kkom"), from: "me", text: "…어디로 가면 됩니까.", day: state.day });
  addSchedule(state, scene.title.replace("🔞 ", ""), "offline");
  advance(state, threadId, false);
  return scene;
}

/**
 * 요구를 거절한다 — 파일이 유출된다.
 *
 * 돈도 만남도 안 주는 대신 팔로워·평판·정신력을 크게 잃고, 협박은 그 자리에서 끝난다.
 * **끝나는 게 보상이다** — 계속 끌려다니느냐 한 번에 치르느냐의 선택지가 이 축의 핵심이다.
 * @returns 유출 문구
 */
export function refuseBlackmail(state: GameState, threadId: string): string {
  const thread = state.kakao.find((t) => t.id === threadId);
  const line = pick(BLACKMAIL_LEAK_LINES as string[]);
  if (thread?.blackmail && !thread.blackmail.resolved) {
    thread.messages.push({ id: uid("kkom"), from: "me", text: "안 보냅니다. 마음대로 하세요.", day: state.day });
    thread.messages.push({
      id: uid("kkom"),
      from: "them",
      text: BLACKMAIL_REFUSED_REPLY,
      day: state.day,
    });
  }

  const account = getActiveAccount(state);
  const lost = Math.floor(account.followers * LEAK_FOLLOWER_LOSS);
  if (lost > 0) changeFollowers(state, -lost);
  state.resources.reputation = clampResource(state.resources.reputation - LEAK_REPUTATION_LOSS);
  state.resources.mental = clampMental(state, state.resources.mental - LEAK_MENTAL_LOSS);
  addSchedule(state, `유출 — 팔로워 -${lost.toLocaleString("ko-KR")}`, "sns");

  advance(state, threadId, true);
  return line;
}
