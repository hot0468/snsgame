import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { resolveItem, ownedInventory, sellOwnedItem, sellPrice, ownedCount } from "@/systems/shop";
import { SHOP_ITEMS } from "@/data/shop";
import { COSMETICS } from "@/data/cosmetics";
import { GOBLIN_ITEMS } from "@/data/goblin";
import { PEEMANG_ITEMS } from "@/data/peemang";
import { MAX_SKILL } from "@/data/stats";

/**
 * 서랍장·피망마켓 판매 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 * - 리졸버가 **4종 출처를 전부** 덮는 것. 예전 adMail의 부분 리졸버는 도깨비를 놓쳤고,
 *   서랍장이 그걸 물려받으면 도깨비 아이템이 목록에서 조용히 사라진다.
 * - 판매가 인스턴스 **1개만** 빼는 것. repeatable(mouse)은 보유 개수가 곧 효과라
 *   전부 지우면 100만원짜리가 한 번에 증발한다.
 * - 판매가 스탯을 회수하는 것(되팔이 차단 — 사용자 확정 설계).
 */

describe("보유 아이템 리졸버", () => {
  it("4종 출처(상점·화장품·피망·도깨비)를 전부 해석한다", () => {
    for (const item of [...SHOP_ITEMS, ...COSMETICS, ...PEEMANG_ITEMS]) {
      expect(resolveItem(item.id), item.id).not.toBeNull();
    }
    for (const g of GOBLIN_ITEMS) {
      expect(resolveItem(g.id), g.id).not.toBeNull();
    }
  });

  it("skill+boost(단수)와 boosts(복수)를 같은 정규형으로 통일한다", () => {
    // 상점: 단수 → boosts 하나짜리
    expect(resolveItem("dress")?.boosts).toEqual({ beauty: 50 });
    // 도깨비: 복수 → 그대로
    expect(resolveItem("gob_glasses")?.boosts).toEqual({ knowledge: 300, vocabulary: 300 });
    // 스탯 없는 아이템: 빈 객체(회수할 게 없다)
    expect(resolveItem("gpu")?.boosts).toEqual({});
  });

  it("모르는 id는 null", () => {
    expect(resolveItem("존재하지_않는_아이템")).toBeNull();
  });

  // ITEM_INDEX는 Map이라 4종 출처에 같은 id가 있으면 뒤 출처가 앞을 조용히 덮는다.
  // 덮이면 이름·가격·회수 스탯이 전부 남의 것이 된다(판매가·스탯 회수가 어긋난다).
  // 새 물품을 추가하다 기존 id와 겹치는 순간 여기서 걸린다.
  it("4종 출처에 id 중복이 없다", () => {
    const ids = [
      ...SHOP_ITEMS.map((i) => i.id),
      ...COSMETICS.map((i) => i.id),
      ...PEEMANG_ITEMS.map((i) => i.id),
      ...GOBLIN_ITEMS.map((g) => g.id),
    ];
    const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dups, `중복 id: ${dups.join(", ")}`).toEqual([]);
  });
});

