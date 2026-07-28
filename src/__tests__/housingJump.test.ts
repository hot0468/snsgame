import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { HOUSINGS } from "@/data/housing";
import { moveToHousing, upgradeHousing } from "@/systems/housing";

/**
 * 집 계약 회귀 테스트 — 단계를 건너뛰고 상위 매물로 한 번에 이사할 수 있다.
 * 혜택 귀속이 둘로 갈린다: 기상 회복(actionBonus/mentalBonus)은 현재 집,
 * permaSkills는 계약 즉시 영구(이사해도 안 빠짐).
 */

const LAST = HOUSINGS.length - 1;

describe("moveToHousing", () => {
  it("단계를 건너뛰고 최상위 집으로 한 번에 이사한다", () => {
    const s = createInitialState();
    s.money = HOUSINGS[LAST].price;
    const moved = moveToHousing(s, LAST);
    expect(moved?.id).toBe(HOUSINGS[LAST].id);
    expect(s.housingTier).toBe(LAST);
    expect(s.money).toBe(0);
  });

  it("계약금이 모자라면 이사하지 않고 돈도 안 빠진다", () => {
    const s = createInitialState();
    s.money = HOUSINGS[LAST].price - 1;
    expect(moveToHousing(s, LAST)).toBeNull();
    expect(s.housingTier).toBe(0);
    expect(s.money).toBe(HOUSINGS[LAST].price - 1);
  });

  it("현재 집이나 그보다 낮은 매물로는 되돌아가지 않는다", () => {
    const s = createInitialState();
    s.money = 10_000_000_000;
    s.housingTier = 4;
    expect(moveToHousing(s, 4)).toBeNull();
    expect(moveToHousing(s, 1)).toBeNull();
    expect(s.housingTier).toBe(4);
    expect(s.money).toBe(10_000_000_000);
  });

  it("범위 밖 인덱스는 무시한다", () => {
    const s = createInitialState();
    s.money = 10_000_000_000;
    expect(moveToHousing(s, HOUSINGS.length)).toBeNull();
    expect(s.housingTier).toBe(0);
  });

  it("영구 스탯은 이사해도 빠지지 않는다 — 다음 집에 없는 스탯도 유지된다", () => {
    const s = createInitialState();
    s.money = 10_000_000_000;
    const base = { ...s.skills };

    // 구축 아파트(sociability +20) → 전원주택(sociability 없음, fitness +30)
    const oldapt = HOUSINGS.findIndex((h) => h.id === "oldapt");
    const country = HOUSINGS.findIndex((h) => h.id === "country");
    moveToHousing(s, oldapt);
    expect(s.skills.sociability).toBe(base.sociability + 20);

    moveToHousing(s, country);
    // 전원주택엔 사교성 보너스가 없지만, 아파트에서 받은 건 그대로 남는다.
    expect(s.skills.sociability).toBe(base.sociability + 20);
    expect(s.skills.fitness).toBe(base.fitness + 30);
  });

  it("점프하면 건너뛴 집의 영구 스탯은 못 받는 대신 계약금을 아낀다", () => {
    const jump = createInitialState();
    jump.money = 10_000_000_000;
    moveToHousing(jump, LAST);

    const step = createInitialState();
    step.money = 10_000_000_000;
    for (let i = 1; i <= LAST; i++) upgradeHousing(step);

    expect(step.housingTier).toBe(jump.housingTier);
    expect(step.skills.sociability).toBeGreaterThan(jump.skills.sociability);
    expect(jump.money).toBeGreaterThan(step.money);
  });

  it("기상 회복은 현재 집에 귀속된다 — 상태가 아니라 단계에서 매번 읽는다", () => {
    const s = createInitialState();
    s.money = 10_000_000_000;
    moveToHousing(s, LAST);
    // 이 값들은 저장되지 않고 systems/time.ts가 HOUSINGS[housingTier]로 직접 읽는다.
    expect(HOUSINGS[s.housingTier].actionBonus).toBe(HOUSINGS[LAST].actionBonus);
    expect(HOUSINGS[s.housingTier].mentalBonus).toBe(HOUSINGS[LAST].mentalBonus);
  });
});
