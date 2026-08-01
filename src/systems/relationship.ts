import type { AttributeId, GameState, PlayerAccount, RelationshipProgress, TweetKind } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import {
  charsForAttribute,
  getRelChar,
  RELATIONSHIP_CHARS,
  type RelationshipChar,
} from "@/data/relationships";
import { applyEffect } from "./events";
import { skillTo100 } from "./stats";
import { addSchedule } from "./time";

/**
 * 관계 시스템 로직 — 호감도 획득, 만남 성사, arc 진행/선물.
 * 상태(relationships)는 **PlayerAccount 단위**라 항상 활성 계정으로 접근한다(계정 전환 시 각자 추적).
 */

/** 매칭 트윗 1건당 호감도 */
export const AFFINITY_PER_TWEET = 8;
/** 만남 성사 시 호감도 */
export const AFFINITY_PER_MEET = 20;
/** 만남 실패(바람맞음) 시 호감도 */
export const AFFINITY_MEET_FAIL = 3;
/** arc가 열리는 호감도 임계 [Arc1, Arc2, Arc3]. 완주(stage 3) 인덱스는 없다(undefined). */
export const REL_STAGE_THRESHOLDS: readonly number[] = [30, 60, 90];
/** 만남 성사 기본 확률(친화력 0일 때) */
export const MEET_BASE_CHANCE = 0.4;
/** 친화력 만렙이 성사 확률에 더하는 최대 보너스 */
export const MEET_SKILL_BONUS = 0.5;

/** 활성 계정의 캐릭터 진행 레코드를 가져오되, 없으면 생성한다(변형용). */
function relOf(acc: PlayerAccount, charId: string): RelationshipProgress {
  return (acc.relationships[charId] ??= { affinity: 0, stage: 0, bond: "none" });
}

/**
 * **변형용** 진행 레코드 — 없으면 만들어서 state에 붙인 뒤 돌려준다.
 *
 * ⚠️ 호감도를 바꿀 땐 반드시 이걸 써라. `relStateOf`는 **읽기 전용**이라 레코드가 없을 때
 *    새 객체를 돌려주고, 거기에 쓰면 변경이 조용히 사라진다(실제로 그 버그를 냈다).
 */
export function mutableRelOf(state: GameState, charId: string): RelationshipProgress {
  return relOf(getActiveAccount(state), charId);
}

/**
 * 읽기 전용 진행 조회(렌더용). 없으면 기본값의 **새 객체**를 돌려준다(공유 상수 오염 방지).
 * ui가 호감도 바·stage·bond를 그릴 때 이걸 쓴다(state를 변형하지 않는다).
 */
export function relStateOf(state: GameState, charId: string): RelationshipProgress {
  return getActiveAccount(state).relationships[charId] ?? { affinity: 0, stage: 0, bond: "none" };
}

/**
 * 지금 열람 가능한 arc의 인덱스(0=Arc1·1=Arc2·2=Arc3)를 돌려준다. 없으면 null.
 * 다음 arc는 stage와 같은 인덱스이고, affinity가 그 임계 이상이어야 열린다.
 */
export function pendingArc(rel: RelationshipProgress): number | null {
  const threshold = REL_STAGE_THRESHOLDS[rel.stage]; // stage 3(완주)이면 undefined
  if (threshold === undefined) return null;
  return rel.affinity >= threshold ? rel.stage : null;
}

/** 활성 계정 기준, 해당 캐릭터에 열람 대기 중인 arc가 있는지(카톡 '새 이벤트!' 뱃지용) */
export function relPendingArc(state: GameState, charId: string): number | null {
  return pendingArc(relStateOf(state, charId));
}

/** gainAffinityFromTweet가 돌려주는 캐릭터별 호감도 변화 */
export interface RelAffinityGain {
  char: RelationshipChar;
  affinity: number;
  /** 이번 상승으로 새로 열린 arc 인덱스(없으면 null) — ui 토스트/뱃지용 */
  pending: number | null;
}

/**
 * 게시 트윗의 attr+kind와 매칭되는 활성 계정 캐릭터의 호감도를 +8 한다.
 * 성능: 로스터를 attr로 먼저 좁히고(charsForAttribute), 활성 계정에 해금된 계열만 순회한다.
 * @returns 호감도가 오른 캐릭터 목록(ui 표시용)
 */
export function gainAffinityFromTweet(
  state: GameState,
  attr: AttributeId,
  kind: TweetKind,
): RelAffinityGain[] {
  const acc = getActiveAccount(state);
  const gains: RelAffinityGain[] = [];
  for (const char of charsForAttribute(attr)) {
    if (char.likedKind !== kind) continue;
    if (!acc.unlockedAttributes.includes(char.attribute)) continue;
    const rel = relOf(acc, char.id);
    rel.affinity += AFFINITY_PER_TWEET;
    gains.push({ char, affinity: rel.affinity, pending: pendingArc(rel) });
  }
  return gains;
}

