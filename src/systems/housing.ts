import type { GameState, SkillStatId } from "@/core/types";
import { HOUSINGS, type Housing } from "@/data/housing";
import { gainSkill } from "./stats";
import { addSchedule } from "./time";

/** 현재 주거 */
export function currentHousing(state: GameState): Housing {
  return HOUSINGS[state.housingTier] ?? HOUSINGS[0];
}

/**
 * 원하는 집으로 바로 이사(계약)한다 — 단계를 밟지 않고 상위 매물을 한 번에 계약할 수 있다.
 *
 * 집이 주는 혜택은 **귀속 방식이 두 가지로 갈린다**:
 *  - `actionBonus`/`mentalBonus`(기상 회복) — **현재 집에 귀속**. 이사하면 즉시 새 집 값으로
 *    바뀐다. 상태에 저장하지 않고 `systems/time.ts`가 매 기상마다 `HOUSINGS[housingTier]`를
 *    직접 읽으므로, 여기서 따로 손댈 것이 없다.
 *  - `permaSkills`(세부 스탯) — **계약 즉시 영구 상승**. 다른 집으로 옮겨도 빠지지 않는다.
 *
 * 단계를 건너뛰면 지나친 집의 `permaSkills`는 받지 못한다(그 집을 계약한 적이 없다). 대신
 * 계약금 총액은 싸다 — 돈을 아낄 것인가 스탯을 챙길 것인가가 곧 선택지다.
 *
 * 지금 사는 집이거나 그보다 낮은 매물로는 되돌아가지 않는다.
 * @returns 이사했으면 이사한 집, 조건 미달이면 null
 */
export function moveToHousing(state: GameState, index: number): Housing | null {
  const target = HOUSINGS[index];
  if (!target || index <= state.housingTier || state.money < target.price) return null;
  state.money -= target.price;
  state.housingTier = index;
  if (target.permaSkills) {
    // flat: 집 목록에 영구 상승치가 표기되고(확정 고지) 계약금을 이미 지불했다(대가 지불).
    for (const [skill, amount] of Object.entries(target.permaSkills)) {
      gainSkill(state, skill as SkillStatId, amount ?? 0, { flat: true });
    }
  }
  addSchedule(state, `${target.name} 계약 — 이사 완료`, "system");
  return target;
}

/** 바로 윗 단계 집으로 이사한다(한 칸 승급 — `moveToHousing`의 흔한 경우). */
export function upgradeHousing(state: GameState): Housing | null {
  return moveToHousing(state, state.housingTier + 1);
}
