import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { MAX_RESOURCE, MAX_SKILL, SKILL_STATS, RESOURCE_STATS, SKILL_STAT_IDS } from "@/data/stats";
import { clampSkill, clampResource, clampAction, actionMax, skillTo100 } from "@/systems/stats";
import { createInitialState } from "@/core/state";

/**
 * 스탯 스케일 회귀 테스트.
 *
 * 이 파일이 지키는 것: 스킬(0~999)·리소스(0~100)·행동력(0~100+보너스)의 상한이
 * 서로 섞이지 않는 것. 세 클램프가 전부 `number → number`라 **바꿔 써도 컴파일된다** —
 * typecheck가 절대 못 잡는 종류라 테스트로 고정한다.
 *
 * 실제로 물린 사고:
 * - 상한을 100→999로 올릴 때 리소스까지 999가 될 뻔했다(평판 임계값이 전부 깨진다).
 * - 행동력 상한을 120으로 올렸는데 clampResource(100)가 남아 있어 쓰는 순간 100으로 깎였다.
 */

/** src/ 아래 .ts 파일 전부 (테스트 자신은 제외) */
function sourceFiles(dir = "src"): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__") continue;
      out.push(...sourceFiles(p));
    } else if (name.endsWith(".ts")) {
      out.push(p);
    }
  }
  return out;
}

const SOURCES = sourceFiles().map((p) => ({ p, s: readFileSync(p, "utf8") }));

describe("스탯 상한", () => {
  it("스킬은 999, 리소스는 100이다", () => {
    expect(MAX_SKILL).toBe(999);
    expect(MAX_RESOURCE).toBe(100);
  });

  it("스킬 정의 9종이 전부 상한 999다", () => {
    for (const id of SKILL_STAT_IDS) {
      expect(SKILL_STATS[id].max, `${id}의 max`).toBe(MAX_SKILL);
    }
  });

  it("리소스 정의 4종이 전부 상한 100이다", () => {
    for (const def of Object.values(RESOURCE_STATS)) {
      expect(def.max).toBe(MAX_RESOURCE);
    }
  });

  it("clampSkill은 0~999, clampResource는 0~100에서 자른다", () => {
    expect(clampSkill(1500)).toBe(999);
    expect(clampSkill(-10)).toBe(0);
    expect(clampResource(150)).toBe(100);
    expect(clampResource(-10)).toBe(0);
  });

  it("skillTo100은 스킬을 0~100으로 선형 환산한다 (requirement 비교용)", () => {
    // 이 환산을 빼먹으면 0~100 기준 requirement와 비교할 때 전원 합격/전원 불합격이 된다.
    expect(skillTo100(MAX_SKILL)).toBeCloseTo(100, 1);
    expect(skillTo100(500)).toBeCloseTo(50, 0);
    expect(skillTo100(0)).toBe(0);
  });
});

describe("행동력 가변 상한", () => {
  it("기본 상한은 100, 보너스가 붙으면 그만큼 늘어난다", () => {
    const s = createInitialState();
    expect(actionMax(s)).toBe(MAX_RESOURCE);
    s.actionMaxBonus = 20;
    expect(actionMax(s)).toBe(120);
  });

  it("clampAction은 보너스를 반영해 자른다 (100으로 깎이면 안 된다)", () => {
    const s = createInitialState();
    s.actionMaxBonus = 20;
    // 실제 사고: 120에서 15를 쓰면 105여야 하는데 clampResource가 100으로 깎았다.
    expect(clampAction(s, 105)).toBe(105);
    expect(clampAction(s, 130)).toBe(120);
    expect(clampAction(s, -5)).toBe(0);
  });

  it("보너스가 없으면 100에서 막힌다", () => {
    const s = createInitialState();
    expect(clampAction(s, 130)).toBe(100);
  });
});

describe("클램프 오분류 (typecheck가 못 잡는다 — 소스 전수 검사)", () => {
  it("스킬에 clampResource/clampAction을 쓰지 않는다", () => {
    const bad = SOURCES.filter(
      ({ s }) => /clampResource\(\s*state\.skills/.test(s) || /clampAction\(\s*state,\s*state\.skills/.test(s),
    );
    expect(bad.map((b) => b.p)).toEqual([]);
  });

  it("리소스에 clampSkill을 쓰지 않는다", () => {
    const bad = SOURCES.filter(({ s }) => /clampSkill\(\s*state\.resources/.test(s));
    expect(bad.map((b) => b.p)).toEqual([]);
  });

  it("행동력이 아닌 리소스에 clampAction을 쓰지 않는다", () => {
    const bad = SOURCES.filter(({ s }) =>
      /clampAction\(\s*state,\s*state\.resources\.(mental|morality|reputation)/.test(s),
    );
    expect(bad.map((b) => b.p)).toEqual([]);
  });

  it("행동력을 clampResource나 Math.min(100)으로 자르지 않는다", () => {
    const bad = SOURCES.filter(
      ({ s }) =>
        /clampResource\(\s*state\.resources\.action/.test(s) ||
        /Math\.min\(\s*100\s*,\s*state\.resources\.action/.test(s),
    );
    expect(bad.map((b) => b.p)).toEqual([]);
  });

  it("스킬을 산술로 바꿀 땐 clampSkill을 거친다", () => {
    // 노리는 것: `state.skills.x = state.skills.x + 10`처럼 **클램프 없이 산술**로 쓰는 줄.
    //
    // 오탐을 피하려고 두 가지를 제외한다:
    // - `===`/`>=` 같은 비교문 (대입이 아니다) → `=` 뒤에 `=`가 오면 제외
    // - 앞줄에서 clampSkill한 변수를 대입하는 패턴 (`const after = clampSkill(...); state.skills[x] = after`)
    //   → 우변에 산술(+/-)이 없으면 이미 계산된 값이므로 제외
    const bad: string[] = [];
    for (const { p, s } of SOURCES) {
      s.split("\n").forEach((line: string, i: number) => {
        const m = line.match(/state\.skills(?:\.\w+|\[[^\]]+\])\s*=(?!=)\s*(.+)$/);
        if (!m) return;
        const rhs = m[1];
        const hasArithmetic = /[+\-]/.test(rhs);
        if (hasArithmetic && !rhs.includes("clampSkill")) bad.push(`${p}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
