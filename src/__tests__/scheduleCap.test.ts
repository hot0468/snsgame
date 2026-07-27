import { describe, it, expect } from "vitest";
import { createInitialState, appendSchedule, SCHEDULE_MAX } from "@/core/state";
import { addSchedule } from "@/systems/time";

/**
 * 활동 기록(schedule) 누적 상한 회귀 테스트.
 *
 * 왜 필요한가: schedule은 12개 모듈이 각자 push하는데(순환 import를 피해 addSchedule을 모듈마다 복제)
 * 상한이 없어 250일 플레이 기준 **750건·49KB로 세이브의 84%**를 차지했다. 게다가 이 배열을
 * 읽는 곳이 없어 전부 죽은 용량이었다. `pushTimeline`과 같은 이유의 누적 절벽이다.
 *
 * 지키는 것: 상한 유지 + **오래된 것부터** 잘라내기(최신 기록이 살아남아야 로그로서 의미가 있다).
 */
describe("schedule 누적 상한", () => {
  it("상한을 넘겨도 SCHEDULE_MAX를 유지한다", () => {
    const s = createInitialState();
    for (let i = 0; i < SCHEDULE_MAX * 3; i++) {
      appendSchedule(s, { id: `sch_${i}`, day: i, title: `기록 ${i}`, kind: "offline" });
    }
    expect(s.schedule.length).toBe(SCHEDULE_MAX);
  });

  it("오래된 것부터 잘라내고 최신 기록을 남긴다", () => {
    const s = createInitialState();
    const total = SCHEDULE_MAX + 50;
    for (let i = 0; i < total; i++) {
      appendSchedule(s, { id: `sch_${i}`, day: i, title: `기록 ${i}`, kind: "offline" });
    }
    // 마지막 기록이 살아 있고, 잘려나간 건 가장 오래된 쪽이어야 한다.
    expect(s.schedule[s.schedule.length - 1].id).toBe(`sch_${total - 1}`);
    expect(s.schedule[0].id).toBe(`sch_${total - SCHEDULE_MAX}`);
    expect(s.schedule.some((e) => e.id === "sch_0")).toBe(false);
  });

  it("systems의 addSchedule 경로도 상한을 탄다(모듈 복제본이 관문을 우회하지 않는다)", () => {
    // 회귀: 각 모듈이 addSchedule을 복제하고 있어 한 곳에만 상한을 걸면 무효가 된다.
    const s = createInitialState();
    for (let i = 0; i < SCHEDULE_MAX * 2; i++) addSchedule(s, `활동 ${i}`, "offline");
    expect(s.schedule.length).toBe(SCHEDULE_MAX);
  });

  it("상한 이하에서는 아무것도 잘라내지 않는다", () => {
    const s = createInitialState();
    for (let i = 0; i < 10; i++) {
      appendSchedule(s, { id: `sch_${i}`, day: i, title: `기록 ${i}`, kind: "offline" });
    }
    expect(s.schedule.length).toBe(10);
    expect(s.schedule[0].id).toBe("sch_0");
  });
});
