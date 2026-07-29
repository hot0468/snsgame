import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { TIERS, TIER_ORDER } from "@/data/jobs";
import { successChance } from "@/systems/employment";

/**
 * 극소기업 = 초반 안전망. 스킬 0인 신규 플레이어가 '일단 되는' 등급이어야 한다.
 * 요건 8이던 시절 40%, 0으로 낮춰도 50%라 안전망 구실을 못 했다(음수 requirement의 이유).
 * 이 하한이 깨지면 초반 취업이 다시 코인토스가 된다.
 */
const MICRO_MIN_CHANCE = 0.7;

describe("극소기업 커트라인", () => {
  const fresh = () => {
    const s = createInitialState();
    s.certifications = []; // 자격증 보너스 배제 — 순수 등급 문턱만 본다
    return s;
  };

  it("스킬 0에서도 극소기업 합격률이 70% 이상", () => {
    const p = successChance(fresh(), "micro");
    expect(p, `극소 합격률 ${(p * 100).toFixed(0)}%`).toBeGreaterThanOrEqual(MICRO_MIN_CHANCE);
  });

  it("등급이 오를수록 합격률은 낮아진다 (극소만 낮춘 게 곡선을 뒤집지 않았는지)", () => {
    const s = fresh();
    const chances = TIER_ORDER.map((t) => successChance(s, t));
    expect(chances, `${TIER_ORDER.join(" → ")}`).toEqual([...chances].sort((a, b) => b - a));
  });

  it("음수 requirement는 극소기업뿐이다 (표시 클램프가 필요한 등급 한정)", () => {
    for (const t of TIER_ORDER) {
      if (t === "micro") continue;
      expect(TIERS[t].requirement, t).toBeGreaterThanOrEqual(0);
    }
  });
});