/** 만남 약속 성사 확률: 0.4 + 친화력(0~100)/100 × 0.5 (친화력 0→40%, 만렙→90%) */
export function meetSuccessChance(state: GameState): number {
  return MEET_BASE_CHANCE + (skillTo100(state.skills.sociability) / 100) * MEET_SKILL_BONUS;
}

/** 만남 성사 — 호감도 +20. @returns 갱신된 진행 레코드 */
export function bumpMeetAffinity(state: GameState, charId: string): RelationshipProgress {
  const rel = relOf(getActiveAccount(state), charId);
  rel.affinity += AFFINITY_PER_MEET;
  return rel;
}

/** 만남 약속 결과 */
export interface MeetResult {
  success: boolean;
  /** 이번 만남으로 오른 호감도(+20 성사 / +3 실패) */
  gain: number;
  /** 만남 후 새로 열린 arc 인덱스(없으면 null) */
  pending: number | null;
}

/**
 * 카톡 만남 약속을 성사 판정한다(ui가 약속 발동 시 호출).
 * 성사면 +20, 실패(바람맞음)면 +3. 문구는 ui가 success로 분기한다.
 * forceSuccess=true(내가 제안 → 상대가 수락한 확정 약속)면 판정 없이 무조건 성사.
 */
export function resolveMeet(state: GameState, charId: string, forceSuccess = false): MeetResult {
  const rel = relOf(getActiveAccount(state), charId);
  const success = forceSuccess || Math.random() < meetSuccessChance(state);
  const gain = success ? AFFINITY_PER_MEET : AFFINITY_MEET_FAIL;
  rel.affinity += gain;
  if (success) rel.met = true; // 성사한 만남만 카톡 '친구' 자격이 된다(바람맞음은 제외)
  return { success, gain, pending: pendingArc(rel) };
}

/**
 * 열람 대기 중인 arc를 선택지로 완주한다(ui가 관계 이벤트 모달에서 호출).
 * - 선택지의 EventEffect를 applyEffect로 적용(수치 보상은 arc별로 동일하게 데이터에 선언).
 * - Arc2(인덱스 1) 완주 시 bond 확정: choiceIndex 0=friend, 1=lover.
 * - Arc3(인덱스 2) 완주 시 선물 지급: ownedItems.push(giftId) + 스케줄 기록.
 * - stage를 완주한 arc 다음 값으로 올린다.
 * @returns 표시할 결과 문구(customKey 동적 문구가 있으면 그것, 없으면 choice.result). 열 arc가 없으면 "".
 */
export function advanceRelStage(state: GameState, charId: string, choiceIndex: number): string {
  const acc = getActiveAccount(state);
  const rel = relOf(acc, charId);
  const arc = pendingArc(rel);
  const char = getRelChar(charId);
  if (arc === null || !char) return "";

  const choice = char.events[arc].choices[choiceIndex];
  const dynamic = choice ? applyEffect(state, choice.effect) : undefined;

  if (arc === 1) rel.bond = choiceIndex === 1 ? "lover" : "friend";
  rel.stage = (arc + 1) as RelationshipProgress["stage"];

  if (arc === 2) {
    // ⚠️ giftId는 REL_GIFTS에 정의돼 있어야 서랍장/판매에서 해석된다(resolveItem 함정).
    state.ownedItems.push(char.giftId);
    addSchedule(state, `${char.nickname}의 선물이 도착했다`, "system");
  }
  addSchedule(state, `${char.nickname} — 관계 이벤트`, "sns");

  return dynamic || (choice?.result ?? "");
}

/**
 * 카톡 목록에 잡히는 관계 캐릭터 풀 — 해금된 계열이면서 **이미 연결된(호감도>0)** 캐릭터.
 * ui는 이 풀을 met(만남 성사) 여부로 갈라 '친구'(만난 사람)와 '새로운 인연'(아직 안 만남)으로 나눈다.
 * (기존 시스템 카톡(집주인·월급 토스트)과는 별개 목록.)
 */
export function relCharsInKakao(state: GameState): RelationshipChar[] {
  const acc = getActiveAccount(state);
  return RELATIONSHIP_CHARS.filter(
    (c) => acc.unlockedAttributes.includes(c.attribute) && relStateOf(state, c.id).affinity > 0,
  );
}

/** 카톡 목록에 표시할 안 읽은 관계 이벤트가 하나라도 있는지(작업표시줄 뱃지용).
 *  관계 이벤트는 '만난(met)' 캐릭터에게만 열리므로 뱃지도 met 기준으로 판정한다(카톡 새 이벤트 섹션과 정합). */
export function hasPendingRelEvent(state: GameState): boolean {
  return relCharsInKakao(state).some(
    (c) => relStateOf(state, c.id).met && relPendingArc(state, c.id) !== null,
  );
}
