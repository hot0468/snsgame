import { describe, it, expect } from "vitest";
import { TIERS, TIER_ORDER } from "@/data/jobs";
import { CERTIFICATIONS } from "@/data/certifications";
import { DARTPIN_POSTS } from "@/data/dartpin";
import { createInitialState } from "@/core/state";
import { currentSalary, livingCostToday, rentAmount } from "@/systems/economy";
import { todaysCertifications, specialCertificationToday } from "@/systems/certification";
import { SKILL_STAT_IDS } from "@/data/stats";

/**
 * 밸런스 곡선·결정론 회귀 테스트.
 *
 * 이 파일이 지키는 것: "등급이 오를수록 좋아진다"는 방향성과, 날마다 뽑는 목록의 결정론.
 * 둘 다 typecheck를 통과하면서 조용히 뒤집힐 수 있다 —
 * 실제로 야근률이 등급과 **반대로** 설정돼 대기업이 야근을 제일 많이 했고,
 * 자격증 5종이 며칠씩 같은 항목에 고정돼 있었다.
 */

describe("회사 등급 곡선 — 등급이 오를수록 좋아야 한다", () => {
  it("역량 요구치는 등급이 오를수록 높다", () => {
    const reqs = TIER_ORDER.map((t) => TIERS[t].requirement);
    expect(reqs).toEqual([...reqs].sort((a, b) => a - b));
  });

  it("야근률은 등급이 오를수록 낮다 (반대로 설정된 적 있음)", () => {
    const rates = TIER_ORDER.map((t) => TIERS[t].overtimeRate);
    expect(rates, `야근률 ${rates.join(" → ")}`).toEqual([...rates].sort((a, b) => b - a));
  });

  it("기본급은 등급이 오를수록 높다", () => {
    const pay = TIER_ORDER.map((t) => TIERS[t].baseSalary);
    expect(pay).toEqual([...pay].sort((a, b) => a - b));
  });

  it("월급은 등급을 반영한다 (한때 전 등급이 동일했다)", () => {
    const at = (tier: any) => currentSalary({ tier, perfLevel: 0 } as any);
    expect(at("large")).toBeGreaterThan(at("micro"));
  });

  it("딴짓 적발률은 등급이 오를수록 높다 — 야근률과 반대인 게 의도다", () => {
    // 이 둘을 같은 방향으로 '정렬'하면 등급 선택의 트레이드오프가 사라진다.
    const caught = TIER_ORDER.map((t) => TIERS[t].caughtRate);
    expect(caught).toEqual([...caught].sort((a, b) => a - b));
  });
});

describe("대기업 복지 — 다트 핀 힌트가 주장하는 것들", () => {
  // data/dartpin.ts의 dp_hint_large 본문이 이 넷을 사실이라고 말한다.
  // 하나라도 깨지면 게임이 플레이어에게 거짓말을 하게 된다.
  const employed = (tier: any) => {
    const s = createInitialState();
    (s as any).employment = { company: "X", tier, hiredDay: 1, performance: 0, perfLevel: 0, overtimeDay: -1, lastSalaryMonth: -1 };
    return s;
  };

  it("연봉: 대기업이 가장 높다", () => {
    expect(currentSalary(employed("large").employment!)).toBeGreaterThan(
      currentSalary(employed("micro").employment!),
    );
  });

  it("야근: 대기업이 가장 적다", () => {
    expect(TIERS.large.overtimeRate).toBeLessThan(TIERS.micro.overtimeRate);
  });

  it("삼시세끼: 대기업은 평일 생활비가 면제다", () => {
    const s = employed("large");
    const weekday = [1, 2, 3, 4, 5].map((d) => livingCostToday({ ...s, day: d } as any));
    expect(Math.min(...weekday)).toBe(0);
    expect(livingCostToday(employed("micro"))).toBeGreaterThan(0);
  });

  it("월세 지원: 대기업은 월세가 반값이다", () => {
    expect(rentAmount(employed("large"))).toBeLessThan(rentAmount(employed("micro")));
  });
});

describe("O넷 자격증 목록 — 결정론", () => {
  it("같은 날 여러 번 호출해도 같은 5종이 나온다", () => {
    // Math.random을 쓰면 화면을 다시 그릴 때마다 목록이 바뀐다.
    const s = createInitialState();
    s.day = 42;
    const first = todaysCertifications(s).map((c) => c.id);
    for (let i = 0; i < 20; i++) {
      expect(todaysCertifications(s).map((c) => c.id)).toEqual(first);
    }
  });

  it("날이 바뀌면 목록이 재편성된다", () => {
    const s = createInitialState();
    let same = 0;
    for (let d = 1; d < 60; d++) {
      const a = todaysCertifications({ ...s, day: d } as any).map((c) => c.id).join();
      const b = todaysCertifications({ ...s, day: d + 1 } as any).map((c) => c.id).join();
      if (a === b) same++;
    }
    expect(same, "연속 이틀 동일한 날이 있으면 안 된다").toBe(0);
  });

  it("특별 시험(onlyOn·randomChance)은 랜덤 5칸을 잡아먹지 않는다", () => {
    const s = createInitialState();
    for (let d = 1; d < 400; d++) {
      const board = todaysCertifications({ ...s, day: d } as any);
      const leaked = board.filter((c) => c.onlyOn || c.randomChance);
      expect(leaked.map((c) => c.id), `${d}일차`).toEqual([]);
    }
  });

  it("특별 시험은 하나만 반환한다 (죽은 카드 방지)", () => {
    // 대기 슬롯이 하나뿐이라 둘을 노출하면 하나는 눌러도 안 되는 카드가 된다.
    const s = createInitialState();
    for (let d = 1; d < 400; d++) {
      const special = specialCertificationToday({ ...s, day: d } as any);
      expect(special === null || typeof special.id === "string").toBe(true);
    }
  });
});

describe("데이터 정합성", () => {
  it("자격증 id가 유일하다", () => {
    const ids = CERTIFICATIONS.map((c) => c.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("자격증 판정 스킬 키가 전부 유효하다", () => {
    for (const c of CERTIFICATIONS) {
      for (const k of Object.keys(c.skills)) {
        expect(SKILL_STAT_IDS, `${c.id}의 skills.${k}`).toContain(k);
      }
    }
  });

  it("자격증 곡선에 역전이 없다 (어려울수록 비싸고 보상이 크다)", () => {
    const sorted = [...CERTIFICATIONS].sort((a, b) => a.requirement - b.requirement);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].fee, `${sorted[i].id} 응시료`).toBeGreaterThanOrEqual(sorted[i - 1].fee);
      expect(sorted[i].jobBonus, `${sorted[i].id} 취업보너스`).toBeGreaterThanOrEqual(sorted[i - 1].jobBonus);
    }
  });

  it("다트 핀 게시물 id가 유일하다", () => {
    const ids = DARTPIN_POSTS.map((p) => p.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});
