import { describe, it, expect } from "vitest";
import type { GameState, JobTrack } from "@/core/types";
import { createInitialState } from "@/core/state";
import { TIERS, TIER_ORDER, TRACK_LABELS } from "@/data/jobs";
import {
  competence,
  competenceByTrack,
  bestTrack,
  successChance,
  TRACK_WEIGHTS,
  DEFAULT_JOB_TRACK,
} from "@/systems/employment";
import { skillTo100 } from "@/systems/stats";

/**
 * 직군(트랙)별 취업 역량 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 *  1) **사무직 트랙의 합격률이 트랙 도입 전과 정확히 같다**(밸런스 회귀).
 *     트랙 분화는 새 경로를 여는 작업이지 기존 경로를 흔드는 작업이 아니다.
 *  2) 운동 스탯이 실제로 취업 합격률을 올린다(트랙 신설의 목적 그 자체 —
 *     이전엔 운동이 스킬 11종 중 유일하게 취업 경로가 전무했다).
 *  3) 같은 스탯이라도 트랙에 따라 결과가 갈린다(공식이 실제로 분기하는지).
 *  4) 가중치 합 = 1.0. 합이 깨지면 0~100 환산이 어긋나 TIERS[].requirement와
 *     스케일이 안 맞고, 전원 합격 또는 전원 불합격이 된다(typecheck는 못 잡는다).
 */

const ALL_TRACKS: JobTrack[] = ["office", "fitness", "beauty"];

/** 스킬만 지정해 상태를 만든다(자격증 0종 — certJobBonus 영향 배제). */
function stateWith(skills: Partial<GameState["skills"]>): GameState {
  const s = createInitialState();
  s.skills = { ...s.skills, ...skills };
  s.certifications = [];
  return s;
}

/** 트랙 도입 **이전**의 원본 공식 — 여기 값을 손대면 회귀 테스트의 의미가 사라진다. */
function legacyCompetence(s: GameState): number {
  const { vocabulary, sociability, beauty } = s.skills;
  return Math.round(skillTo100(vocabulary * 0.45 + sociability * 0.35 + beauty * 0.2));
}

/** 트랙 도입 이전의 원본 합격률 공식(certJobBonus 0 기준). */
function legacySuccessChance(s: GameState, tier: keyof typeof TIERS): number {
  const gap = legacyCompetence(s) - TIERS[tier].requirement;
  return Math.max(0.05, Math.min(0.95, 0.5 + gap / 80));
}

describe("트랙 가중치 — 0~100 스케일 불변식", () => {
  it("모든 트랙의 가중치 합이 정확히 1.0이다", () => {
    for (const t of ALL_TRACKS) {
      const sum = Object.values(TRACK_WEIGHTS[t]).reduce((a, b) => a + (b ?? 0), 0);
      expect(sum, `${t} 가중치 합 ${sum}`).toBeCloseTo(1.0, 10);
    }
  });

  it("스킬 만렙이면 어느 트랙이든 역량 100이다 (requirement 78과 같은 스케일)", () => {
    const maxed = stateWith({ fitness: 999, beauty: 999, vocabulary: 999, sociability: 999 });
    for (const t of ALL_TRACKS) expect(competence(maxed, t)).toBe(100);
  });

  it("스킬 0이면 어느 트랙이든 역량 0이다", () => {
    const zero = stateWith({ fitness: 0, beauty: 0, vocabulary: 0, sociability: 0 });
    for (const t of ALL_TRACKS) expect(competence(zero, t)).toBe(0);
  });

  it("최고 등급(대기업) requirement 78도 도달 가능한 범위다", () => {
    const maxed = stateWith({ fitness: 999, beauty: 999, vocabulary: 999, sociability: 999 });
    for (const t of ALL_TRACKS) {
      expect(competence(maxed, t)).toBeGreaterThanOrEqual(TIERS.large.requirement);
    }
  });

  it("TRACK_LABELS와 TRACK_WEIGHTS의 키가 일치한다", () => {
    expect(Object.keys(TRACK_LABELS).sort()).toEqual(Object.keys(TRACK_WEIGHTS).sort());
  });
});

describe("사무직 회귀 — 기존 밸런스가 한 톨도 안 변해야 한다", () => {
  const samples: Array<Partial<GameState["skills"]>> = [
    {},
    { vocabulary: 100, sociability: 50, beauty: 30 },
    { vocabulary: 400, sociability: 300, beauty: 200 },
    { vocabulary: 999, sociability: 0, beauty: 0 },
    { vocabulary: 0, sociability: 999, beauty: 0 },
    { vocabulary: 0, sociability: 0, beauty: 999 },
    { vocabulary: 777, sociability: 555, beauty: 333, fitness: 999 },
    { vocabulary: 123, sociability: 456, beauty: 789, fitness: 321 },
  ];

  it("office 트랙 competence가 기존 공식과 완전히 동일하다", () => {
    for (const skills of samples) {
      const s = stateWith(skills);
      expect(competence(s, "office"), JSON.stringify(skills)).toBe(legacyCompetence(s));
    }
  });

  it("트랙 인자를 생략하면 office와 같다 (ui 기존 호출부가 안 깨진다)", () => {
    for (const skills of samples) {
      const s = stateWith(skills);
      expect(competence(s)).toBe(competence(s, "office"));
    }
    expect(DEFAULT_JOB_TRACK).toBe("office");
  });

  it("office 합격률이 전 등급에서 기존 공식과 동일하다", () => {
    for (const skills of samples) {
      const s = stateWith(skills);
      for (const tier of TIER_ORDER) {
        expect(successChance(s, tier, "office"), `${tier} / ${JSON.stringify(skills)}`).toBeCloseTo(
          legacySuccessChance(s, tier),
          10,
        );
      }
    }
  });

  it("successChance의 트랙 인자를 생략해도 기존 값이다", () => {
    const s = stateWith({ vocabulary: 400, sociability: 300, beauty: 200 });
    for (const tier of TIER_ORDER) {
      expect(successChance(s, tier)).toBeCloseTo(legacySuccessChance(s, tier), 10);
    }
  });

  it("운동 스탯은 사무직 합격률에 영향을 주지 않는다 (기존 그대로)", () => {
    const base = stateWith({ vocabulary: 300, sociability: 300, beauty: 300, fitness: 0 });
    const buff = stateWith({ vocabulary: 300, sociability: 300, beauty: 300, fitness: 999 });
    expect(successChance(buff, "small", "office")).toBe(successChance(base, "small", "office"));
  });
});

