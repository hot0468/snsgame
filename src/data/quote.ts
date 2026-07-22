/**
 * 인용 트윗(QRT) — 톤 정의·코멘트 문구·밸런스 상수.
 *
 * 판정은 systems/quote가 한다. 여기선 콘텐츠·수치만 둔다.
 * ⚠️ 성공/역풍의 뼈대는 '내 계정 성향 × 대상 계열 궁합'이 정한다(systems). 톤은 배율·리스크만 조절.
 */

export type QrtTone = "agree" | "hype" | "snark";

export interface QrtToneDef {
  id: QrtTone;
  label: string;
  /** 성공 시 보상 배율 */
  rewardMult: number;
  /** 역풍/논란 리스크 배율 */
  riskMult: number;
}

/** 톤: 동조(안전) / 맞장구(고보상·고위험) / 츳코미(논란↑·보상↑) */
export const QRT_TONES: QrtToneDef[] = [
  { id: "agree", label: "동조", rewardMult: 0.85, riskMult: 0.6 },
  { id: "hype", label: "맞장구", rewardMult: 1.3, riskMult: 1.1 },
  { id: "snark", label: "츳코미", rewardMult: 1.1, riskMult: 1.45 },
];

/** 성공 보상 계수 — 대상인기 × 이 값 × (1+궁합보정) × 톤보상. */
export const QRT_HIT_RATE = 0.15;
/** 역풍 손실 계수 — 대상인기 × 이 값 × 톤리스크. */
export const QRT_RATIO_RATE = 0.08;
/** 역풍 시 논란 발생 기본 확률(톤리스크가 곱해진다). */
export const QRT_CONTROVERSY_BASE = 0.12;

/** 톤별 코멘트 문구 풀(등록 시 랜덤). 계열 무관 범용 톤. */
export const QRT_COMMENTS: Record<QrtTone, string[]> = {
  agree: [
    "이거 진짜 맞말이다 백번 공감",
    "말끔하게 정리해주셨네 저장각",
    "그니까 이게 핵심임 다들 봐라",
    "완전 동의함 요즘 이런 트윗이 필요했다",
  ],
  hype: [
    "미쳤다 이거 ㄹㅇ 떡상각인데?",
    "와 이걸 이렇게 푼다고 천재냐",
    "지금 이거 안 보면 손해임 다들 알티",
    "오늘 타임라인 이걸로 정리됨 갓반인 인정",
  ],
  snark: [
    "음 근데 이건 좀 아니지 않나 ㅋㅋ",
    "반박 시 니 말이 다 맞음(아님)",
    "이걸 진지하게 받는 사람이 있다고?",
    "대충 맞는 말인데 왜 이렇게 재수없게 쓰냐 ㅋㅋ",
  ],
};
