import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { DSTORY_POSTS, HOSTS_LINES, HOSTS_PW, IPCONFIG_LINES, LOCAL_IPV4 } from "@/data/dstory";
import { DSTORY_IT_GAIN, isDstoryDone, tryUnlockDstoryPost } from "@/systems/dstory";

/**
 * d스토리 비밀번호 퍼즐 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 * 1. **정답 소스 일치** — 정답은 게임 안 다른 화면이 출력한다. 그 화면과 게시글이 어긋나면
 *    퍼즐이 **풀 수 없게 되는데, typecheck도 build도 이걸 잡지 못한다.** 조용히 죽는다.
 * 2. **보상 중복 수령 방지** — 같은 글을 두 번 풀어도 IT는 한 번만 오른다.
 */

/** 글1 = F12(개발자 도구 Console), 글2 = IPv4(cmd ipconfig), 글3 = hosts(메모장) */
const [post1, post2, post3] = DSTORY_POSTS;

describe("tryUnlockDstoryPost", () => {
  it("정답이면 true — 목록에 id가 추가되고 IT가 +80 된다", () => {
    const s = createInitialState();
    expect(tryUnlockDstoryPost(s, post1.id, post1.password)).toBe(true);
    expect(s.dstoryUnlockedPosts).toContain(post1.id);
    expect(s.skills.it).toBe(DSTORY_IT_GAIN);
  });

  it("오답이면 false — 상태가 전혀 바뀌지 않는다", () => {
    const s = createInitialState();
    expect(tryUnlockDstoryPost(s, post1.id, "틀린비번")).toBe(false);
    expect(s.dstoryUnlockedPosts).toEqual([]);
    expect(s.skills.it).toBe(0);
  });

  it("같은 글을 두 번 풀어도 IT는 두 번 오르지 않는다 (중복 수령 방지)", () => {
    const s = createInitialState();
    tryUnlockDstoryPost(s, post1.id, post1.password);
    // 이미 푼 글은 잠김 화면으로 되돌아가지 않아야 하므로 true를 유지한다.
    expect(tryUnlockDstoryPost(s, post1.id, post1.password)).toBe(true);
    expect(s.skills.it).toBe(DSTORY_IT_GAIN);
    expect(s.dstoryUnlockedPosts).toEqual([post1.id]);
  });

  it("글1 정답은 대소문자·앞뒤 공백을 관대하게 받는다", () => {
    const s = createInitialState();
    const sloppy = `  ${post1.password.toUpperCase()} `;
    expect(tryUnlockDstoryPost(s, post1.id, sloppy)).toBe(true);
    expect(s.skills.it).toBe(DSTORY_IT_GAIN);
  });

  it("IT 보상은 스킬 스케일(999)에서 클램프된다 — 100에서 막히면 안 된다", () => {
    const s = createInitialState();
    s.skills.it = 990;
    tryUnlockDstoryPost(s, post1.id, post1.password);
    expect(s.skills.it).toBe(999);
  });

  it("없는 글 id는 false — 상태 무변화", () => {
    const s = createInitialState();
    expect(tryUnlockDstoryPost(s, "없는_글", "아무거나")).toBe(false);
    expect(s.dstoryUnlockedPosts).toEqual([]);
  });
});

describe("정답 소스 일치 — 게시글과 그 정답을 출력하는 화면이 어긋나면 퍼즐이 죽는다", () => {
  it("LOCAL_IPV4가 cmd ipconfig 출력에 실제로 포함된다", () => {
    expect(IPCONFIG_LINES.join("\n")).toContain(LOCAL_IPV4);
  });

  it("글2의 정답은 cmd ipconfig 출력에서 읽어낼 수 있다", () => {
    expect(IPCONFIG_LINES.join("\n")).toContain(post2.password);
  });

  it("글3의 정답(HOSTS_PW)이 메모장 hosts 파일 내용에 실제로 포함된다", () => {
    expect(HOSTS_LINES.join("\n")).toContain(HOSTS_PW);
  });

  it("글3의 정답은 hosts 파일에서 읽어낼 수 있다", () => {
    expect(HOSTS_LINES.join("\n")).toContain(post3.password);
  });

  it("게시글 정답에 빈 문자열이 없다 (빈 비번은 아무 입력이나 통과시킨다)", () => {
    for (const p of DSTORY_POSTS) expect(p.password.trim().length).toBeGreaterThan(0);
  });
});

describe("isDstoryDone", () => {
  it("아무것도 안 풀었으면 false", () => {
    expect(isDstoryDone(createInitialState())).toBe(false);
  });

  it("한 글만 풀었으면 아직 false — 링크 트윗이 계속 스폰돼야 한다", () => {
    const s = createInitialState();
    tryUnlockDstoryPost(s, post1.id, post1.password);
    expect(isDstoryDone(s)).toBe(false);
  });

  it("세 글을 다 풀었을 때만 true", () => {
    const s = createInitialState();
    for (const p of DSTORY_POSTS) tryUnlockDstoryPost(s, p.id, p.password);
    expect(isDstoryDone(s)).toBe(true);
  });
});
