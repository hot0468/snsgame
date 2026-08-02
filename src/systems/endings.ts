import type { GameState } from "@/core/types";
import {
  AUTHOR_ENDING_REASON,
  AV_ENDING_REASON,
  CALL_CENTER_ENDING_REASON,
  COACH_ENDING_REASON,
  DEBUT_ENDING_REASON,
  LECTURER_ENDING_REASON,
  LEGEND_BJ_ENDING_REASON,
  MLM_ENDING_REASON,
  OFFICE_ENDING_REASON,
  STYLIST_ENDING_REASON,
  TAXI_ENDING_REASON,
} from "@/core/state";
import { JOB_RANKS } from "@/data/jobs";
import { TAXI_DELUXE_CERT } from "@/data/taxi";
import { CALL_MAX_STREAK } from "@/data/callCenter";
import { REGULAR_BONUS_MAX, REGULAR_FEE_BONUS } from "@/data/stylist";
import { totalFollowers } from "./economy";

/**
 * 조건을 만족하면 뜨는 '엔딩 제안'. (파이어 엔딩은 별도 처리, 여기선 데뷔·작가)
 * 수락하면 해당 엔딩, 거절하면 다시 제안하지 않고 계속 플레이한다.
 */
export interface EndingOffer {
  id: string;
  /** 수락 시 gameOver에 저장할 엔딩 사유 */
  reason: string;
  /** 제안 모달 제목 */
  offerTitle: string;
  /** 제안 문구 */
  offerLead: string;
  confirmLabel: string;
  declineLabel: string;
  /** 이 엔딩 제안이 뜰 조건 */
  condition: (s: GameState) => boolean;
}

/** 연예인 데뷔에 필요한 팔로워 수 */
export const DEBUT_FOLLOWERS = 500_000;
/** 연예인 데뷔에 필요한 미용 스탯 */
export const DEBUT_BEAUTY = 600;
/** 전업 작가 정착에 필요한 정산(근무) 개월 수 */
export const AUTHOR_ENDING_MONTHS = 6;
/** 레전드 BJ 엔딩에 필요한 소지금 */
export const LEGEND_BJ_ENDING_MONEY = 5_000_000;

/* ─────────────────── 직업 엔딩 ─────────────────── */

/**
 * 택시·콜센터·다단계·헤어디자이너의 도달점.
 *
 * ⚠️ 조건은 **그 직업의 고유 축이 만렙에 닿았을 때**로 잡는다. 근속 일수처럼 아무 직업에나
 *    붙일 수 있는 숫자로 재면 네 엔딩이 전부 같은 엔딩이 된다.
 *    - 택시 = 평점(모범택시 자격 + 승객 응대의 결과)
 *    - 콜센터 = 한 자리에서 받아낸 최다 연속 콜(상한까지 버텼는가)
 *    - 다단계 = **태운 지인 수**(이 직업이 무엇을 대가로 삼는지 그대로)
 *    - 헤어 = 단골(단가 배율이 상한에 닿는 인원 = 이 직업의 만렙)
 *
 * ⚠️ 제안은 **재직 중일 때만** 뜬다(각 condition이 job을 먼저 본다) — 그만둔 직업의 엔딩이
 *    나중에 튀어나오면 서사가 어긋난다.
 */

/** 모범택시 엔딩: 1종 대형 + 평점 이 값 이상 + 누적 운행. */
export const TAXI_ENDING_RATING = 90;
export const TAXI_ENDING_RIDES = 100;

/** 콜센터 엔딩: 최다 연속 콜이 상한(CALL_MAX_STREAK)에 닿고, 누적 콜이 이 값 이상. */
export const CALL_ENDING_TOTAL = 300;

/**
 * 다단계 엔딩: 태운 지인이 이 값 이상 + 누적 수당.
 * 관계 캐릭터 28명 중 10명 — "다 태우진 않았지만 돌아갈 자리는 없다"는 지점이다.
 */
export const MLM_ENDING_BURNED = 10;
export const MLM_ENDING_COMMISSION = 20_000_000;

/** 헤어 엔딩: 단골이 단가 배율 상한에 닿는 인원(= 만렙) + 누적 시술. */
export const STYLIST_ENDING_REGULARS = Math.ceil(REGULAR_BONUS_MAX / REGULAR_FEE_BONUS);
export const STYLIST_ENDING_CUTS = 120;

