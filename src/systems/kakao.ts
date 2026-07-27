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
  opts: { hue?: number; reply?: KakaoThread["reply"] } = {},
): KakaoThread {
  const thread: KakaoThread = {
    id: uid("kko"),
    sender,
    hue: opts.hue,
    messages: texts.map((text) => ({ id: uid("kkom"), from: "them", text, day: state.day })),
    unread: true,
    toastPending: true,
    reply: opts.reply,
  };
  state.kakao.push(thread);
  trimKakao(state);
  return thread;
}

/**
 * 카톡 보관 상한. schedule·timeline과 같은 이유의 누적 절벽 방어다
 * (상한이 없을 때 250일 플레이 기준 250스레드·40KB까지 자랐다).
 */
export const KAKAO_MAX = 60;

/**
 * 상한을 넘으면 **오래된 것부터** 잘라낸다.
 *
 * ⚠️ **안 읽은(unread) 스레드와 토스트 대기(toastPending) 중인 스레드는 지우지 않는다.**
 *    플레이어가 아직 보지 못한 알림을 조용히 날리면 월세 독촉·이벤트 제안 같은 게
 *    통째로 사라져 진행이 막힌다. 읽은 것부터 오래된 순으로만 지운다.
 *    (전부 미읽음이면 상한을 넘겨서라도 남긴다 — 유실보다 낫다.)
 */
function trimKakao(state: GameState): void {
  let over = state.kakao.length - KAKAO_MAX;
  if (over <= 0) return;
  state.kakao = state.kakao.filter((t) => {
    if (over > 0 && !t.unread && !t.toastPending) {
      over--;
      return false;
    }
    return true;
  });
}

/** 안 읽은 카톡 수 */
export function unreadKakaoCount(state: GameState): number {
  return state.kakao.filter((t) => t.unread).length;
}

/** 집주인 이름 */
export const LANDLORD_NAME = "집주인 아저씨";

/** 답장이 필요 없는 알림성 발신자(통보·연출 카톡) — 카톡창에서 답장 버튼을 띄우지 않는다. */
export const NO_REPLY_SENDERS = ["X 정산", "급여 입금", "원고료 입금", "내면의 목소리", "안전안내문자"];

/** 반말로 답하는 친구 발신자(집주인 등 공식 발신자는 존댓말 유지). */
export const FRIENDLY_SENDERS = ["타임라인 친구"];

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
  // 미납 누적(streak)이 깊어질수록 독촉도, 그에 대한 내 답장도 절박해진다.
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
  const reply =
    streak >= 3
      ? {
          me: "죄송합니다… 방은 꼭 지키게 해주세요. 무슨 수를 써서라도 마련할게요 🙏🙏",
          them: "…다음 달이 정말 마지막이에요. 더는 못 기다려요.",
          label: "싹싹 빈다",
        }
      : streak >= 2
        ? {
            me: "정말 죄송해요… 사정이 좀 생겨서요. 이번 주 안에 꼭 넣겠습니다 🙏",
            them: "이번엔 진짜 부탁해요. 나도 형편이 빠듯해서 그래요.",
            label: "사정을 말한다",
          }
        : {
            me: "아 맞다, 깜빡했어요 😅 곧 넣을게요!",
            them: "그래요~ 믿을게요 👍",
            label: "곧 낸다고 답한다",
          };
  pushKakao(state, LANDLORD_NAME, lines, { hue: 15, reply });
}
