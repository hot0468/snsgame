import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import type { GameState, SkillStatId } from "@/core/types";
import { MAX_SKILL } from "@/data/stats";
import { gainSkill, projectSkillGain, mentalEfficiency, SKILL_GAIN_DECAY } from "@/systems/stats";
import { OFFLINE_ACTIVITIES, declaredSkillAmount } from "@/systems/offline";

/**
 * 스킬 획득 **투영(미리보기) ↔ 실제 지급** 일치 회귀 테스트.
 *
 * 지키는 것: `projectSkillGain`(현생 살기 모달 미리보기)과 `gainSkill`(실제 지급)이
 * 모든 입력에서 **같은 값**을 낸다는 불변식.
 *
 * 왜 필요한가: 미리보기가 활동 선언값을 그대로 뿌리던 시절, 정신력 배율(0.4~1.25)·
 * 퍼크 배율(1.0~1.2)·상단 감쇠(스킬 999 근처에서 최대 0.2배)를 무시해
 * "+10" 예고가 실제 "+1"로 지급되는 괴리가 있었다. 두 경로가 `skillGainDelta`라는
 * 한 공식을 공유하도록 고쳤지만, 누군가 한쪽만 인라인으로 되돌리면 typecheck는
 * 조용히 통과한다 — 그걸 막는 유일한 장치가 이 파일이다.
 *
 * ⚠️ 등급(fail 0.25배 / great 1.8배)은 굴림 전이라 투영에 곱하지 않는다.
 *    따라서 이 테스트는 등급 배율이 적용되기 **전** 값끼리 비교한다(offline.ts가
 *    applyGradeToGain으로 amount를 먼저 가공한 뒤 gainSkill에 넘기므로 계약이 유지된다).
 */

const MENTALS = [0, 20, 50, 70, 100];
const SKILLS = [0, 300, 800, 999];
const AMOUNTS = [1, 3, 10, 22, -5, -12];
const KEY: SkillStatId = "fitness";

/** 정신력·스킬·퍼크를 지정한 상태 스냅샷. */
function stateWith(mental: number, skill: number, perks: string[] = []): GameState {
  const s = createInitialState();
  s.resources.mental = mental;
  s.skills[KEY] = skill;
  s.statMilestones = perks;
  return s;
}

describe("활동 고유 보정(declaredSkillAmount)이 미리보기·실지급에 함께 걸린다", () => {
  it("에스테틱 회원의 꾸미기 매력이 미리보기와 실지급에서 같다", () => {
    // 회귀: 실지급만 1.5배(estheticBeautyMult)를 곱하고 미리보기는 안 곱해
    // "미리보기 +10, 실제 +15"로 어긋났던 버그.
    const grooming = OFFLINE_ACTIVITIES.find((a) => a.id === "grooming")!;
    const declared = grooming.skillGains?.beauty ?? 0;

    for (const member of [false, true]) {
      const prev = createInitialState();
      prev.resources.mental = 70;
      prev.estheticMember = member;
      const previewAmt = declaredSkillAmount(prev, grooming, "beauty", declared);
      const preview = projectSkillGain(prev, "beauty", previewAmt);

      const real = createInitialState();
      real.resources.mental = 70;
      real.estheticMember = member;
      const realAmt = declaredSkillAmount(real, grooming, "beauty", declared);
      const actual = gainSkill(real, "beauty", realAmt);

      expect(preview, `estheticMember=${member}`).toBe(actual);
    }
  });

  it("정품 회원이면 비회원보다 실제로 더 오른다(보정이 살아있다)", () => {
    const grooming = OFFLINE_ACTIVITIES.find((a) => a.id === "grooming")!;
    const declared = grooming.skillGains?.beauty ?? 0;
    const base = createInitialState();
    const memberState = createInitialState();
    memberState.estheticMember = true;
    expect(declaredSkillAmount(memberState, grooming, "beauty", declared)).toBeGreaterThan(
      declaredSkillAmount(base, grooming, "beauty", declared),
    );
  });
});

describe("projectSkillGain ↔ gainSkill 일치", () => {
  it("정신력 × 스킬 × 양수/음수 전 조합에서 예고와 실제가 같다", () => {
    for (const mental of MENTALS) {
      for (const skill of SKILLS) {
        for (const amount of AMOUNTS) {
          const projected = projectSkillGain(stateWith(mental, skill), KEY, amount);
          // gainSkill은 상태를 변형하므로 동일 조건의 새 스냅샷에 적용한다.
          const actual = gainSkill(stateWith(mental, skill), KEY, amount);
          expect(
            projected,
            `정신력 ${mental} · 스킬 ${skill} · amount ${amount}`,
          ).toBe(actual);
        }
      }
    }
  });

  it("퍼크(efficient/mastery) 해금 상태에서도 일치한다", () => {
    // 퍼크는 statMilestones 개수로 해금된다(efficient=14, mastery=28).
    const perkSets = [
      Array.from({ length: 14 }, (_, i) => `m${i}`),
      Array.from({ length: 28 }, (_, i) => `m${i}`),
    ];
    for (const perks of perkSets) {
      for (const mental of MENTALS) {
        for (const skill of SKILLS) {
          for (const amount of AMOUNTS) {
            const projected = projectSkillGain(stateWith(mental, skill, perks), KEY, amount);
            const actual = gainSkill(stateWith(mental, skill, perks), KEY, amount);
            expect(
              projected,
              `퍼크 ${perks.length}개 · 정신력 ${mental} · 스킬 ${skill} · amount ${amount}`,
            ).toBe(actual);
          }
        }
      }
    }
  });

  it("투영은 상태를 변경하지 않는다(순수)", () => {
    const s = stateWith(70, 300);
    projectSkillGain(s, KEY, 20);
    expect(s.skills[KEY]).toBe(300);
    expect(s.resources.mental).toBe(70);
  });
});

describe("투영 값의 성질", () => {
  it("음수(반대급부)는 배율 없이 액면 그대로 나온다", () => {
    // 정신력이 바닥이든 만땅이든, 스킬이 높든 낮든 감소폭은 같아야 한다.
    for (const mental of MENTALS) {
      expect(projectSkillGain(stateWith(mental, 500), KEY, -12)).toBe(-12);
    }
    for (const skill of [300, 800, 999]) {
      expect(projectSkillGain(stateWith(70, skill), KEY, -12)).toBe(-12);
    }
  });

  it("999 상한에 걸리면 투영도 0이 된다", () => {
    expect(projectSkillGain(stateWith(100, MAX_SKILL), KEY, 30)).toBe(0);
  });

  it("0 하한에 걸리면 투영도 남은 만큼만 깎인다", () => {
    expect(projectSkillGain(stateWith(70, 5), KEY, -12)).toBe(-5);
  });

  it("정신력 70(기준선)에서는 감쇠만 적용된다", () => {
    // mentalEfficiency(70) === 1.0, 퍼크 없음 → amount * (1 - 0.8*skill/999)
    const state = stateWith(70, 0);
    expect(mentalEfficiency(state)).toBeCloseTo(1, 10);
    expect(projectSkillGain(state, KEY, 20)).toBe(20);
    const at800 = stateWith(70, 800);
    expect(projectSkillGain(at800, KEY, 20)).toBe(
      Math.round(20 * (1 - SKILL_GAIN_DECAY * (800 / MAX_SKILL))),
    );
  });

  it("정신력이 낮을수록 투영값이 작아진다(단조 비증가)", () => {
    let prev = Infinity;
    for (const mental of [100, 70, 50, 20, 0]) {
      const v = projectSkillGain(stateWith(mental, 0), KEY, 20);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });
});
