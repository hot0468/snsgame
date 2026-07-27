import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import type { GameState } from "@/core/types";
import { MAX_SKILL } from "@/data/stats";
import { readBook } from "@/systems/books";
import { resolveStudy } from "@/systems/studyGroup";
import { viewYabamVideo } from "@/systems/yabam";
import { viewPushWork } from "@/systems/pushtime";
import { buyItem } from "@/systems/shop";
import { upgradeHousing } from "@/systems/housing";
import { resolveBoostDeal } from "@/systems/statBoost";
import { SHOP_ITEMS } from "@/data/shop";
import { HOUSINGS } from "@/data/housing";
import type { YabamVideo } from "@/data/yabam";
import type { PushWork } from "@/data/pushtime";

/**
 * 스킬 획득 **관문 라우팅** 회귀 테스트.
 *
 * 배경: 정신력 배율(`mentalEfficiency` 0.4~1.25)·퍼크 배율·상단 감쇠는 `systems/stats.ts`의
 * `gainSkill` 한 곳에서만 걸린다. 그런데 예전엔 60곳 가까이가
 * `state.skills[x] = clampSkill(state.skills[x] + n)`으로 **직접 대입해 관문을 우회**했다.
 * 그 경로들은 컨디션과 무관하게 액면 지급돼, "정신력이 육성의 단일 축"이라는 설계를 뚫었다.
 *
 * 이 파일이 고정하는 것은 두 갈래다:
 *  - **(가) 반복 육성** — 독서·스터디·성인물 감상 등은 `gainSkill`을 타야 하고,
 *    따라서 **정신력 0일 때가 100일 때보다 덜 올라야 한다**.
 *  - **(나) 확정 지급** — 상점/집/뒷거래처럼 수치가 미리 고지되고 대가를 이미 치른 지급은
 *    `{ flat: true }`로 관문을 통과하되 배율을 면제받아 **정신력과 무관하게 액면**이어야 한다.
 *
 * ⚠️ 기대치를 배율 상수로 하드코딩하지 않는다(튜닝하면 테스트가 먼저 썩는다).
 *    "낮은 정신력 < 높은 정신력"이라는 **부등식**과 "정신력 무관 동일"이라는 **등식**만 건다.
 */

/** 배율이 극단으로 갈리는 두 컨디션(0.4배 vs 1.25배). */
const LOW_MENTAL = 0;
const HIGH_MENTAL = 100;

function stateAt(mental: number): GameState {
  const s = createInitialState();
  s.resources.mental = mental;
  s.money = 100_000_000; // 구매·감상료 게이트를 모두 통과시킨다
  return s;
}

/**
 * 같은 행동을 정신력 0 / 100에서 각각 한 번씩 돌려, 지정 스킬의 상승분을 돌려준다.
 * 두 실행은 완전히 독립된 초기 상태에서 시작하므로 비교가 유효하다.
 */
function gainsAtBothMentals(
  run: (s: GameState) => void,
  skill: keyof GameState["skills"],
): { low: number; high: number } {
  const lo = stateAt(LOW_MENTAL);
  const hi = stateAt(HIGH_MENTAL);
  const loBefore = lo.skills[skill];
  const hiBefore = hi.skills[skill];
  run(lo);
  run(hi);
  return { low: lo.skills[skill] - loBefore, high: hi.skills[skill] - hiBefore };
}

describe("(가) 반복 육성 경로는 정신력 배율을 탄다", () => {
  it("독서(교양) — 지식 상승이 컨디션에 따라 갈린다", () => {
    const { low, high } = gainsAtBothMentals(
      (s) => readBook(s, "culture", "테스트 교양서"),
      "knowledge",
    );
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(0); // 배율이 걸려도 0으로 죽지는 않는다
  });

  it("독서(성인) — 음란도도 같은 관문을 탄다", () => {
    const { low, high } = gainsAtBothMentals((s) => readBook(s, "adult", "테스트 성인서"), "lewd");
    expect(high).toBeGreaterThan(low);
  });

  it("취업스터디 — 친화력이 컨디션에 따라 갈린다", () => {
    // randInt(8,12)라 1회 표본은 흔들린다. 여러 번 돌려 총합으로 비교한다.
    const runs = 30;
    const { low, high } = gainsAtBothMentals((s) => {
      for (let i = 0; i < runs; i++) resolveStudy(s);
    }, "sociability");
    expect(high).toBeGreaterThan(low);
  });

  it("야밤 영상 감상 — 음란도가 컨디션에 따라 갈린다", () => {
    const video = { id: "v_test", title: "테스트", desc: "" } as unknown as YabamVideo;
    const { low, high } = gainsAtBothMentals((s) => {
      viewYabamVideo(s, video);
    }, "lewd");
    expect(high).toBeGreaterThan(low);
  });

  it("푸시타임 작품 감상 — 음란도가 컨디션에 따라 갈린다", () => {
    const work = { id: "w_test", title: "테스트", desc: "" } as unknown as PushWork;
    const { low, high } = gainsAtBothMentals((s) => {
      viewPushWork(s, work);
    }, "lewd");
    expect(high).toBeGreaterThan(low);
  });
});

