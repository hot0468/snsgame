import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { PEEMANG_ITEMS } from "@/data/peemang";
import { PEEMANG_DAILY_COUNT, todayPeemangItems } from "@/systems/shop";

/**
 * 피망마켓 일일 매물 회귀 테스트.
 *
 * 왜 넣었나: 예전엔 전체 목록을 항상 보여주고 산 물건만 회색 처리했다. 중고 직거래인데
 * 목록이 영영 안 바뀌니 한 번 훑고 나면 다시 들어올 이유가 없었다.
 *
 * 고정하는 불변식:
 *  1) 하루치만 보인다.
 *  2) 같은 날엔 몇 번을 봐도 같다 — 재렌더마다 목록이 갈리면 누르려던 카드가 손 밑에서 바뀐다.
 *  3) 날이 바뀌면 달라진다.
 *  4) 산 물건은 내려간다.
 */

describe("피망마켓 일일 매물", () => {
  it("하루치만 보인다", () => {
    const s = createInitialState();
    expect(todayPeemangItems(s)).toHaveLength(PEEMANG_DAILY_COUNT);
    expect(PEEMANG_ITEMS.length).toBeGreaterThan(PEEMANG_DAILY_COUNT);
  });

  it("같은 날엔 몇 번을 봐도 같다", () => {
    const s = createInitialState();
    expect(todayPeemangItems(s).map((i) => i.id)).toEqual(todayPeemangItems(s).map((i) => i.id));
  });

  it("날이 바뀌면 목록도 바뀐다", () => {
    const a = createInitialState();
    const b = createInitialState();
    b.day = a.day + 1;
    // 6개를 뽑으니 우연히 겹칠 수는 있어도 통째로 같으면 리셋이 안 도는 것이다.
    expect(todayPeemangItems(a).map((i) => i.id)).not.toEqual(
      todayPeemangItems(b).map((i) => i.id),
    );
  });

  it("산 물건은 목록에서 내려간다", () => {
    const s = createInitialState();
    const bought = todayPeemangItems(s)[0];
    s.ownedItems.push(bought.id);
    expect(todayPeemangItems(s).map((i) => i.id)).not.toContain(bought.id);
  });

  it("많이 사도 매대가 비지 않는다 — 매일 여섯 장은 채워진다", () => {
    // ⚠️ 처음엔 미보유 물건만 뽑았다. 풀이 14개뿐이라 아홉 개만 사면 여섯 장이 안 차고,
    //    다 사면 매대가 영영 빈다("피망마켓 물품이 안 채워져"). 중고 직거래인데
    //    동네에 내놓을 물건이 떨어질 리가 없다 — 모자라면 이미 산 물건이 다시 올라온다
    //    (화면에서 '거래완료'로 회색 처리되고 못 누른다).
    const s = createInitialState();
    for (const step of [0, 5, 9, PEEMANG_ITEMS.length]) {
      const fresh = createInitialState();
      fresh.ownedItems.push(...PEEMANG_ITEMS.slice(0, step).map((i) => i.id));
      expect(todayPeemangItems(fresh).length, `${step}개 산 뒤 매대가 비었다`).toBe(
        PEEMANG_DAILY_COUNT,
      );
    }
    expect(s).toBeTruthy();
  });

  it("살 수 있는 물건을 먼저 채운다 — 회색 카드만 늘어놓지 않는다", () => {
    const s = createInitialState();
    // 여섯 장을 채우고도 남을 만큼 미보유가 있으면 전부 미보유여야 한다.
    s.ownedItems.push(...PEEMANG_ITEMS.slice(0, 3).map((i) => i.id));
    const owned = todayPeemangItems(s).filter((it) => s.ownedItems.includes(it.id));
    expect(owned.length, "살 게 남았는데 거래완료 카드가 섞였다").toBe(0);
  });

  it("풀이 하루치보다 넉넉하다 — 매일 조합이 갈릴 여지가 있어야 한다", () => {
    expect(PEEMANG_ITEMS.length).toBeGreaterThanOrEqual(PEEMANG_DAILY_COUNT * 4);
  });

  it("id가 중복되지 않는다 — 겹치면 하나는 영영 안 팔린다", () => {
    const ids = PEEMANG_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("boost 구간별 가격대를 지킨다 — data/peemang.ts 상단이 선언한 계약이다", () => {
    // ⚠️ 물량을 늘릴 때 이 띠를 벗어나기 쉽다(실제로 여섯 개가 벗어난 채 들어왔다).
    //    벗어나면 "같은 스탯인데 어떤 건 반값"이 되어 나머지 카드가 죽는다.
    const BANDS: Record<number, [number, number]> = {
      10: [12_000, 25_000],
      15: [35_000, 60_000],
      20: [80_000, 95_000],
    };
    for (const it of PEEMANG_ITEMS) {
      expect(it.id.startsWith("pm_"), `${it.id}: id는 pm_ 프리픽스다`).toBe(true);
      expect(it.repeatable ?? false, `${it.id}: 전부 1회 구매다`).toBe(false);
      const band = BANDS[it.boost ?? 0];
      expect(band, `${it.id}: boost ${it.boost}는 정의된 구간이 아니다`).toBeTruthy();
      expect(it.price, `${it.id}: 가격이 boost ${it.boost} 구간을 벗어났다`).toBeGreaterThanOrEqual(
        band[0],
      );
      expect(it.price, `${it.id}: 가격이 boost ${it.boost} 구간을 벗어났다`).toBeLessThanOrEqual(
        band[1],
      );
    }
  });
});