/**
 * 회사원 엔딩: **최고 직급**(JOB_RANKS의 마지막 = 이사)에 오른다.
 * 하드코딩(6) 대신 표 길이에서 뽑는다 — 직급을 늘리면 문턱도 따라 올라가야 한다.
 */
export const OFFICE_ENDING_LEVEL = JOB_RANKS.length - 1;

/** 강사 엔딩: 누적 수업. 월 quota가 있어 한 달에 몇 회씩만 쌓인다. */
export const LECTURER_ENDING_LESSONS = 60;

/** AV 엔딩: 누적 근무일(하루 1회 가드가 걸려 있어 곧 '버틴 날 수'다). */
export const AV_ENDING_WORKDAYS = 60;

/** 코치 엔딩: 전국체전 우승 횟수. 대회는 짝수달 15일에만 열려 가장 오래 걸리는 문턱이다. */
export const COACH_ENDING_CHAMPIONSHIPS = 3;

export const ENDING_OFFERS: EndingOffer[] = [
  {
    id: "debut",
    reason: DEBUT_ENDING_REASON,
    offerTitle: "🌟 캐스팅 제안",
    offerLead:
      "대형 기획사에서 정식 데뷔를 제안해왔다. SNS 스타를 넘어 진짜 연예인이 되어볼까?",
    confirmLabel: "데뷔한다 (엔딩)",
    declineLabel: "SNS에 남는다",
    condition: (s) => totalFollowers(s) >= DEBUT_FOLLOWERS && s.skills.beauty >= DEBUT_BEAUTY,
  },
  {
    id: "author",
    reason: AUTHOR_ENDING_REASON,
    offerTitle: "✍️ 작가의 길",
    offerLead:
      "어느새 반년 넘게 마감을 지켜온 나. 이제 이 길을 천직으로 삼고 전업 작가로 정착해볼까?",
    confirmLabel: "작가로 정착한다 (엔딩)",
    declineLabel: "조금 더 도전한다",
    condition: (s) => (s.authorContract?.monthsWorked ?? 0) >= AUTHOR_ENDING_MONTHS,
  },
  {
    id: "legendBJ",
    reason: LEGEND_BJ_ENDING_REASON,
    offerTitle: "🎙️ 사바나의 전설",
    offerLead:
      "별풍선이 통장에 쌓이고, 이제 사바나에서 내 이름을 모르는 사람이 없다. 전속 계약을 맺고 여기서 전설로 굳혀볼까?",
    confirmLabel: "전설로 남는다 (엔딩)",
    declineLabel: "아직은 더 방송한다",
    // 누적 수익을 쌓는 상태가 없어 '지금 가진 돈'으로 판정한다(기존 state만 조합).
    condition: (s) =>
      s.eggs.done.legendBJ && s.savannaJoined && s.money >= LEGEND_BJ_ENDING_MONEY,
  },
  {
    id: "taxiMaster",
    reason: TAXI_ENDING_REASON,
    offerTitle: "🚕 이달의 기사",
    offerLead:
      "회사 벽에 걸린 액자가 몇 달째 그대로다. 배차실장이 정규직 전환 서류를 내밀었다. " +
      "여기서 핸들을 계속 잡는 삶으로 정착해볼까?",
    confirmLabel: "핸들을 계속 잡는다 (엔딩)",
    declineLabel: "아직은 SNS다",
    condition: (s) =>
      !!s.taxiJob &&
      s.certifications.includes(TAXI_DELUXE_CERT) &&
      s.taxiJob.rating >= TAXI_ENDING_RATING &&
      s.taxiJob.totalRides >= TAXI_ENDING_RIDES,
  },
  {
    id: "callMaster",
    reason: CALL_CENTER_ENDING_REASON,
    offerTitle: "🎧 교육 담당 제안",
    offerLead:
      "센터장이 불렀다. \"신입들한테 그거 어떻게 하는지 좀 알려줄래요?\" " +
      "받는 자리에서 가르치는 자리로 옮겨앉아볼까?",
    confirmLabel: "헤드셋을 벗는다 (엔딩)",
    declineLabel: "조금 더 받아본다",
    condition: (s) =>
      !!s.callCenterJob &&
      s.callCenterJob.bestStreak >= CALL_MAX_STREAK &&
      s.callCenterJob.totalCalls >= CALL_ENDING_TOTAL,
  },
  {
    id: "mlmDiamond",
    reason: MLM_ENDING_REASON,
    offerTitle: "💎 승급 심사 통과",
    offerLead:
      "이사님이 어깨를 두드렸다. \"이번 달 시상식, 무대 올라가셔야죠.\" " +
      "연락처는 많이 비었지만 등급은 남았다. 여기서 자리를 굳혀볼까?",
    confirmLabel: "무대에 오른다 (엔딩)",
    declineLabel: "그만 생각해본다",
    condition: (s) =>
      !!s.mlmJob &&
      s.mlmJob.burnedContacts.length >= MLM_ENDING_BURNED &&
      s.mlmJob.totalCommission >= MLM_ENDING_COMMISSION,
  },
  {
    id: "stylistOwn",
    reason: STYLIST_ENDING_REASON,
    offerTitle: "✂️ 자리 하나 나왔어요",
    offerLead:
      "원장이 커피를 내밀며 말했다. \"건너편 상가에 자리 하나 났는데, 생각 있어요?\" " +
      "단골들은 따라오겠다고 한다. 내 이름으로 간판을 걸어볼까?",
    confirmLabel: "가게를 낸다 (엔딩)",
    declineLabel: "여기가 아직 편하다",
    condition: (s) =>
      !!s.stylistJob &&
      s.stylistJob.regulars >= STYLIST_ENDING_REGULARS &&
      s.stylistJob.cuts >= STYLIST_ENDING_CUTS,
  },
  {
    id: "officeExec",
    reason: OFFICE_ENDING_REASON,
    offerTitle: "🏢 임원 승진 통보",
    offerLead:
      "인사팀에서 봉투를 건넸다. 이름 뒤에 붙을 직함이 바뀐다는 통보다. " +
      "여기서 회사 사람으로 남는 삶을 택해볼까?",
    confirmLabel: "임원이 된다 (엔딩)",
    declineLabel: "아직은 SNS다",
    condition: (s) => !!s.employment && s.employment.perfLevel >= OFFICE_ENDING_LEVEL,
  },
  {
    id: "lecturerStar",
    reason: LECTURER_ENDING_REASON,
    offerTitle: "🎓 단독 강좌 제안",
    offerLead:
      "본원에서 당신 이름을 건 강좌를 열자고 한다. 수강 신청 경쟁이 붙을 거라고. " +
      "가르치는 일에 이름을 걸어볼까?",
    confirmLabel: "강단에 남는다 (엔딩)",
    declineLabel: "조금 더 해본다",
    condition: (s) => !!s.lecturerJob && s.lecturerJob.totalLessons >= LECTURER_ENDING_LESSONS,
  },
  {
    id: "avIcon",
    reason: AV_ENDING_REASON,
    offerTitle: "🎬 전속 제안",
    offerLead:
      "제작사가 장기 전속을 제안해왔다. 이제 당신 이름만으로 기획이 돌아간다고 한다. " +
      "이 바닥에서 이름을 굳혀볼까?",
    confirmLabel: "이름을 건다 (엔딩)",
    declineLabel: "아직은 SNS다",
    condition: (s) => !!s.avJob && s.avJob.totalWorkDays >= AV_ENDING_WORKDAYS,
  },
  {
    id: "coachMaster",
    reason: COACH_ENDING_REASON,
    offerTitle: "🏐 정식 감독 제안",
    offerLead:
      "교장이 직접 찾아와 정식 감독직을 제안했다. 우승기가 걸린 체육관을 맡아달라고. " +
      "여기서 아이들을 계속 가르쳐볼까?",
    confirmLabel: "감독을 맡는다 (엔딩)",
    declineLabel: "아직은 SNS다",
    condition: (s) => !!s.coachJob && s.coachJob.championships >= COACH_ENDING_CHAMPIONSHIPS,
  },
];

/** 지금 떠야 할 엔딩 제안(거절 안 했고 조건 충족). 없으면 null. */
export function pendingEndingOffer(state: GameState): EndingOffer | null {
  if (state.gameOver) return null;
  for (const e of ENDING_OFFERS) {
    if (!state.endingsDeclined.includes(e.id) && e.condition(state)) return e;
  }
  return null;
}
