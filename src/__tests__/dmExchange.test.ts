import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import type { DMThread, GameState } from "@/core/types";
import { DM_EXCHANGES, DM_TOPICS, type DMContext, type DMTone } from "@/data/dmContent";
import { dmReplyOptions, replyDM } from "@/systems/dm";

/**
 * DM 답장 짝(DMExchange) 회귀 테스트.
 * - 화면에 보인 문장이 그대로 전송되고, 그 문장에 짝지어진 상대 대답이 따라온다.
 * - 후보는 재렌더에 흔들리지 않는다(고정 해시). 답장하면 다음 후보가 새로 뽑힌다.
 */

const CTXS: DMContext[] = ["greet", "photo", "offer", "followup"];
const TONES: DMTone[] = ["friendly", "cool", "bold"];

function makeThread(state: GameState): DMThread {
  const thread: DMThread = {
    id: "dm_test",
    partnerName: "테스트팬",
    partnerHandle: "test_fan",
    attribute: "daily",
    isAdult: false,
    messages: [{ id: "m1", from: "partner", text: "안녕하세요!", day: state.day }],
    unread: true,
  };
  getActiveAccount(state).dms.push(thread);
  return thread;
}

describe("DM_EXCHANGES 데이터", () => {
  it("모든 맥락·톤에 짝이 있고, 어느 쪽도 빈 문자열이 아니다", () => {
    for (const c of CTXS) {
      for (const t of TONES) {
        const pool = DM_EXCHANGES[c][t];
        expect(pool.length, `${c}.${t} 비어 있음`).toBeGreaterThan(0);
        for (const e of pool) {
          expect(e.me.trim(), `${c}.${t} me 비어 있음`).not.toBe("");
          expect(e.partner.trim(), `${c}.${t} partner 비어 있음`).not.toBe("");
        }
      }
    }
  });

  it("내 문장이 중복되지 않는다(같은 버튼 두 개가 뜨면 고를 이유가 없다)", () => {
    for (const c of CTXS) {
      for (const t of TONES) {
        const mes = DM_EXCHANGES[c][t].map((e) => e.me);
        expect(new Set(mes).size, `${c}.${t} me 중복`).toBe(mes.length);
      }
    }
  });
});

describe("dmReplyOptions", () => {
  it("같은 스레드 상태면 몇 번을 불러도 같은 문장이 나온다(재렌더 안정성)", () => {
    const s = createInitialState();
    const thread = makeThread(s);
    const a = dmReplyOptions(s, thread).map((o) => o.me);
    const b = dmReplyOptions(s, thread).map((o) => o.me);
    const c = dmReplyOptions(s, thread).map((o) => o.me);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(a.length).toBeGreaterThanOrEqual(2);
  });

  it("답장하면 다음 후보 묶음이 새로 뽑힌다", () => {
    const s = createInitialState();
    const thread = makeThread(s);
    const before = dmReplyOptions(s, thread).map((o) => o.me);
    replyDM(s, thread, "friendly");
    const after = dmReplyOptions(s, thread).map((o) => o.me);
    // 맥락도 greet→followup으로 넘어가므로 문장이 겹칠 수 없다.
    expect(after).not.toEqual(before);
  });

  it("대담 톤은 성인물 해제(adultMode) 전에는 후보에 없다", () => {
    const s = createInitialState();
    const thread = makeThread(s);
    expect(dmReplyOptions(s, thread).some((o) => o.tone === "bold")).toBe(false);
    s.adultMode = true;
    expect(dmReplyOptions(s, thread).some((o) => o.tone === "bold")).toBe(true);
  });
});

describe("화제(DMTopic) — 직전 상대 말과 내 말이 맞물린다", () => {
  it("답장하면 상대가 화제를 던지고, 다음 선택지는 그 화제의 대답이다", () => {
    const s = createInitialState();
    const thread = makeThread(s);

    // cool 톤은 만남 제안(positive 전용)이 안 붙어 화제 흐름이 끊기지 않는다.
    replyDM(s, thread, "cool");
    const topicId = thread.dmTopic;
    expect(topicId, "답장 뒤엔 화제가 붙어 있어야 한다").toBeTruthy();

    const topic = DM_TOPICS.find((t) => t.id === topicId)!;
    // 상대의 마지막 말이 그 화제를 던지는 메시지다.
    const lastPartner = thread.messages[thread.messages.length - 1];
    expect(lastPartner.from).toBe("partner");
    expect(lastPartner.text).toBe(topic.prompt);

    // 다음 선택지는 전부 그 화제의 대답 풀에서 나온다.
    for (const opt of dmReplyOptions(s, thread)) {
      expect(
        topic.replies[opt.tone].some((e) => e.me === opt.me && e.partner === opt.partner),
        `${topic.id}.${opt.tone} 밖의 문장이 후보로 나왔다: ${opt.me}`,
      ).toBe(true);
    }
  });

  it("같은 화제가 연달아 나오지 않는다", () => {
    const s = createInitialState();
    const thread = makeThread(s);
    let prev: string | undefined;
    for (let i = 0; i < 6; i++) {
      replyDM(s, thread, "cool");
      if (thread.wantsToMeet) break; // 만남 제안이 뜨면 화제 흐름이 끊긴다(의도된 동작)
      expect(thread.dmTopic).not.toBe(prev);
      prev = thread.dmTopic;
    }
  });

  it("모든 화제가 3톤 모두에 대답을 갖고 있다", () => {
    for (const t of DM_TOPICS) {
      expect(t.prompt.trim(), `${t.id} prompt 비어 있음`).not.toBe("");
      for (const tone of TONES) {
        expect(t.replies[tone].length, `${t.id}.${tone} 대답 없음`).toBeGreaterThan(0);
      }
    }
  });
});

describe("replyDM", () => {
  it("화면에 보인 문장이 그대로 전송되고, 짝지어진 대답이 따라온다", () => {
    const s = createInitialState();
    const thread = makeThread(s);
    const shown = dmReplyOptions(s, thread).find((o) => o.tone === "cool")!;

    const res = replyDM(s, thread, "cool");
    // [0]=상대 오프닝, [1]=내 답장, [2]=그 답장에 대한 대답, [3]=상대가 던지는 새 화제
    const sent = thread.messages[1];
    const reply = thread.messages[2];

    expect(sent.from).toBe("me");
    expect(sent.text).toBe(shown.me); // 누른 문장 그대로
    expect(reply.from).toBe("partner");
    expect(reply.text).toBe(shown.partner); // 그 문장에 딸린 대답
    expect(res.partnerText).toBe(shown.partner);
  });
});
