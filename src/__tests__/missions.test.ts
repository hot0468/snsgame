import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { missionDef } from "@/data/missions";
import { recordMission, ensureMissions } from "@/systems/missions";

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

  it("달성하는 즉시 보상을 자동 지급하고 pendingMissions에 큐잉한다(1회만)", () => {
    const s = createInitialState();
    s.missions.daily = [{ id: "d_tweet3", progress: 0, claimed: false }];
    s.missions.weekly = [];
    s.pendingMissions = [];
    const money0 = s.money;
    const reward = missionDef("d_tweet3")!.reward.money ?? 0;

    recordMission(s, "tweet", 2); // 미완료 → 보상·큐잉 없음
    expect(s.money).toBe(money0);
    expect(s.pendingMissions).toEqual([]);

    recordMission(s, "tweet", 1); // 목표 도달 → 자동 지급 + 큐잉
    expect(s.money).toBe(money0 + reward);
    expect(s.pendingMissions).toEqual(["d_tweet3"]);
    expect(s.missions.daily[0].claimed).toBe(true);

    // 이미 완료된 미션은 더 진행·재지급되지 않는다
    recordMission(s, "tweet", 5);
    expect(s.money).toBe(money0 + reward);
    expect(s.pendingMissions).toEqual(["d_tweet3"]);
  });
});
