import type { GameState } from "@/core/types";
import { AUTHOR_ENDING_REASON, DEBUT_ENDING_REASON } from "@/core/state";
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
];

/** 지금 떠야 할 엔딩 제안(거절 안 했고 조건 충족). 없으면 null. */
export function pendingEndingOffer(state: GameState): EndingOffer | null {
  if (state.gameOver) return null;
  for (const e of ENDING_OFFERS) {
    if (!state.endingsDeclined.includes(e.id) && e.condition(state)) return e;
  }
  return null;
}
