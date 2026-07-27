import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { pushKakao, KAKAO_MAX, unreadKakaoCount } from "@/systems/kakao";

/**
 * 카톡 누적 상한 회귀 테스트.
 *
 * 왜 필요한가: 상한이 없어 250일 플레이 기준 250스레드·40KB까지 자랐다(schedule과 같은 누적 절벽).
 *
 * ⚠️ 가장 중요한 불변식은 **안 읽은 알림을 잘라내지 않는 것**이다. 월세 독촉·이벤트 제안이
 *    조용히 사라지면 플레이어가 진행을 놓치고, 그건 용량 절약보다 훨씬 큰 손해다.
 */
describe("카톡 누적 상한", () => {
  const readThread = (s: ReturnType<typeof createInitialState>, name: string) => {
    const t = pushKakao(s, name, ["읽은 메시지"], {});
    t.unread = false;
    t.toastPending = false;
    return t;
  };

  it("읽은 스레드는 상한까지만 남는다", () => {
    const s = createInitialState();
    for (let i = 0; i < KAKAO_MAX * 3; i++) readThread(s, `상대${i}`);
    expect(s.kakao.length).toBe(KAKAO_MAX);
  });

  it("안 읽은 스레드는 상한을 넘겨도 절대 지우지 않는다", () => {
    const s = createInitialState();
    for (let i = 0; i < KAKAO_MAX * 2; i++) pushKakao(s, `집주인${i}`, ["월세 내라"], {});
    // 전부 미읽음 → 하나도 유실되면 안 된다.
    expect(s.kakao.length).toBe(KAKAO_MAX * 2);
    expect(unreadKakaoCount(s)).toBe(KAKAO_MAX * 2);
  });

  it("미읽음이 섞여 있으면 읽은 것만 골라 지운다", () => {
    const s = createInitialState();
    // 안 읽은 중요 알림을 먼저 넣고(가장 오래된 위치), 읽은 걸 잔뜩 쌓는다.
    const important = pushKakao(s, "집주인", ["월세 밀렸다"], {});
    for (let i = 0; i < KAKAO_MAX * 2; i++) readThread(s, `상대${i}`);
    // 가장 오래됐지만 미읽음이라 살아 있어야 한다.
    expect(s.kakao.some((t) => t.id === important.id)).toBe(true);
    expect(unreadKakaoCount(s)).toBe(1);
  });

  it("토스트 대기 중인 스레드도 지우지 않는다(아직 화면에 안 뜬 알림)", () => {
    const s = createInitialState();
    const pending = pushKakao(s, "이벤트", ["제안이 왔다"], {});
    pending.unread = false; // 읽음 처리됐지만 토스트는 아직 대기
    pending.toastPending = true;
    for (let i = 0; i < KAKAO_MAX * 2; i++) readThread(s, `상대${i}`);
    expect(s.kakao.some((t) => t.id === pending.id)).toBe(true);
  });

  it("상한 이하에서는 아무것도 지우지 않는다", () => {
    const s = createInitialState();
    for (let i = 0; i < 5; i++) readThread(s, `상대${i}`);
    expect(s.kakao.length).toBe(5);
  });
});
