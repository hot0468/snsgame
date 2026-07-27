/**
 * 회귀: 구세이브 마일스톤 백필 게이트가 **죽은 폴백**이었던 버그.
 *
 * loadGame이 `{...createInitialState(), ...parsed}`로 병합하므로 merged.statMilestones는
 * 키가 없던 구세이브에서도 항상 `[]`(배열)이다. sanitize가 merged를 보고
 * `!Array.isArray(state.statMilestones)`로 판정하면 절대 참이 되지 않아 백필이 안 돌았다.
 *
 * 그 결과 구세이브 플레이어는 다음 onNewDay의 checkStatMilestones에서 밀린 마일스톤을
 * 전부 '신규 달성'으로 받아 소급 보상(돈·팔로워·행동력 상한)과 토스트 폭탄을 맞았다.
 * loadGame의 youtubeUnlocked·adultMode·loggedIn이 이미 겪은 것과 같은 함정이다.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { SKILL_STAT_IDS } from "@/data/stats";
import { loadGame } from "@/systems/save";
import { checkStatMilestones } from "@/systems/milestones";
import type { GameState } from "@/core/types";

const SAVE_KEY = "snsgame:save:v2";
const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** 스킬이 모두 `skill`인 구세이브(statMilestones 키 없음)를 심고 로드한다. */
function loadOldSave(skill: number): GameState {
  const s = createInitialState() as unknown as Record<string, unknown>;
  const skills = s.skills as Record<string, number>;
  for (const k of Object.keys(skills)) skills[k] = skill;
  delete s.statMilestones; // 구세이브 = 키 자체가 없다
  store.set(SAVE_KEY, JSON.stringify(s));
  return loadGame()!;
}

describe("구세이브 마일스톤 백필", () => {
  it("statMilestones 키가 없던 구세이브에 백필이 실제로 돈다", () => {
    const loaded = loadOldSave(650);
    // 스킬 650 → 전 스킬 × 문턱 3개(100·300·600). 스킬 개수는 하드코딩하지 마라 —
    // 스탯이 하나 늘 때마다(예: 변태력) 이 테스트만 애먼 데서 깨진다.
    expect(loaded.statMilestones.length).toBe(SKILL_STAT_IDS.length * 3);
  });

  it("백필된 세이브는 이후 checkStatMilestones에서 소급 보상을 받지 않는다", () => {
    const loaded = loadOldSave(650);
    const money = loaded.money;
    const followers = getActiveAccount(loaded).followers;
    const actionBonus = loaded.actionMaxBonus;

    const newly = checkStatMilestones(loaded);

    expect(newly).toEqual([]);
    expect(loaded.money).toBe(money);
    expect(getActiveAccount(loaded).followers).toBe(followers);
    expect(loaded.actionMaxBonus).toBe(actionBonus);
    expect(loaded.pendingMilestones).toEqual([]); // 토스트 폭탄 없음
  });

  it("백필은 보상 없이 claimed만 기록한다(로드 시점에 돈·팔로워가 늘지 않는다)", () => {
    const fresh = createInitialState();
    const loaded = loadOldSave(650);
    expect(loaded.money).toBe(fresh.money);
    expect(loaded.actionMaxBonus).toBe(fresh.actionMaxBonus);
  });

  it("이미 statMilestones가 있는 세이브는 백필이 덮어쓰지 않는다", () => {
    const s = createInitialState();
    for (const k of Object.keys(s.skills) as (keyof typeof s.skills)[]) s.skills[k] = 650;
    s.statMilestones = ["fitness:0"]; // 플레이어가 실제로 달성한 1개만
    store.set(SAVE_KEY, JSON.stringify(s));
    const loaded = loadGame()!;
    expect(loaded.statMilestones).toEqual(["fitness:0"]);
  });
});
