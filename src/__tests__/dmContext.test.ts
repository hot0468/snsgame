import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { getActiveAccount } from "@/core/state";
import type { DMThread, GameState } from "@/core/types";
import { PARTNER_REPLIES_BY_CTX, REPLY_LINES_BY_CTX } from "@/data/dmContent";
import { replyDM, sendCustomDM } from "@/systems/dm";

/**
 * DM 답장은 스레드 맥락에 맞아야 한다.
 * 예전엔 어떤 스레드든 첫인사 풀에서만 뽑아서, 성기 사진을 받고 "반가워요! 뭐든 물어봐주세요"라고
 * 답하는 대화가 나왔다. 맥락 판정(dmContext)이 다시 무너지면 여기서 걸린다.
 */

function threadOn(s: GameState, extra: Partial<DMThread>): DMThread {
  const thread: DMThread = {
    id: "dm-test",
    partnerName: "테스트",
    partnerHandle: "tester",
    attribute: "daily",
    isAdult: false,
    messages: [{ id: "m0", from: "partner", text: "안녕하세요!", day: s.day }],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    ...extra,
  };
  getActiveAccount(s).dms.unshift(thread);
  return thread;
}

describe("DM 답장 맥락", () => {
  it("성기 사진 스레드의 첫 답장은 사진 맥락 풀에서 나온다", () => {
    const s = createInitialState();
    const t = threadOn(s, { isAdult: true, genitalSize: "average" });
    const { partnerText } = replyDM(s, t, "cool");

    const myText = t.messages.find((m) => m.from === "me")?.text ?? "";
    expect(REPLY_LINES_BY_CTX.photo.cool).toContain(myText);
    expect(PARTNER_REPLIES_BY_CTX.photo.cool).toContain(partnerText);
    // 첫인사 풀이 섞여 들어오면 안 된다
    expect(REPLY_LINES_BY_CTX.greet.cool).not.toContain(myText);
  });

  it("제안형 스레드(티켓 등)의 첫 답장은 제안 맥락 풀에서 나온다", () => {
    const s = createInitialState();
    const t = threadOn(s, { ticketKind: "concert" });
    const { partnerText } = replyDM(s, t, "cool");

    const myText = t.messages.find((m) => m.from === "me")?.text ?? "";
    expect(REPLY_LINES_BY_CTX.offer.cool).toContain(myText);
    expect(PARTNER_REPLIES_BY_CTX.offer.cool).toContain(partnerText);
  });

  it("일반 팬 스레드의 첫 답장은 첫인사 풀, 두 번째부터는 이어가기 풀", () => {
    const s = createInitialState();
    const t = threadOn(s, { fan: true });

    replyDM(s, t, "cool");
    const first = t.messages.find((m) => m.from === "me")?.text ?? "";
    expect(REPLY_LINES_BY_CTX.greet.cool).toContain(first);

    replyDM(s, t, "cool");
    const second = t.messages.filter((m) => m.from === "me")[1]?.text ?? "";
    expect(REPLY_LINES_BY_CTX.followup.cool).toContain(second);
    expect(REPLY_LINES_BY_CTX.greet.cool).not.toContain(second);
  });

  it("직접 입력 답장도 맥락에 맞는 반응을 받는다", () => {
    const s = createInitialState();
    const t = threadOn(s, { isAdult: true, genitalSize: "big" });
    sendCustomDM(s, t, "음 이건 좀...");

    // [0]=상대 오프닝, [1]=내 입력, [2]=상대 반응. 그 뒤엔 만남 제안이 붙을 수 있어 인덱스로 집는다.
    const reply = t.messages[2].text;
    expect(PARTNER_REPLIES_BY_CTX.photo.friendly).toContain(reply);
  });
});
