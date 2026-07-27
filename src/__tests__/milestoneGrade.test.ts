import { describe, it, expect } from "vitest";
import {
  MILESTONE_GRADES,
  MILESTONE_THRESHOLDS,
  MILESTONE_TITLES,
  SKILL_MILESTONE_IDS,
  milestoneGrade,
} from "@/data/milestones";

/**
 * 마일스톤 등급 배지 회귀 테스트.
 *
 * 지키는 것: tier(0~3)를 가리키는 세 배열(문턱·등급·칭호)의 **인덱스 정합**.
 * 셋 중 하나만 길이가 바뀌면 배지가 엉뚱한 등급을 달거나 `undefined`가 되는데,
 * 전부 인덱스 접근이라 typecheck가 잡지 못한다.
 */
describe("마일스톤 등급 배지", () => {
  it("등급 개수가 문턱 개수와 같다", () => {
    expect(MILESTONE_GRADES.length).toBe(MILESTONE_THRESHOLDS.length);
  });

  it("모든 스킬의 칭호 개수도 문턱 개수와 같다", () => {
    for (const skill of SKILL_MILESTONE_IDS) {
      expect(MILESTONE_TITLES[skill].length, skill).toBe(MILESTONE_THRESHOLDS.length);
    }
  });

  it("tier 0~3이 B/A/S/SS로 매핑된다", () => {
    expect([0, 1, 2, 3].map(milestoneGrade)).toEqual(["B", "A", "S", "SS"]);
  });

  it("범위를 벗어난 tier는 null이다(배지 미표시)", () => {
    // -1은 '아직 달성 없음'을 뜻한다 — highestMilestoneTier가 이 값을 준다.
    expect(milestoneGrade(-1)).toBeNull();
    expect(milestoneGrade(MILESTONE_THRESHOLDS.length)).toBeNull();
  });

  it("등급 라벨에 중복이 없다(같은 기호가 두 tier에 붙지 않는다)", () => {
    expect(new Set(MILESTONE_GRADES).size).toBe(MILESTONE_GRADES.length);
  });
});
