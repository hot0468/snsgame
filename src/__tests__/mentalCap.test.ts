import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { MAX_RESOURCE } from "@/data/stats";
import { clampMental, clampResource, mentalMax } from "@/systems/stats";
import { MILESTONE_PERKS, perkMentalMax } from "@/systems/milestones";
import { HOUSINGS } from "@/data/housing";
import { CALL_MENTAL_FLOOR } from "@/data/callCenter";
import { canTakeCall, joinCallCenter, takeCall } from "@/systems/callCenter";
import { CALL_LINES } from "@/data/callCenter";
import type { GameState } from "@/core/types";

/**
 * 정신력 상한(가변) 회귀 테스트.
 *
 * 배경: 정신력은 상한이 100 고정이라 좋은 집에 살아도 담을 그릇이 안 커졌다.
 * 행동력은 `actionMaxBonus`(치트 +20)와 체력 회복 보너스가 있는데 정신력엔 대응물이
 * 없어 **비대칭**이었고, 그래서 콜센터 한 타임에 받을 수 있는 콜 수가 성장하지 않았다.
 *
 * 고정하는 불변식:
 *  1) 상한이 오르면 정신력이 100을 넘어 **담긴다**.
 *  2) 100을 넘은 상태에서 깎아도 100으로 눌리지 않는다.
 *     ⚠️ 이게 제일 중요하다 — `clampResource`(고정 100)를 정신력에 쓰면 105에서 4를 깎을 때
 *        101이 아니라 100이 되어 보너스가 조용히 샌다. 행동력이 겪었던 것과 같은 함정이다.
 *  3) 상한이 오르면 콜센터에서 콜을 더 받을 수 있다(장치를 붙인 목적 그 자체).
 */

function withCap(bonus: number): GameState {
  const s = createInitialState();
  s.mentalMaxBonus = bonus;
  return s;
}

describe("정신력 상한", () => {
  it("보너스가 0이면 기본 100이다", () => {
    expect(mentalMax(createInitialState())).toBe(MAX_RESOURCE);
  });

  it("보너스만큼 상한이 오른다", () => {
    expect(mentalMax(withCap(20))).toBe(MAX_RESOURCE + 20);
  });

  it("NaN·undefined가 들어와도 상한이 NaN이 되지 않는다", () => {
    const s = createInitialState();
    (s as { mentalMaxBonus: unknown }).mentalMaxBonus = NaN;
    expect(Number.isFinite(mentalMax(s))).toBe(true);
    (s as { mentalMaxBonus: unknown }).mentalMaxBonus = undefined;
    expect(Number.isFinite(mentalMax(s))).toBe(true);
  });

  it("clampMental이 새 상한까지 담는다", () => {
    const s = withCap(20);
    expect(clampMental(s, 118)).toBe(118);
    expect(clampMental(s, 130)).toBe(120);
    expect(clampMental(s, -5)).toBe(0);
  });

  it("⚠️ 100을 넘은 정신력을 깎아도 100으로 안 눌린다", () => {
    // clampResource를 쓰면 여기서 100이 나온다 — 그게 보너스가 새는 경로다.
    const s = withCap(20);
    expect(clampMental(s, 112)).toBe(112);
    expect(clampResource(112), "clampResource는 여전히 100에서 자른다(도덕성·평판용)").toBe(100);
  });
});

describe("퍼크로 상한이 오른다", () => {
  it("steady 퍼크가 목록에 있다", () => {
    expect(MILESTONE_PERKS.some((p) => p.id === "steady")).toBe(true);
  });

  it("퍼크를 못 얻었으면 0, 얻으면 +20", () => {
    const s = createInitialState();
    expect(perkMentalMax(s)).toBe(0);
    const at = MILESTONE_PERKS.find((p) => p.id === "steady")!.at;
    s.statMilestones = Array.from({ length: at }, (_, i) => `m${i}`);
    expect(perkMentalMax(s)).toBe(20);
    expect(mentalMax(s)).toBe(MAX_RESOURCE + 20);
  });
});

describe("집도 상한을 올린다", () => {
  it("좋은 집으로 갈수록 상한이 오른다", () => {
    const s = createInitialState();
    const base = mentalMax(s);
    s.housingTier = HOUSINGS.length - 1;
    expect(mentalMax(s), "최고급 집이 기본 원룸보다 상한이 높아야 한다").toBeGreaterThan(base);
  });

  it("회복이 큰 집일수록 상한도 크다 — 안 그러면 초과 회복이 버려진다", () => {
    // 아침 회복(mentalBonus)이 상한을 넘어서면 그 초과분은 그냥 사라진다.
    // 회복이 붙은 집엔 그릇도 같이 붙어 있어야 한다.
    for (const h of HOUSINGS) {
      if (h.mentalBonus >= 9) {
        expect(h.mentalMaxBonus ?? 0, `${h.name}`).toBeGreaterThan(0);
      }
    }
  });

  it("집 상한 보너스는 단조 증가한다", () => {
    let prev = -1;
    for (const h of HOUSINGS) {
      const v = h.mentalMaxBonus ?? 0;
      expect(v, `${h.name}`).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("집·퍽·영구 보너스가 함께 더해진다", () => {
    const s = createInitialState();
    s.housingTier = HOUSINGS.length - 1;
    s.mentalMaxBonus = 10;
    const at = MILESTONE_PERKS.find((p) => p.id === "steady")!.at;
    s.statMilestones = Array.from({ length: at }, (_, i) => `m${i}`);
    const home = HOUSINGS[s.housingTier].mentalMaxBonus ?? 0;
    expect(mentalMax(s)).toBe(MAX_RESOURCE + 10 + home + 20);
  });
});

describe("콜센터가 실제로 길어진다 — 장치를 붙인 목적", () => {
  /** 정신력을 가득 채운 뒤 받을 수 있는 콜 수를 센다. */
  function maxCalls(bonus: number): number {
    const s = withCap(bonus);
    joinCallCenter(s);
    s.resources.mental = mentalMax(s);
    const plain = CALL_LINES.find((l) => !l.mental)!;
    let n = 0;
    while (canTakeCall(s, n + 1)) {
      n += 1;
      takeCall(s, plain, n);
    }
    return n;
  }

  it("상한이 오르면 한 타임에 받는 콜이 늘어난다", () => {
    const base = maxCalls(0);
    const boosted = maxCalls(40);
    expect(base).toBeGreaterThan(0);
    expect(boosted, `기본 ${base}콜 → 상한 +40에서 ${boosted}콜`).toBeGreaterThan(base);
  });

  it("상한이 올라도 하한 밑으로는 안 내려간다", () => {
    const s = withCap(40);
    joinCallCenter(s);
    s.resources.mental = mentalMax(s);
    const plain = CALL_LINES.find((l) => !l.mental)!;
    let n = 0;
    while (canTakeCall(s, n + 1)) {
      n += 1;
      takeCall(s, plain, n);
    }
    expect(s.resources.mental).toBeGreaterThanOrEqual(CALL_MENTAL_FLOOR);
  });
});
