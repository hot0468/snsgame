import type { GameState, KakaoThread } from "@/core/types";
import { uid } from "@/utils/random";

/**
 * 카카오톡 시스템 — 이벤트/알림을 우측 하단 토스트로 띄우고, 클릭하면 메시지창이 열린다.
 * 순수 로직만 두어(시간 시스템에 비의존) time.ts 등에서 자유롭게 호출한다.
 */

/**
 * 새 카톡을 수신함에 추가한다(토스트 알림 대기 상태).
 * @param sender 발신자 이름
 * @param texts  상대가 보낸 메시지 줄들(위→아래 순서)
 */
export function pushKakao(
  state: GameState,
  sender: string,
  texts: string[],
  opts: { hue?: number } = {},
): KakaoThread {
  const thread: KakaoThread = {
    id: uid("kko"),
    sender,
    hue: opts.hue,
    messages: texts.map((text) => ({ id: uid("kkom"), from: "them", text, day: state.day })),
    unread: true,
    toastPending: true,
  };
  state.kakao.push(thread);
  return thread;
}

/** 안 읽은 카톡 수 */
export function unreadKakaoCount(state: GameState): number {
  return state.kakao.filter((t) => t.unread).length;
}

/** 집주인 이름 */
export const LANDLORD_NAME = "집주인 아저씨";

/** 월세 납부 하루 전, 집주인이 보내는 리마인더 카톡 */
export function sendLandlordRentReminder(state: GameState): void {
  pushKakao(
    state,
    LANDLORD_NAME,
    [
      "학생~ 잘 지내지?",
      "내일 월세 입금하는 날인 거 알지? 믿고 있어. 😊",
      "요즘 나도 사정이 빠듯해서... 늦지 않게 부탁해요~",
    ],
    { hue: 45 },
  );
}

/** 월급날, 급여가 입금됐다는 은행 알림 카톡 */
export function sendSalaryKakao(state: GameState, company: string, amount: number): void {
  pushKakao(
    state,
    "급여 입금",
    [
      `[급여] ${company}`,
      `월급 ${amount.toLocaleString("ko-KR")}원이 입금되었습니다. 💰`,
      "이번 달도 수고 많으셨어요!",
    ],
    { hue: 210 },
  );
}

/** 매월 1일, 트위터(X) 수익이 정산·입금됐다는 알림 카톡 */
export function sendTwitterSettlementKakao(state: GameState, income: number, subs: number): void {
  const total = income + subs;
  const lines = ["[X 정산] 이번 달 트위터 수익이 입금되었어요."];
  lines.push(`팔로워 수익 ${income.toLocaleString("ko-KR")}원`);
  if (subs > 0) lines.push(`유료 구독 수익 ${subs.toLocaleString("ko-KR")}원`);
  lines.push(`총 ${total.toLocaleString("ko-KR")}원 💰`);
  pushKakao(state, "X 정산", lines, { hue: 200 });
}

/** 월세를 못 냈을 때, 미납 횟수에 따라 수위가 오르는 집주인 독촉 카톡 */
export function sendLandlordOverdue(state: GameState, streak: number): void {
  const lines =
    streak >= 2
      ? [
          "학생, 이게 벌써 몇 번째야?!",
          `월세가 ${streak}달째 밀렸어. 다음 달까지 안 내면 정말 방 빼야 해.`,
          "이번이 마지막 경고야. 나도 더는 못 봐줘.",
        ]
      : [
          "어이~ 이번 달 월세가 안 들어왔네?",
          "깜빡한 거지? 얼른 넣어줘요. 밀리면 서로 곤란해져~",
        ];
  pushKakao(state, LANDLORD_NAME, lines, { hue: 15 });
}
