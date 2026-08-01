import { describe, it, expect } from "vitest";
import { createInitialState, EMAIL_MAX, pushEmail } from "@/core/state";
import type { Email, GameState } from "@/core/types";

/**
 * 수신함 누적 상한 회귀 테스트.
 *
 * 지키는 것:
 *  1) 메일이 무한히 쌓이지 않는다(오래된 것부터 잘린다).
 *  2) **응답 대기 중인 오퍼 메일은 안 잘린다** — 잘리면 합격 통보를 받고도 출근할 방법이
 *     사라져 진행이 막힌다. 이게 그냥 `slice(0, MAX)`를 쓰지 않는 이유다.
 *
 * 왜 필요한가: 메일은 13곳에서 각자 unshift하는데 자르는 곳이 한 군데도 없었다.
 * 누군가 `state.emails.unshift`로 되돌리면 typecheck는 조용히 통과한다 — 그걸 막는 장치다.
 */

const mail = (id: string, extra: Partial<Email> = {}): Email => ({
  id,
  from: "보낸이",
  subject: `제목 ${id}`,
  body: "본문",
  day: 1,
  read: false,
  ...extra,
});

/** n통을 순서대로(오래된 것 먼저) 넣는다. */
function fill(s: GameState, n: number, from = 0): void {
  for (let i = from; i < from + n; i++) pushEmail(s, mail(`m${i}`));
}

describe("수신함 상한", () => {
  it("상한을 넘겨도 그 이상 쌓이지 않는다", () => {
    const s = createInitialState();
    fill(s, EMAIL_MAX + 50);
    expect(s.emails.length).toBe(EMAIL_MAX);
  });

  it("잘리는 건 가장 오래된 것이고 최신은 남는다", () => {
    const s = createInitialState();
    fill(s, EMAIL_MAX + 10);
    // 마지막에 넣은 게 맨 앞이다.
    expect(s.emails[0].id).toBe(`m${EMAIL_MAX + 9}`);
    // 처음 10통은 밀려났다.
    expect(s.emails.some((m) => m.id === "m0")).toBe(false);
    expect(s.emails.some((m) => m.id === "m9")).toBe(false);
    expect(s.emails.some((m) => m.id === "m10")).toBe(true);
  });

  it("응답 대기 중인 오퍼 메일은 아무리 오래돼도 안 잘린다", () => {
    const s = createInitialState();
    pushEmail(s, mail("job", { jobOffer: { company: "회사", tier: "small", role: "역할" } }));
    pushEmail(s, mail("lec", { lecturerOffer: true }));
    pushEmail(s, mail("auc", { auctionLink: true }));
    fill(s, EMAIL_MAX + 50, 1000);
    const ids = s.emails.map((m) => m.id);
    expect(ids, "취업 합격 메일").toContain("job");
    expect(ids, "강사 합격 메일").toContain("lec");
    expect(ids, "경매 초대장").toContain("auc");
  });

  it("보호 메일이 많으면 상한을 넘긴 채 유지된다 — 진행을 막느니 더 들고 있는다", () => {
    const s = createInitialState();
    for (let i = 0; i < EMAIL_MAX + 20; i++) pushEmail(s, mail(`o${i}`, { lecturerOffer: true }));
    expect(s.emails.length).toBe(EMAIL_MAX + 20);
  });

  it("응답을 마쳐 오퍼 표식이 지워지면 평범한 메일처럼 잘린다", () => {
    const s = createInitialState();
    pushEmail(s, mail("lec", { lecturerOffer: true }));
    // systems가 응답 처리 시 표식을 지운다(acceptLecturerOffer·declineLecturerOffer).
    delete s.emails[0].lecturerOffer;
    fill(s, EMAIL_MAX + 50, 2000);
    expect(s.emails.some((m) => m.id === "lec")).toBe(false);
    expect(s.emails.length).toBe(EMAIL_MAX);
  });
});
