import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import type { GameState, SkillStatId } from "@/core/types";
import { gainSkill, projectSkillGain } from "@/systems/stats";
import { describeMissionReward, recordMission } from "@/systems/missions";
import { DAILY_MISSIONS, WEEKLY_MISSIONS } from "@/data/missions";

/**
 * 도전과제(미션) 보상의 **배율 면제(flat)** 회귀 테스트.
 *
 * 지키는 것: 미션 스킬 보상은 정신력·퍼크·감쇠와 **무관하게 선언값 그대로** 지급된다.
 *
 * 왜 필요한가: 정신력 배율이 `gainSkill` 공용 관문에 걸리면서 미션 보상까지 파급됐다.
 * 그러면 (1) 보상 목록의 "어휘력 +15" 고지와 실지급이 어긋나고, (2) 컨디션이 나쁜 시기에
 * 과제를 깬 플레이어가 이중으로 손해를 본다. 도전과제는 육성 행동이 아니라 이미 치른
 * 대가에 대한 **약속된 지급**이라 면제가 맞다는 설계 결정을 코드로 고정한다.
 *
 * ⚠️ 이 면제는 예외이지 기본이 아니다. 반복 육성 행동(운동·교양 등)에 `flat`이 붙으면
 *    컨디션 관리를 우회하는 구멍이 된다 — 허용 조건은 `SkillGainOpts` 주석 참조.
 */

const KEY: SkillStatId = "vocabulary";
/** 배율이 극단적으로 갈리는 정신력 구간(0.4배 ~ 1.25배). */
const MENTALS = [0, 20, 50, 70, 100];

function stateWith(mental: number, skill: number, perks: string[] = []): GameState {
  const s = createInitialState();
  s.resources.mental = mental;
  s.skills[KEY] = skill;
  s.statMilestones = perks;
  return s;
}

describe("미션 보상 배율 면제(flat)", () => {
  it("정신력이 얼마든 선언값 그대로 지급된다", () => {
    for (const mental of MENTALS) {
      const s = stateWith(mental, 0);
      const delta = gainSkill(s, KEY, 15, { flat: true });
      expect(delta, `정신력 ${mental}`).toBe(15);
    }
  });

  it("고스킬 감쇠 구간에서도 깎이지 않는다", () => {
    // 감쇠가 있으면 스킬 800에서 +15는 +5 안팎으로 줄어든다. flat은 그대로여야 한다.
    // (999 상한에 걸리는 구간은 별도 테스트에서 확인한다 — 여기선 상한 미접촉 값만 쓴다.)
    for (const skill of [0, 300, 800, 900]) {
      const s = stateWith(0, skill);
      expect(gainSkill(s, KEY, 15, { flat: true }), `스킬 ${skill}`).toBe(15);
    }
  });

  it("퍼크 해금 상태에서도 액면 그대로다(퍼크 배율도 면제)", () => {
    const perks = Array.from({ length: 28 }, (_, i) => `m${i}`);
    const s = stateWith(100, 0, perks);
    // 퍼크 배율(최대 1.2)과 정신력 1.25배가 겹쳐도 부풀지 않아야 한다.
    expect(gainSkill(s, KEY, 15, { flat: true })).toBe(15);
  });

  it("면제해도 999 상한은 지킨다", () => {
    const s = stateWith(100, 995);
    expect(gainSkill(s, KEY, 15, { flat: true })).toBe(4);
    expect(s.skills[KEY]).toBe(999);
  });

  it("flat 없이 부르면 종전대로 배율이 걸린다(면제가 기본값이 아니다)", () => {
    const low = stateWith(0, 0); // 정신력 0 → 0.4배
    expect(gainSkill(low, KEY, 15)).toBeLessThan(15);
  });

  it("투영도 같은 면제를 따른다", () => {
    for (const mental of MENTALS) {
      const s = stateWith(mental, 300);
      expect(projectSkillGain(s, KEY, 15, { flat: true })).toBe(
        gainSkill(stateWith(mental, 300), KEY, 15, { flat: true }),
      );
    }
  });
});

describe("미션 보상 고지값 ↔ 실지급", () => {
  it("실제 미션 달성 경로에서 고지한 스킬 수치가 그대로 들어온다", () => {
    // 스킬 보상이 있는 미션 정의를 찾아 그 metric을 목표치만큼 밀어 달성시킨다.
    const def = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS].find(
      (d) => d.reward.skills && Object.keys(d.reward.skills).length > 0,
    );
    expect(def, "스킬 보상이 있는 미션 정의가 있어야 한다").toBeTruthy();
    if (!def) return;

    const [skillKey, declared] = Object.entries(def.reward.skills!)[0] as [SkillStatId, number];

    const s = createInitialState();
    s.resources.mental = 0; // 최악의 컨디션 — 배율이 걸렸다면 여기서 깎인다.
    // 이 미션이 데일리·위클리 중 어디에 들었든 잡히도록 양쪽에 심는다.
    s.missions.daily = [{ id: def.id, progress: 0, claimed: false }];
    s.missions.weekly = [];
    const before = s.skills[skillKey];

    recordMission(s, def.metric, def.goal);

    expect(s.missions.daily[0].claimed, "미션이 달성돼야 한다").toBe(true);
    expect(s.skills[skillKey] - before).toBe(declared);
  });

  it("보상 문구가 선언값을 그대로 표기한다", () => {
    const text = describeMissionReward({ skills: { vocabulary: 15 } });
    expect(text).toContain("+15");
  });
});
