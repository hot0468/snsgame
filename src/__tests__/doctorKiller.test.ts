import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { getActiveAccount } from "@/core/state";
import type { GameState } from "@/core/types";
import { acceptKillerJob, declineKillerJob, requestAppointment } from "@/systems/killer";

/**
 * 킬러 일의 전연령 진입로(병원 진료예약 → 의사 DM).
 *
 * 지키는 것 두 가지:
 *  1) momo 경로와 **같은 킬러 상태**를 켠다(별도 시스템이 아니라 다른 문일 뿐).
 *  2) 의사는 끝까지 존댓말·수술 은유만 쓴다 — 여기서 반말이나 '청부/살인'이 새면
 *     전연령 진입로라는 존재 이유가 사라진다.
 */

const DOCTOR = "doctor";

function doctorThreadOf(s: GameState) {
  return getActiveAccount(s).dms.find((d) => d.partnerHandle === DOCTOR);
}

/** 의사 발화에 절대 나오면 안 되는 단어(직설 표현) */
const FORBIDDEN = ["청부", "살인", "죽여", "타겟", "지워"];

describe("전연령 킬러 진입로 — 의사", () => {
  it("진료예약하면 의사에게서 제의 DM이 오고 수락 버튼이 붙는다", () => {
    const s = createInitialState();
    requestAppointment(s);
    const t = doctorThreadOf(s);
    expect(t, "의사 스레드가 생겨야 한다").toBeTruthy();
    expect(t!.momoOffer, "수락/거절 버튼 플래그").toBe(true);
    expect(t!.unread).toBe(true);
    expect(t!.messages[0].text).toContain("참여하시겠습니까");
  });

  it("수락하면 momo 경로와 같은 killerJob이 켜지고 연락책이 의사로 남는다", () => {
    const s = createInitialState();
    requestAppointment(s);
    acceptKillerJob(s, doctorThreadOf(s)!.id);
    expect(s.killerJob?.active).toBe(true);
    expect(s.killerJob?.recruiter).toBe("doctor");
    expect(doctorThreadOf(s)!.momoOffer).toBe(false);
  });

  it("사양하면 킬러가 되지 않고, 다시 예약할 수 있다", () => {
    const s = createInitialState();
    requestAppointment(s);
    declineKillerJob(s, doctorThreadOf(s)!.id);
    expect(s.killerJob).toBeNull();
    requestAppointment(s);
    expect(doctorThreadOf(s)!.momoOffer).toBe(true);
  });

  it("이미 킬러면 제의가 아니라 안내만 온다", () => {
    const s = createInitialState();
    requestAppointment(s);
    acceptKillerJob(s, doctorThreadOf(s)!.id);
    requestAppointment(s);
    const t = doctorThreadOf(s)!;
    expect(t.momoOffer).toBe(false);
    expect(t.messages[t.messages.length - 1].text).toContain("다음 수술");
  });

  it("의사 발화는 전부 존댓말이고 직설 표현이 없다", () => {
    const s = createInitialState();
    requestAppointment(s);
    acceptKillerJob(s, doctorThreadOf(s)!.id);
    requestAppointment(s);
    const lines = doctorThreadOf(s)!
      .messages.filter((m) => m.from === "partner")
      .flatMap((m) => m.text.split("\n"))
      .map((l) => l.trim())
      .filter(Boolean);

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      for (const w of FORBIDDEN) {
        expect(line, `직설 표현 "${w}" 노출`).not.toContain(w);
      }
      // 문장이 끝나는 줄은 존댓말 어미로 끝나야 한다(반말 종결 금지).
      if (/[.?!]$/.test(line)) {
        expect(line, `반말 종결: ${line}`).toMatch(/(다|까|요|오|죠)[.?!]$/);
      }
    }
  });
});
