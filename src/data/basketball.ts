import type { SkillStatId } from "@/core/types";

/**
 * 오락실 농구 슛 경품표와 연출 문구.
 * 정산은 systems/basketball.ts가, 물리는 ui/hoopScene.ts가 담당한다.
 *
 * ⚠️ **기댓값이 1판 비용(1,000원)을 크게 넘지 않게** 잡았다. 넘기면 농구가 돈 버는 루프가 되고,
 *    순손실인 인형뽑기와 형평이 깨진다. 잘하는 플레이어만 이득을 보는 게 오락실답다.
 *    (3골 = 2,000원이 손익분기 살짝 위. 초보는 대개 0~2골이라 본전을 못 뽑는다.)
 */

/** 점수 구간별 상품 */
export interface HoopPrize {
  /** 이 점수 이상이면 이 구간(내림차순으로 검사한다) */
  minScore: number;
  /** 구간 이름 — 결과 화면 제목 */
  label: string;
  /** 받는 상금(원) */
  money: number;
  /** 오르는 스탯 */
  skillGains: Partial<Record<SkillStatId, number>>;
  /** 회복하는 정신력 */
  mental: number;
  /** 결과 화면 문구 */
  result: string;
}

/**
 * ⚠️ **내림차순을 유지하라.** systems가 위에서부터 훑어 첫 일치를 쓴다.
 *    맨 아래(minScore 0)가 폴백이라 반드시 남겨둬야 한다.
 */
export const HOOP_PRIZES: HoopPrize[] = [
  {
    minScore: 15,
    label: "이 동네 농구왕",
    money: 40_000,
    skillGains: { fitness: 12 },
    mental: 10,
    result:
      "링이 쉴 틈이 없었다. 뒤에서 구경하던 학생들이 박수를 쳤고, 주인 아저씨가 상품을 한가득 안겨주며 다음엔 좀 봐달라고 했다.",
  },
  {
    minScore: 10,
    label: "손목이 기억한다",
    money: 15_000,
    skillGains: { fitness: 8 },
    mental: 5,
    result:
      "중반부터 감이 잡혀 연달아 꽂아넣었다. 종료음이 울릴 때 어깨가 뻐근했지만 기분은 최고였다.",
  },
  {
    minScore: 6,
    label: "제법 하는데",
    money: 6_000,
    skillGains: { fitness: 4 },
    mental: 0,
    result: "몇 개는 깔끔하게 들어갔다. 옆 기계 사람이 슬쩍 쳐다볼 정도는 됐다.",
  },
  {
    minScore: 3,
    label: "본전은 뽑았다",
    money: 2_000,
    skillGains: {},
    mental: 0,
    result: "겨우 몇 개 넣었다. 딱 동전값은 건진 셈이다.",
  },
  {
    minScore: 0,
    label: "링이 좁다",
    money: 0,
    skillGains: {},
    mental: 0,
    result:
      "공이 림을 튕겨 나가기만 했다. 종료음이 울리고 나서야 손목을 어떻게 써야 했는지 알 것 같았다.",
  },
];

/** 득점 순간 캔버스에 잠깐 뜨는 문구 */
export const HOOP_SCORE_LINES: string[] = [
  "들어갔다!",
  "깔끔하다!",
  "그물만 흔들었다!",
  "손목 좋았어!",
  "연속으로!",
];

/** 빗나갔을 때 */
export const HOOP_MISS_LINES: string[] = [
  "림을 맞고 튕겼다",
  "너무 세게 던졌다",
  "백보드만 맞혔다",
  "짧았다",
];

/** 농구기 앞에 섰을 때의 안내 */
export const HOOP_INTRO =
  "낡은 농구 게임기 앞에 섰다. 동전을 넣으면 30초 동안 공이 계속 나온다. 공을 끌어당겨 손을 떼면 던져진다.";
