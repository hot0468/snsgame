import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { missionDef } from "@/data/missions";
import {
  recordMission,
  claimMission,
  claimableCount,
  ensureMissions,
} from "@/systems/missions";

describe("일일/주간 도전과제", () => {
  it("초기 상태에 일일 3·주간 2 세트가 굴려져 있다", () => {
    const s = createInitialState();
    expect(s.missions.daily.length).toBe(3);
    expect(s.missions.weekly.length).toBe(2);
    // 모든 인스턴스는 유효한 정의를 가리킨다
    for (const inst of [...s.missions.daily, ...s.missions.weekly]) {
      expect(missionDef(inst.id)).toBeDefined();
      expect(inst.progress).toBe(0);
      expect(inst.claimed).toBe(false);
    }
  });

  it("같은 날은 세트가 안 바뀌고, 날이 바뀌면 재추첨된다", () => {
    const s = createInitialState();
    const before = s.missions.daily.map((i) => i.id).join(",");
    ensureMissions(s); // 같은 날 → 그대로
    expect(s.missions.daily.map((i) => i.id).join(",")).toBe(before);
    s.day += 1;
    ensureMissions(s);
    expect(s.missions.day).toBe(s.day); // 새 날 기준으로 갱신됨
  });

  it("recordMission이 해당 metric 미션만 goal까지 올린다", () => {
    const s = createInitialState();
    // tweet 미션이 하나 이상 있도록 강제 주입
    s.missions.daily = [{ id: "d_tweet3", progress: 0, claimed: false }];
    recordMission(s, "like"); // 다른 metric → 변화 없음
    expect(s.missions.daily[0].progress).toBe(0);
    recordMission(s, "tweet");
    recordMission(s, "tweet");
    recordMission(s, "tweet");
    recordMission(s, "tweet"); // goal(3) 초과분은 무시
    expect(s.missions.daily[0].progress).toBe(3);
  });

  it("완료한 미션만 보상을 1회 지급하고 다시 못 받는다", () => {
    const s = createInitialState();
    s.missions.daily = [{ id: "d_tweet3", progress: 0, claimed: false }];
    s.missions.weekly = [];
    const money0 = s.money;

    // 미완료 → 보상 없음
    expect(claimMission(s, "d_tweet3")).toBeNull();
    expect(claimableCount(s)).toBe(0);

    recordMission(s, "tweet", 3); // 완료
    expect(claimableCount(s)).toBe(1);

    const reward = claimMission(s, "d_tweet3");
    expect(reward).not.toBeNull();
    expect(s.money).toBe(money0 + (missionDef("d_tweet3")!.reward.money ?? 0));

    // 중복 수령 방지
    expect(claimMission(s, "d_tweet3")).toBeNull();
    expect(claimableCount(s)).toBe(0);
  });
});
