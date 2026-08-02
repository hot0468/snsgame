import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { jobLevelRows } from "@/systems/jobLevels";
import { CHANNEL_TRACKS, currentRankStep, rankTracks } from "@/systems/jobRanks";
import { RANK_THRESHOLDS } from "@/data/jobRanks";
import { comboControversy, comboMultiplier } from "@/systems/tweetSystem";
import { COMBO_BONUS_RATE, COMBO_CONTROVERSY_RATE, COMBO_MAX_STEP } from "@/data/tweetFun";
import type { GameState } from "@/core/types";

/**
 * "쌓이는데 화면에 안 보이는 것" 감시.
 *
 * 이 저장소가 반복해서 낸 버그가 이것 하나다 — 카운터는 올라가는데 읽는 곳이 없어서
 * 플레이어가 그 장치의 존재조차 모른다(streamCount·awardsWon·tweetStreak이 실제로 그랬다).
 * 새 진행 요소를 만들면 **볼 자리도 같이** 만들어야 한다.
 */

function withStreams(n: number): GameState {
  const s = createInitialState();
  s.streamCount = n;
  return s;
}

describe("채널 등급이 도감에 보인다", () => {
  it("모든 등급 트랙에 도감 칸이 있다 — 사다리를 붙였으면 볼 자리도 있어야 한다", () => {
    // ⚠️ 채널을 도감에서 빼두면 승급 팝업만 뜨고 그 뒤로 등급을 볼 데가 없다(실제로 그랬다).
    const s = withStreams(1);
    s.savannaCount = 1;
    s.adultMode = true; // 성인 직업·채널 칸은 성인물 보기가 켜져야 목록에 나온다(그게 정상 동작)
    const ids = new Set(jobLevelRows(s).map((r) => r.id));
    for (const t of rankTracks()) {
      expect(ids.has(t.id), `${t.id}(${t.label})가 도감에 없다`).toBe(true);
    }
  });

  it("방송을 켠 적 없으면 잠긴 칸으로, 켰으면 열린 칸으로 뜬다", () => {
    const never = jobLevelRows(createInitialState()).find((r) => r.id === "stream")!;
    expect(never.unlocked).toBe(false);
    expect(never.hint.length).toBeGreaterThan(0);

    const did = jobLevelRows(withStreams(3)).find((r) => r.id === "stream")!;
    expect(did.unlocked, "방송을 켰는데 도감이 잠겨 있다").toBe(true);
    expect(did.detail).toContain("3회");
  });

  it("채널도 등급명과 다음 계단까지 남은 수가 붙는다", () => {
    const s = withStreams(RANK_THRESHOLDS[1]);
    const row = jobLevelRows(s).find((r) => r.id === "stream")!;
    expect(row.rankStep).toBe(2);
    expect(row.rankTitle, "채널 등급명이 없다").toBeTruthy();
    expect(row.toNextRank).toBe(RANK_THRESHOLDS[2] - RANK_THRESHOLDS[1]);
    expect(currentRankStep(s, "stream")).toBe(2);
  });

  it("성인 채널은 성인물 보기가 꺼져 있고 안 해봤으면 숨는다", () => {
    const s = createInitialState();
    s.adultMode = false;
    const adultChannels = CHANNEL_TRACKS.filter((c) => c.id === "savanna");
    expect(adultChannels.length).toBe(1);
    expect(jobLevelRows(s).some((r) => r.id === "savanna")).toBe(false);

    s.savannaCount = 2; // 해봤으면 설정과 무관하게 남는다
    expect(jobLevelRows(s).some((r) => r.id === "savanna")).toBe(true);
  });
});

describe("수상 이력이 남는다", () => {
  it("시상식에서 받은 상이 상태에 쌓인다 — 화면(jobLevelModal)이 이걸 읽는다", () => {
    // ⚠️ 기록만 해두고 아무 데도 안 보여주면 시상식이 팝업 한 번 보고 끝난다.
    const s = createInitialState();
    expect(s.awardsWon).toEqual([]);
    s.awardsWon!.push({ year: 2026, id: "award_stream", label: "올해의 크리에이터상", grand: true });
    expect(s.awardsWon!.length).toBe(1);
    expect(s.awardsWon![0].grand).toBe(true);
  });
});

describe("연속 트윗 콤보", () => {
  it("연타가 쌓이면 도달 배수가 오른다", () => {
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(2)).toBeCloseTo(1 + COMBO_BONUS_RATE, 5);
    expect(comboMultiplier(3)).toBeGreaterThan(comboMultiplier(2));
  });

  it("상한을 넘으면 배수도 논란도 더 안 오른다", () => {
    expect(comboMultiplier(COMBO_MAX_STEP + 5)).toBe(comboMultiplier(COMBO_MAX_STEP));
    expect(comboControversy(COMBO_MAX_STEP + 5)).toBe(comboControversy(COMBO_MAX_STEP));
  });

  it("보상만 있는 게 아니라 논란 위험도 같이 오른다 — 그래서 선택이 된다", () => {
    expect(comboControversy(1)).toBe(0);
    expect(comboControversy(2)).toBeCloseTo(COMBO_CONTROVERSY_RATE, 5);
    expect(comboControversy(3)).toBeGreaterThan(comboControversy(2));
  });

  it("연타 상태가 상태에 남는다 — 화면(composeModal)이 이걸 읽어 표시한다", () => {
    const s = createInitialState();
    expect(s.tweetStreak).toBeNull();
    s.tweetStreak = { attr: "daily", count: 3 };
    expect(s.tweetStreak.count).toBe(3);
  });
});
