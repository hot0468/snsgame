import { describe, it, expect, beforeEach } from "vitest";
import { createInitialState } from "@/core/state";
import { loadGame } from "@/systems/save";
import { SKILL_STAT_IDS, RESOURCE_STATS } from "@/data/stats";

/**
 * 세이브 하위호환 회귀 테스트.
 *
 * 이 파일이 지키는 것: 구세이브(새 필드가 없는 저장본)를 로드해도 크래시하지 않고,
 * 새 필드가 `undefined`로 남지 않는 것.
 *
 * 왜 중요한가: `undefined`가 산술에 들어가면 NaN이 되고, 그 NaN이 상태에 저장돼
 * **세이브까지 오염**된다. 한 번 오염되면 되돌릴 수 없다. GameState에 필드를 추가할
 * 때마다 이 테스트에 그 필드를 넣어라.
 */

const KEY = "snsgame:save:v2";
const store: Record<string, string> = {};

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  };
});

/** 필드 몇 개를 지운 '구세이브'를 만들어 로드한다 */
function loadLegacy(mutate: (o: any) => void) {
  const legacy: any = createInitialState();
  mutate(legacy);
  store[KEY] = JSON.stringify(legacy);
  const loaded = loadGame();
  expect(loaded, "구세이브 로드가 null을 반환하면 안 된다").toBeTruthy();
  return loaded!;
}

describe("구세이브 하위호환", () => {
  it("신규 스킬 키가 없어도 0으로 복원되고 NaN이 안 생긴다", () => {
    // 실제 사고: 'game' 스킬을 새로 추가했을 때 구세이브엔 그 키가 없었다.
    const s = loadLegacy((o) => delete o.skills.game);
    for (const id of SKILL_STAT_IDS) {
      expect(Number.isFinite(s.skills[id]), `skills.${id}이 유한수가 아니다`).toBe(true);
    }
    expect(s.skills.game).toBe(0);
  });

  it("모든 스킬·리소스가 유한수로 복원된다", () => {
    const s = loadLegacy((o) => {
      delete o.skills;
      delete o.resources;
    });
    for (const id of SKILL_STAT_IDS) expect(Number.isFinite(s.skills[id])).toBe(true);
    for (const id of Object.keys(RESOURCE_STATS)) {
      expect(Number.isFinite((s.resources as any)[id]), `resources.${id}`).toBe(true);
    }
  });

  it("신규 기능 필드가 없어도 크래시 없이 기본값이 채워진다", () => {
    // GameState에 필드를 추가하면 여기에 추가하라.
    const s = loadLegacy((o) => {
      delete o.certifications;
      delete o.pendingExam;
      delete o.pendingSpecialExam;
      delete o.auction;
      delete o.lab;
      delete o.tuckerDmDay;
      delete o.actionMaxBonus;
      delete o.cheats;
      delete o.dartpinUnlocked;
      delete o.dartpinBoard;
      delete o.ownedItems;
      delete o.workMsgs;
      delete o.stamina;
      delete o.staminaMax;
      delete o.sickPending;
    });
    expect(Array.isArray(s.certifications)).toBe(true);
    expect(Array.isArray(s.ownedItems)).toBe(true);
    expect(Array.isArray(s.workMsgs)).toBe(true);
    expect(s.pendingExam).toBeNull();
    expect(s.auction).toBeTruthy();
    expect(s.lab).toBeTruthy();
    expect(Number.isFinite(s.actionMaxBonus)).toBe(true);
    expect(s.cheats).toBeTruthy();
    expect(s.dartpinUnlocked).toBe(false);
    // 체력: staminaMax가 0/부재면 clampStamina가 체력을 영구 0으로 눌러 세이브를 오염시킨다.
    expect(s.staminaMax).toBeGreaterThan(0);
    expect(Number.isFinite(s.stamina)).toBe(true);
    expect(s.sickPending).toBe(false);
  });

  it("staminaMax가 0/NaN으로 오염돼 있어도 유효한 상한으로 복구된다", () => {
    // staminaMax=0이면 clampStamina(0..0)가 체력을 영구히 0으로 눌러버린다(치명).
    for (const bad of [0, null, undefined, NaN, -5]) {
      const s = loadLegacy((o) => (o.staminaMax = bad));
      expect(s.staminaMax, `staminaMax=${String(bad)}`).toBeGreaterThan(0);
      expect(Number.isFinite(s.staminaMax)).toBe(true);
    }
  });

  it("actionMaxBonus가 오염돼 있어도 유한수로 복구된다", () => {
    // ?? 는 NaN을 통과시킨다 — 그래서 Number.isFinite 검사가 필요하다.
    for (const bad of [null, undefined, "x", NaN]) {
      const s = loadLegacy((o) => (o.actionMaxBonus = bad));
      expect(Number.isFinite(s.actionMaxBonus), `actionMaxBonus=${String(bad)}`).toBe(true);
    }
  });

  it("진행 중인 세이브의 값은 덮어쓰지 않는다", () => {
    const s = loadLegacy((o) => {
      o.skills.game = 500;
      o.actionMaxBonus = 20;
      o.cheats = { money: true, cheatExe: true };
    });
    expect(s.skills.game).toBe(500);
    expect(s.actionMaxBonus).toBe(20);
    expect(s.cheats.money).toBe(true);
  });
});
