import { describe, it, expect } from "vitest";
import { FIXED_AUTHOR_HANDLES, linesForHandle } from "@/data/accounts";

/**
 * 전용 문구 계정(자전거부·소문 저자)의 문구 개수 하한.
 * 풀이 얇으면 같은 계정 트윗이 몇 번만 봐도 반복돼 캐릭터가 봇처럼 보인다.
 */
const MIN_LINES = 30;

describe("고정 캐릭터 계정 문구 풀", () => {
  it("계정마다 30개 이상, 중복 없음", () => {
    expect(FIXED_AUTHOR_HANDLES.length).toBeGreaterThan(0);
    for (const handle of FIXED_AUTHOR_HANDLES) {
      const lines = linesForHandle(handle)!;
      expect(lines.length, handle).toBeGreaterThanOrEqual(MIN_LINES);
      expect(new Set(lines).size, `${handle} 중복 문구`).toBe(lines.length);
    }
  });
});
