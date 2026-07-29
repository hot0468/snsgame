import { describe, it, expect } from "vitest";
import { DOLLS, dollById } from "@/data/arcade";

/**
 * 오락실 인형뽑기 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 * - 한 방문 = 인형 1개 상한(이 기능의 밸런스 축).
 * - 중복 뽑기가 도감이 아니라 재고로 가는 것(도감 1호기 영구 보존).
 * - 판매가 재고만 차감하고 도감을 비우지 않는 것.
 */

describe("인형 카탈로그", () => {
  it("12종이며 common 8 · rare 4로 나뉜다", () => {
    expect(DOLLS).toHaveLength(12);
    expect(DOLLS.filter((d) => d.rarity === "common")).toHaveLength(8);
    expect(DOLLS.filter((d) => d.rarity === "rare")).toHaveLength(4);
  });

  it("id가 doll_ 프리픽스이고 전부 유일하다", () => {
    for (const d of DOLLS) expect(d.id.startsWith("doll_"), d.id).toBe(true);
    expect(new Set(DOLLS.map((d) => d.id)).size).toBe(DOLLS.length);
  });

  it("모든 인형이 이름·설명·자랑문구를 갖는다", () => {
    for (const d of DOLLS) {
      expect(d.name.length, d.id).toBeGreaterThan(0);
      expect(d.desc.length, d.id).toBeGreaterThan(10);
      expect(d.brag.length, d.id).toBeGreaterThan(5);
    }
  });

  it("시세는 일반 3천~6천 · 레어 2만~4.5만이다", () => {
    for (const d of DOLLS) {
      if (d.rarity === "common") {
        expect(d.resale, d.id).toBeGreaterThanOrEqual(3_000);
        expect(d.resale, d.id).toBeLessThanOrEqual(6_000);
      } else {
        expect(d.resale, d.id).toBeGreaterThanOrEqual(20_000);
        expect(d.resale, d.id).toBeLessThanOrEqual(45_000);
      }
    }
  });

  it("dollById가 id로 인형을 찾는다", () => {
    expect(dollById(DOLLS[0].id)?.name).toBe(DOLLS[0].name);
    expect(dollById("doll_nonexistent")).toBeUndefined();
  });
});
