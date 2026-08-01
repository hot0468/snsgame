/**
 * 콜센터 상담원 콘텐츠 — 콜 상황과 급여·소모 상수.
 *
 * 규칙(누적 소모·수당 계산)은 `systems/callCenter.ts`가 소유한다.
 *
 * ⚠️ **이 직업의 축은 정신력이다.** 택시가 "1운행 = 1슬롯"이라면 콜센터는 한 번 앉으면
 *    콜을 계속 받을 수 있다. 대신 받을수록 정신력이 **가속으로** 깎인다 —
 *    "한 콜 더 받을까"가 이 직업의 유일한 결정이다.
 */

/** 콜센터 이름(패러디). */
export const CALL_COMPANY = "한소리고객센터";

/** 콜 1건 기본 수당. */
export const CALL_BASE_PAY = 9_000;

/**
 * 연속 콜 수당 가산 — n번째 콜은 `기본 × (1 + (n-1) × 이 값)`을 받는다.
 * 오래 앉아 있을수록 유리해야 '한 콜 더'가 유혹이 된다.
 */
export const CALL_STREAK_BONUS = 0.18;

/**
 * n번째 콜의 정신력 소모 = `CALL_MENTAL_BASE + (n-1) × CALL_MENTAL_ACCEL`.
 *
 * ⚠️ **가속이 이 직업의 제동장치다.** 가속이 없으면 정신력이 남는 한 무한히 받는 게
 *    지배 전략이 되고, 결정이 사라진다. 수당 가산(0.18)보다 체감이 커야 한다.
 */
export const CALL_MENTAL_BASE = 4;
export const CALL_MENTAL_ACCEL = 2.5;

/** 근무 1회(자리에 앉는 것) 행동력 소모 — `systems/offline.ts`의 활동 정의와 맞출 것. */
export const CALL_ACTION_COST = 10;

/**
 * 이 정신력 밑으로 떨어지면 더 받을 수 없다(강제 퇴근).
 * 0이 아니라 여유를 두는 건, 정신력 0으로 퇴근하면 우울 모드(MENTAL_LOW_THRESHOLD 20)에
 * 갇혀 다음 날이 통째로 망가지기 때문이다 — 벌 받는 게 아니라 갇히는 건 재미가 아니다.
 */
export const CALL_MENTAL_FLOOR = 8;

/** 한 번 앉아서 받을 수 있는 콜 상한(정신력이 남아도 여기서 끊는다). */
export const CALL_MAX_STREAK = 12;

/* ─────────────────── 콜 상황 ─────────────────── */

export interface CallLine {
  id: string;
  /** 수화기 너머 첫 마디 */
  text: string;
  /**
   * 이 콜의 수당 배율. 진상일수록 높게 잡아 "힘든 콜이 돈이 된다"를 만든다.
   * 없으면 1.
   */
  payMul?: number;
  /** 이 콜의 추가 정신력 소모(누적 가속과 별개). 없으면 0. */
  mental?: number;
  /** 이 콜을 받으면 오르는 친화력(없으면 기본값). */
  sociability?: number;
}

/**
 * 콜 풀. 한 콜씩 무작위로 뽑힌다.
 *
 * ⚠️ 선택지가 없는 게 의도다 — 상담원은 고를 수 없다. 결정은 오직 "받을까 퇴근할까"뿐이고,
 *    그게 이 직업이 택시(응대 선택)와 갈리는 지점이다.
 */
export const CALL_LINES: readonly CallLine[] = [
  {
    id: "manual",
    text: "\"설명서대로 했는데 안 되는데요. 아니 제 말은, 설명서가 틀렸다고요.\"",
  },
  {
    id: "wrong_dept",
    text: "\"거기 그 부서 아니에요? 아까부터 세 번을 돌려요 지금.\"",
    mental: -2,
    payMul: 1.1,
  },
  {
    id: "rage",
    text:
      "받자마자 고함이 들어온다. 무슨 말인지 알아듣는 데 삼십 초가 걸렸다.\n" +
      "\"책임자 바꿔요. 당신 말고.\"",
    mental: -6,
    payMul: 1.5,
  },
  {
    id: "elderly",
    text: "\"미안한데 천천히 좀 말해줘요. 내가 귀가 어두워서…\"",
    sociability: 7,
  },
  {
    id: "silent",
    text: "받았는데 아무 말이 없다. 숨소리만 들린다. 이십 초쯤 지나 끊겼다.",
    mental: -3,
    payMul: 0.6,
  },
  {
    id: "refund",
    text: "\"환불 규정이요? 그건 아는데, 저는 예외라고요. 제 사정을 좀 들어보세요.\"",
    mental: -4,
    payMul: 1.25,
  },
  {
    id: "thanks",
    text: "\"저번에 상담해주신 분 맞죠? 그때 알려주신 대로 하니까 됐어요. 고맙다고 하려고 전화했어요.\"",
    sociability: 10,
    mental: 4,
  },
  {
    id: "script",
    text: "매뉴얼대로 흘러가는 콜이었다. 인사, 확인, 안내, 인사. 오 분 만에 끝났다.",
    payMul: 0.9,
  },
  {
    id: "night_drunk",
    text: "\"어… 여보세요? 거기 고객센터 맞죠? 아니 그게 아니고요…\"\n말이 계속 돈다.",
    mental: -5,
    payMul: 1.3,
  },
  {
    id: "complaint_log",
    text: "\"통화 녹음하고 있습니다. 이름이랑 사번 다시 말씀해주세요.\"",
    mental: -7,
    payMul: 1.6,
  },
];
