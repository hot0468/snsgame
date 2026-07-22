/**
 * 트친(단짝) — 상수·응원/성사 문구.
 *
 * 판정·도달 배율은 systems/tchin이 한다. 여기선 콘텐츠·수치만 둔다.
 * 트친은 '같은 계정과의 상호작용 누적'으로 성사되는 사회적 온기 + 성장 축이다.
 */

/** 트친 성사 임계치 — 같은 핸들과 이만큼 상호작용(좋아요/RT/인용/DM)하면 트친이 된다. */
export const TCHIN_THRESHOLD = 5;

/** 트친 1명당 도달 배율 가산치. 배율 = 1 + min(트친수, TCHIN_CAP) × TCHIN_REACH. */
export const TCHIN_REACH = 0.03;

/** 도달 배율에 반영되는 트친 수 상한(초과분은 배율에 영향 없음). */
export const TCHIN_CAP = 8;

/** 트윗 게시 후 트친이 리트윗으로 띄워줄 확률(보너스 팔로워 유입). */
export const TCHIN_BOOST_CHANCE = 0.18;
/** 트친 리트윗 보너스 팔로워 하한·상한. */
export const TCHIN_BOOST_MIN = 5;
export const TCHIN_BOOST_MAX = 30;

/** 트친 성사 순간 문구(핸들 삽입). ui가 토스트로 쓴다. */
export const TCHIN_BECAME_LINES: string[] = [
  "님과 트친이 됐어요! 이제 서로 챙겨주는 사이 🤝",
  "님이 나를 알아봐 줬다. 트친 성사!",
  "님과 단짝이 됐다. 타임라인에 아군이 하나 늘었다.",
];

/** 트친 리트윗 응원 카톡 문구 풀(등록 시 랜덤). */
export const TCHIN_CHEER_LINES: string[] = [
  "님 방금 글 너무 좋아서 리트윗했어요! 더 많은 사람이 봐야 함 ㅎㅎ",
  "이거 제 타임라인에 박제합니다. 우리 트친이잖아요 😎",
  "좋은 글은 널리 퍼뜨려야죠. 알티 박고 갑니다!",
];