describe("sellOwnedItem", () => {
  it("정가의 50%를 주고 스탯을 회수한다", () => {
    // ⚠️ 가격을 하드코딩하지 마라 — SHOP_ITEMS에서 끌어온다.
    //    예전엔 18만원이 박혀 있어서 명품 원피스 가격을 올리자마자 이 테스트가 깨졌다.
    //    검증 대상은 "정가의 50%"라는 규칙이지 특정 금액이 아니다.
    const dress = SHOP_ITEMS.find((i) => i.id === "dress")!;
    const expected = Math.floor(dress.price / 2);

    const s = createInitialState();
    s.ownedItems.push("dress"); // beauty +50
    s.skills.beauty = 100;
    s.money = 0;

    expect(sellOwnedItem(s, "dress")).toBe(expected);
    expect(s.money).toBe(expected);
    expect(s.skills.beauty).toBe(50);
    expect(s.ownedItems).not.toContain("dress");
  });

  it("repeatable은 인스턴스 1개만 뺀다", () => {
    const s = createInitialState();
    s.ownedItems.push("mouse", "mouse", "mouse");

    sellOwnedItem(s, "mouse");
    expect(ownedCount(s, "mouse")).toBe(2);
  });

  // ⚠️ 위 테스트의 mouse는 스탯이 없는 유일한 repeatable이라 '개수'만 지킨다.
  // 스탯 회수가 보유 개수만큼 곱해지는 회귀(3개 보유 중 1개 판매에 -45)는 mouse로는 안 잡힌다.
  // stream_mic이 스탯을 가진 유일한 repeatable이므로 여기서 회수량을 못박는다.
  it("repeatable 판매는 스탯도 1개분만 회수한다(전량 회수 금지)", () => {
    const s = createInitialState();
    s.ownedItems.push("stream_mic", "stream_mic", "stream_mic");
    s.skills.vocabulary = 45; // 3개분(15×3)이 올라 있는 상태

    sellOwnedItem(s, "stream_mic");
    expect(ownedCount(s, "stream_mic")).toBe(2);
    expect(s.skills.vocabulary).toBe(30); // 15만 회수 — 45 전량이 아니다
  });

  it("도깨비 아이템의 다중 스탯을 전부 회수한다", () => {
    const s = createInitialState();
    s.ownedItems.push("gob_glasses");
    s.skills.knowledge = 400;
    s.skills.vocabulary = 350;

    sellOwnedItem(s, "gob_glasses");
    expect(s.skills.knowledge).toBe(100);
    expect(s.skills.vocabulary).toBe(50);
  });

  it("보유하지 않은 id는 null이고 아무것도 바꾸지 않는다", () => {
    const s = createInitialState();
    const money = s.money;
    expect(sellOwnedItem(s, "dress")).toBeNull();
    expect(s.money).toBe(money);
  });

  it("회수는 0 미만으로 내려가지 않는다", () => {
    const s = createInitialState();
    s.ownedItems.push("dress");
    s.skills.beauty = 10; // boost(50)보다 낮은 상태
    sellOwnedItem(s, "dress");
    expect(s.skills.beauty).toBe(0);
  });

  // 계약서에 명시된 '알고도 두는' 비대칭 — 버그로 잡지 말 것.
  it("999에서 잘린 상승분은 되돌아오지 않는다(수용된 판매 페널티)", () => {
    const s = createInitialState();
    s.ownedItems.push("dress");
    s.skills.beauty = MAX_SKILL; // 구매해도 안 올랐을 자리
    sellOwnedItem(s, "dress");
    expect(s.skills.beauty).toBe(MAX_SKILL - 50);
  });

  it("판매는 시간·행동력을 쓰지 않는다", () => {
    const s = createInitialState();
    s.ownedItems.push("dress");
    const { day, slot } = { day: s.day, slot: s.slot };
    const action = s.resources.action;

    sellOwnedItem(s, "dress");
    expect(s.day).toBe(day);
    expect(s.slot).toBe(slot);
    expect(s.resources.action).toBe(action);
  });
});

describe("서랍장 목록", () => {
  it("repeatable을 개수로 묶고, 해석 불가한 id는 버린다", () => {
    const s = createInitialState();
    s.ownedItems.push("mouse", "mouse", "dress", "유실된_id");

    const inv = ownedInventory(s);
    expect(inv).toHaveLength(2);
    expect(inv.find((e) => e.item.id === "mouse")?.count).toBe(2);
    expect(inv.find((e) => e.item.id === "dress")?.count).toBe(1);
  });
});

describe("피망마켓 물품", () => {
  it("전부 10만원 이하이고 스탯은 소량(≤20)이다", () => {
    for (const item of PEEMANG_ITEMS) {
      expect(item.price, item.id).toBeLessThanOrEqual(100_000);
      expect(item.boost ?? 0, item.id).toBeLessThanOrEqual(20);
    }
  });

  it("판매가는 정가의 50%(세일가 무관)", () => {
    const item = resolveItem(PEEMANG_ITEMS[0].id)!;
    expect(sellPrice(item)).toBe(Math.round(PEEMANG_ITEMS[0].price * 0.5));
  });
});