describe("(가) 경로는 표시값이 아니라 실제 반영 델타를 보고한다", () => {
  it("야밤 감상 문구의 '음란 +N'이 실제 상승분과 일치한다", () => {
    const video = { id: "v_test", title: "테스트", desc: "" } as unknown as YabamVideo;
    const s = stateAt(LOW_MENTAL); // 배율이 가장 세게 깎이는 구간
    const before = s.skills.lewd;
    const res = viewYabamVideo(s, video);
    const actual = s.skills.lewd - before;
    expect(res).toBeTruthy();
    expect(res!.message).toContain(`음란 +${actual}`);
    // 선언값 10이 그대로 박혀 있으면(구버그) actual(4)과 어긋난다.
    expect(actual).toBeLessThan(10);
  });

  it("푸시타임 감상 문구도 실제 상승분과 일치한다", () => {
    const work = { id: "w_test", title: "테스트", desc: "" } as unknown as PushWork;
    const s = stateAt(LOW_MENTAL);
    const before = s.skills.lewd;
    const res = viewPushWork(s, work);
    const actual = s.skills.lewd - before;
    expect(res).toBeTruthy();
    expect(res!.message).toContain(`음란 +${actual}`);
  });

  it("뒷거래 성공 문구의 상승 수치가 실제 상승분과 일치한다(999 상한 포함)", () => {
    // 상한에 걸리도록 미리 채워 두면, 선언값을 그대로 쓰는 구현은 여기서 어긋난다.
    let checked = false;
    for (let i = 0; i < 40 && !checked; i++) {
      const s = stateAt(HIGH_MENTAL);
      s.skills.fitness = MAX_SKILL - 30;
      const before = s.skills.fitness;
      const res = resolveBoostDeal(s, "fitness");
      if (res.scammed) continue;
      const actual = s.skills.fitness - before;
      expect(actual).toBe(30); // 999에서 잘린다
      expect(res.message).toContain(`${actual}이나 뛰어 있었다`);
      checked = true;
    }
    expect(checked, "40회 안에 거래 성공이 한 번은 나와야 한다").toBe(true);
  });
});

describe("(나) 확정 지급 경로는 액면 그대로다", () => {
  it("상점 구매 부스트 — 정신력과 무관하게 표기된 수치가 그대로 오른다", () => {
    const item = SHOP_ITEMS.find((i) => i.skill && i.boost && !i.repeatable);
    expect(item, "스탯 부스트가 있는 상점 아이템이 있어야 한다").toBeTruthy();
    if (!item?.skill || !item.boost) return;

    const { low, high } = gainsAtBothMentals((s) => {
      buyItem(s, item);
    }, item.skill);
    expect(low).toBe(item.boost);
    expect(high).toBe(item.boost);
  });

  it("사고팔기가 대칭이다 — 되팔이해도 스탯이 순손실되지 않는다", () => {
    // 지급이 배율을 타면(예: +50 선언에 +20 지급) 회수는 선언값 50을 빼므로 순손실이 난다.
    const item = SHOP_ITEMS.find((i) => i.skill && i.boost && !i.repeatable);
    if (!item?.skill || !item.boost) return;
    const s = stateAt(LOW_MENTAL);
    s.skills[item.skill] = 300;
    const before = s.skills[item.skill];
    buyItem(s, item);
    // sellOwnedItem은 선언값 boost를 그대로 회수한다 — 지급도 액면이어야 원복된다.
    expect(s.skills[item.skill] - before).toBe(item.boost);
  });

  it("이사 영구 스탯 — 정신력과 무관하게 액면 지급된다", () => {
    const tier = HOUSINGS.findIndex(
      (h) => h.permaSkills && Object.keys(h.permaSkills).length > 0,
    );
    expect(tier, "영구 스탯이 붙은 집 단계가 있어야 한다").toBeGreaterThan(0);
    if (tier <= 0) return;
    const target = HOUSINGS[tier];
    const [skill, amount] = Object.entries(target.permaSkills!)[0] as [
      keyof GameState["skills"],
      number,
    ];

    const { low, high } = gainsAtBothMentals((s) => {
      s.housingTier = tier - 1;
      upgradeHousing(s);
    }, skill);
    expect(low).toBe(amount);
    expect(high).toBe(amount);
  });
});