describe("운동 트랙 — 운동 스탯이 실제로 합격률을 올린다", () => {
  it("운동 스탯이 오르면 fitness 트랙 역량이 오른다", () => {
    const low = stateWith({ fitness: 100, sociability: 200 });
    const high = stateWith({ fitness: 800, sociability: 200 });
    expect(competence(high, "fitness")).toBeGreaterThan(competence(low, "fitness"));
  });

  it("운동 스탯이 오르면 fitness 트랙 합격률이 오른다", () => {
    const low = stateWith({ fitness: 100, sociability: 200 });
    const high = stateWith({ fitness: 800, sociability: 200 });
    for (const tier of TIER_ORDER) {
      expect(
        successChance(high, tier, "fitness"),
        `${tier}`,
      ).toBeGreaterThan(successChance(low, tier, "fitness"));
    }
  });

  it("운동만 판 플레이어도 취업 경로가 열린다 — 사무직은 막히고 운동직은 뚫린다", () => {
    // 운동 999 + 친화 500, 어휘·미용 0: 사무직이면 사실상 불합격, 운동직이면 대기업도 노린다.
    const jock = stateWith({ fitness: 999, sociability: 500, vocabulary: 0, beauty: 0 });
    expect(competence(jock, "office")).toBeLessThan(TIERS.small.requirement);
    expect(competence(jock, "fitness")).toBeGreaterThan(TIERS.medium.requirement);
    expect(successChance(jock, "medium", "fitness")).toBeGreaterThan(
      successChance(jock, "medium", "office"),
    );
  });

  it("미용 스탯이 오르면 beauty 트랙 합격률이 오른다", () => {
    const low = stateWith({ beauty: 100, sociability: 200 });
    const high = stateWith({ beauty: 800, sociability: 200 });
    expect(successChance(high, "small", "beauty")).toBeGreaterThan(
      successChance(low, "small", "beauty"),
    );
  });
});

describe("트랙 분기 — 같은 스탯이라도 트랙에 따라 결과가 갈린다", () => {
  it("운동 특화 플레이어는 fitness가 최고, 뷰티 특화는 beauty가 최고다", () => {
    const jock = stateWith({ fitness: 900, beauty: 100, vocabulary: 100, sociability: 300 });
    const stylist = stateWith({ fitness: 100, beauty: 900, vocabulary: 100, sociability: 300 });
    const clerk = stateWith({ fitness: 100, beauty: 200, vocabulary: 900, sociability: 300 });

    expect(bestTrack(jock).track).toBe("fitness");
    expect(bestTrack(stylist).track).toBe("beauty");
    expect(bestTrack(clerk).track).toBe("office");
  });

  it("세 트랙 점수가 실제로 서로 다르다 (공식이 분기하지 않으면 전부 같아진다)", () => {
    const s = stateWith({ fitness: 900, beauty: 400, vocabulary: 200, sociability: 300 });
    const byTrack = competenceByTrack(s);
    expect(new Set(Object.values(byTrack)).size).toBe(3);
  });

  it("competenceByTrack의 각 값이 competence(state, track)과 일치한다", () => {
    const s = stateWith({ fitness: 700, beauty: 500, vocabulary: 300, sociability: 400 });
    const byTrack = competenceByTrack(s);
    for (const t of ALL_TRACKS) expect(byTrack[t]).toBe(competence(s, t));
  });

  it("bestTrack의 점수는 세 트랙 중 최댓값이다", () => {
    const s = stateWith({ fitness: 620, beauty: 480, vocabulary: 510, sociability: 350 });
    const { score } = bestTrack(s);
    expect(score).toBe(Math.max(...Object.values(competenceByTrack(s))));
  });

  it("친화력 비중은 세 트랙이 동일하다 — 친화력만 키운 플레이어가 트랙 전환으로 손해 보지 않는다", () => {
    const social = stateWith({ fitness: 0, beauty: 0, vocabulary: 0, sociability: 999 });
    const byTrack = competenceByTrack(social);
    expect(byTrack.fitness).toBe(byTrack.office);
    expect(byTrack.beauty).toBe(byTrack.office);
  });
});

describe("자격증 보너스 — 트랙 무관으로 유지한다(의도적 판단, employment.ts 주석 참고)", () => {
  it("같은 자격증이 모든 트랙에 동일하게 붙는다", () => {
    const base = stateWith({ fitness: 400, beauty: 400, vocabulary: 400, sociability: 400 });
    const certed = stateWith({ fitness: 400, beauty: 400, vocabulary: 400, sociability: 400 });
    certed.certifications = ["hairdresser"];
    for (const t of ALL_TRACKS) {
      const delta = successChance(certed, "small", t) - successChance(base, "small", t);
      expect(delta, `${t}`).toBeGreaterThan(0);
    }
  });
});
