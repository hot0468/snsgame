import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { EBS_LECTURES } from "@/data/ebs";
import { ATTRIBUTES } from "@/data/attributes";
import { watchLecture, LECTURE_COST } from "@/systems/ebs";

/**
 * EBS 강의 수강 → 트윗 속성 해금(도서 감상·너튜브 시청과 같은 결).
 * 해금은 반드시 unlockAttribute를 거쳐야 한다 — 직접 push하면 계정 간 공유와
 * 해금 기준선(attributeUnlock.ts)이 조용히 깨진다.
 */

const IT_LECTURE = EBS_LECTURES.find((l) => l.id === "lec_python")!;

function ready() {
  const s = createInitialState();
  s.money = LECTURE_COST * 10;
  s.resources.action = 100;
  // '오늘의 무료 강의' 여부에 결과가 흔들리지 않게 무료 수강은 소진시켜 둔다.
  s.ebsFreeWatchedDay = s.day;
  return s;
}

describe("EBS 강의 트윗 속성 해금", () => {
  it("파이썬 강의를 수강하면 IT 트윗이 열린다", () => {
    const s = ready();
    expect(getActiveAccount(s).unlockedAttributes).not.toContain("it");

    const res = watchLecture(s, IT_LECTURE);

    expect(res.ok).toBe(true);
    expect(res.unlockedAttr).toBe("it");
    expect(getActiveAccount(s).unlockedAttributes).toContain("it");
  });

  it("해금은 전 계정이 공유하고, 재수강해도 다시 알리지 않는다", () => {
    const s = ready();
    watchLecture(s, IT_LECTURE);
    for (const acc of s.accounts) expect(acc.unlockedAttributes).toContain("it");

    // 두 번째 수강은 스탯만 오르고 해금 알림은 없어야 한다(멱등).
    const again = watchLecture(s, IT_LECTURE);
    expect(again.ok).toBe(true);
    expect(again.unlockedAttr).toBeUndefined();
  });

  it("수강 실패(잔고 부족)면 해금도 일어나지 않는다", () => {
    const s = ready();
    s.money = 0;

    const res = watchLecture(s, IT_LECTURE);

    expect(res.ok).toBe(false);
    expect(getActiveAccount(s).unlockedAttributes).not.toContain("it");
  });

  it("unlockAttr이 없는 강의는 아무 속성도 열지 않는다", () => {
    const s = ready();
    const plain = EBS_LECTURES.find((l) => l.unlockAttr == null && l.stat !== "performance")!;
    const before = [...getActiveAccount(s).unlockedAttributes];

    const res = watchLecture(s, plain);

    expect(res.ok).toBe(true);
    expect(res.unlockedAttr).toBeUndefined();
    expect(getActiveAccount(s).unlockedAttributes).toEqual(before);
  });

  it("선언된 unlockAttr은 전부 실재하는 속성이다", () => {
    for (const lec of EBS_LECTURES) {
      if (lec.unlockAttr) expect(ATTRIBUTES[lec.unlockAttr], lec.id).toBeDefined();
    }
  });
});
