import type { AttributeId, GameState, PlayerAccount } from "@/core/types";
import { clampSkill } from "./stats";

/**
 * 트윗 속성 해금의 **단일 관문**.
 *
 * 속성을 해금하는 경로는 6곳(증기 구매·조우 25%·오프라인 활동 35%·너튜브 시청·이벤트 효과·
 * 콘셉트 계정 개설)이나 되며, 그중 5곳은 증기와 무관하다. 해금 자체는 단순 push라 각자
 * 하면 그만이지만, **해금과 함께 보장돼야 하는 부수 효과**가 있으면 경로마다 빠뜨리기 쉽다.
 * 그래서 push를 여기로 모은다.
 *
 * ── 왜 이 파일이 생겼나(회귀 방지 기록) ────────────────────────────────
 * `gaming`이 해금되면 게임계 트윗이 열리는데, `data/attributes.ts`의
 * `gaming.relatedSkills`가 `["comedy","sociability","game"]`이라 `followers.calcTweetOutcome`의
 * `skillAvg`가 **3항 평균**이다. 즉 `game === 0`인 채로 gaming이 열리면 게임계 트윗이
 * 구조적으로 약해진다(comedy·sociability 500 기준 skillMul 0.851 → 0.545, **-36%**).
 *
 * 원래는 "증기에서 게임을 사야만 gaming이 열리니 game은 항상 > 0"이라고 봤지만 **거짓이었다.**
 * `exploreSystem.maybeUnlockAttribute`가 25% 확률로 임의 속성을 열고, 하필
 * `data/adTweets.ts`의 증기 광고 트윗 3종이 전부 `attribute: "gaming"`인 데다
 * `systems/adTweets.ts`가 **`!state.steamUnlocked`일 때만** 그걸 스폰한다 —
 * 즉 증기 광고는 *game이 0으로 보장된 구간에서만* 뜨고, 좋아요를 누르면 gaming이 열리는데
 * 정작 그 플레이어는 증기가 잠겨 있어 game을 올릴 수단에 접근조차 못 한다.
 *
 * 그래서 **경로와 무관하게** 해금 시점에 최소 기준선을 준다. 이제 불변식
 * "gaming 트윗이 가능하면 game > 0"이 **코드로 참**이다.
 *
 * ⚠️ 새로운 해금 경로를 만들 때는 `unlockedAttributes.push`를 직접 부르지 말고
 *    반드시 `unlockAttribute`를 거쳐라. 직접 push하면 위 불변식이 조용히 깨진다.
 */

/**
 * gaming 해금 시 보장되는 `game` 스킬의 최소 기준선.
 * 게임 1개를 사서 해본 정도(= steam.GAME_BUY_SKILL_GAIN)에 해당한다.
 * 획득량 ×5 규칙 준수(원래 스케일 +7).
 *
 * ⚠️ steam.GAME_BUY_SKILL_GAIN과 값을 맞춰 둔다. 이 값이 그보다 커지면
 *    `buyGame`에서 구매 상승분이 기준선에 먹혀 첫 구매가 손해로 보인다.
 */
export const GAME_UNLOCK_FLOOR = 35;

/**
 * 속성 해금에 딸린 최소 스킬 기준선을 적용한다(경로 무관).
 *
 * **바닥값(floor) 의미다 — 누적(+=)이 아니다.** 이미 기준선 이상이면 아무것도 하지 않으므로,
 * 어떤 경로로 몇 번을 호출해도 과지급되지 않는다(멱등).
 */
export function grantAttributeUnlockFloor(state: GameState, attr: AttributeId): void {
  if (attr !== "gaming") return;
  if (state.skills.game >= GAME_UNLOCK_FLOOR) return;
  state.skills.game = clampSkill(GAME_UNLOCK_FLOOR);
}

/**
 * 계정에 트윗 작성 속성을 해금한다. 이미 해금돼 있으면 아무것도 하지 않는다.
 * 해금에 성공하면 그 속성에 딸린 최소 스킬 기준선을 함께 보장한다.
 *
 * 해금 판정(확률·조건)은 호출부의 몫이다 — 여기서는 '해금하기로 결정된 것'만 처리한다.
 * @returns 이번 호출로 새로 해금됐으면 true(호출부의 addSchedule/연출 분기용)
 */
export function unlockAttribute(
  state: GameState,
  account: PlayerAccount,
  attr: AttributeId,
): boolean {
  // 해금 카테고리는 모든 계정이 공유한다(사용자 확정) — 한 계정에서 열면 전 계정에 반영한다.
  if (account.unlockedAttributes.includes(attr)) return false;
  for (const acc of state.accounts) {
    if (!acc.unlockedAttributes.includes(attr)) acc.unlockedAttributes.push(attr);
  }
  grantAttributeUnlockFloor(state, attr);
  return true;
}

/**
 * 모든 계정의 해금 카테고리를 합집합으로 통일한다(계정 간 공유 불변식 복구).
 * 계정 개설 시(새 계정이 기존 해금분을 물려받도록)·구세이브 로드 시 호출한다.
 */
export function syncUnlockedAttributes(state: GameState): void {
  const union = new Set<AttributeId>();
  for (const acc of state.accounts) for (const a of acc.unlockedAttributes) union.add(a);
  const list = [...union];
  for (const acc of state.accounts) acc.unlockedAttributes = [...list];
}
