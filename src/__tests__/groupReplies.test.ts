import { describe, it, expect } from "vitest";
import {
  CHARACTER_GROUPS,
  FIXED_AUTHOR_HANDLES,
  TWEET_REPLIES,
  linesForHandle,
  profileFromAuthor,
} from "@/data/accounts";

/** 문구 → 그 문구를 쓰는 고정 계정 핸들. 키가 오타면 여기서 안 잡힌다. */
const OWNER_OF = new Map<string, string>();
for (const handle of FIXED_AUTHOR_HANDLES) {
  for (const line of linesForHandle(handle) ?? []) OWNER_OF.set(line, handle);
}

describe("트윗에 귀속된 같은 갈래 답글", () => {
  it("모든 키는 실제 고정 계정 문구다(고아 키 금지)", () => {
    // 트윗 문구를 고치면 키도 같이 고쳐야 한다 — 안 고치면 그 답글은 영영 안 붙는다.
    const orphans = Object.keys(TWEET_REPLIES).filter((k) => !OWNER_OF.has(k));
    expect(orphans).toEqual([]);
  });

  it("답글 작성자는 같은 갈래의 다른 계정이다", () => {
    for (const [key, replies] of Object.entries(TWEET_REPLIES)) {
      const owner = OWNER_OF.get(key)!;
      const group = CHARACTER_GROUPS.find((g) => g.includes(owner));
      expect(group, `${owner}가 어느 갈래에도 없다`).toBeTruthy();
      for (const r of replies) {
        expect(group).toContain(r.by);
        expect(r.by).not.toBe(owner); // 자기 트윗에 자기가 답글 달지 않는다
      }
    }
  });

  it("고정 계정 트윗엔 표에 적힌 답글이 그대로 붙는다", () => {
    const prof = profileFromAuthor("실을 다루는 사람", "silk_strings", "beauty", false, 30);
    for (const t of prof.timeline) {
      const expected = TWEET_REPLIES[t.text] ?? [];
      expect((t.replies ?? []).map((r) => r.text)).toEqual(expected.map((r) => r.text));
    }
  });
});
