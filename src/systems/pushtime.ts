import type { GameState } from "@/core/types";
import type { PushWork } from "@/data/pushtime";
import { PUSH_VIEW_COST } from "@/data/pushtime";
import { getActiveAccount } from "@/core/state";
import { chance, pick, uid } from "@/utils/random";
import { clampResource, clampSkill } from "./stats";

/**
 * 푸시타임 해금 DM / 콘텐츠 감상 로직.
 * - 애니덕 트윗 직후, 성인물 해제 + 음란도 높으면 확률적으로 링크 DM이 온다.
 * - 링크를 클릭하면 '푸시타임' 탭이 브라우저에 추가된다.
 */

/** 푸시타임 DM이 뜨는 최소 음란도 */
export const PUSH_LEWD_MIN = 100;
/** 애니덕 트윗 직후 푸시타임 DM이 올 확률 */
export const PUSH_DM_CHANCE = 0.4;

const PUSH_OPENERS = [
  "이거... 좋아하실 거 같아서 가져왔어요. 조용히 보세요 🔞",
  "취향이신 것 같아서요. 이 링크, 아무한테도 말하면 안 돼요.",
  "덕질하시는 거 보고 딱 감이 왔어요. 이런 것도 좋아하시죠? 링크 드려요.",
];

/** 이 계정에 이미 푸시타임 링크 DM이 있는지 */
function hasPushDM(state: GameState): boolean {
  return getActiveAccount(state).dms.some((t) => t.pushLink);
}

/**
 * 애니덕 트윗 직후 호출 — 성인물 해제 + 음란도 높음 + 미해금이면 확률적으로 링크 DM 생성.
 */
export function maybeSpawnPushDM(state: GameState): void {
  if (state.pushtimeUnlocked) return;
  if (!state.adultMode) return;
  const account = getActiveAccount(state);
  if (state.skills.lewd < PUSH_LEWD_MIN) return;
  if (hasPushDM(state)) return;
  if (!chance(PUSH_DM_CHANCE)) return;

  account.dms.unshift({
    id: uid("dm"),
    partnerName: "낯선 계정",
    partnerHandle: "quiet_curator",
    attribute: "anime",
    isAdult: true,
    messages: [{ id: uid("dmm"), from: "partner", text: pick(PUSH_OPENERS), day: state.day }],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    pushLink: true,
  });
}

/** 링크를 클릭하면 그 DM 스레드는 사라진다(탭은 이미 해금됨). */
export function consumePushLink(state: GameState): void {
  const account = getActiveAccount(state);
  account.dms = account.dms.filter((t) => !t.pushLink);
}

export interface PushViewResult {
  message: string;
}

/** 작품 1편 감상(결제). 음란도·정신력이 오르고 도덕성이 내린다. */
export function viewPushWork(state: GameState, work: PushWork): PushViewResult | null {
  if (state.money < PUSH_VIEW_COST) return null;
  state.money -= PUSH_VIEW_COST;
  state.skills.lewd = clampSkill(state.skills.lewd + 10);
  state.resources.mental = clampResource(state.resources.mental + 5);
  state.resources.morality = clampResource(state.resources.morality - 2);
  return {
    message: `『${work.title}』을(를) 결제하고 몰래 감상했다. 은밀한 만족감에 밤이 짧게 느껴진다. (음란 +10 · 정신력 +5 · 도덕성 -2)`,
  };
}
