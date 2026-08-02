/**
 * 웹툰 플랫폼 월간 연재 순위 — 매달 정산일에 공개된다.
 *
 * 왜 넣었나: 작가는 매달 원고를 그리는데 그 결과가 통장 숫자와 편집자 코멘트 한 줄로만
 * 돌아왔다. "이번 달 열심히 그렸다"가 눈에 보이는 자리로 바뀌지 않았다.
 * 연재처에 순위표가 걸리면 한 달치 작업이 등수 하나로 요약된다.
 *
 * 규칙(점수·순위·집계)은 `systems/authorRank.ts`가 소유한다.
 *
 * ⚠️ **순위는 인기 지표만으로 정하지 않는다.** 그 달 얼마나 올렸는지(연재 성실도)가 곱해진다 —
 *    휴재하면 순위가 떨어지는 게 연재판의 상식이고, 그래야 이번 달 작업이 순위로 돌아온다.
 *    (`authorMonthlySalary`는 여전히 작업량과 무관하다. 그건 인기 지표고 이건 순위다.)
 */

/** 순위표 크기 — SNS 팔로워 순위(100)보다 좁다. 연재처 한 곳의 상위권이라 그렇다. */
export const AUTHOR_RANK_SIZE = 50;
/** 1위가 되는 점수. */
export const AUTHOR_RANK1_SCORE = 1_000_000;
/** 꼴찌(50위) 문턱. 이 밑은 순위권 밖(연재는 하지만 표에 안 걸린다). */
export const AUTHOR_RANK_LAST_SCORE = 150_000;

/**
 * 연재 성실도 배율 — 이번 달 작업량 게이지가 목표의 몇 %인지로 갈린다.
 *
 * ⚠️ 휴재(0%)를 0으로 만들지 않는 이유: 순위가 통째로 사라지면 "한 달 쉬면 처음부터"가 되어
 *    복귀할 마음이 안 든다. 크게 떨어지되 돌아올 자리는 남긴다.
 */
export const DILIGENCE_TIERS: readonly { minRatio: number; mul: number; label: string }[] = [
  { minRatio: 1, mul: 1.15, label: "완주" },
  { minRatio: 0.6, mul: 1.0, label: "정상 연재" },
  { minRatio: 0.3, mul: 0.75, label: "분량 미달" },
  { minRatio: 0.01, mul: 0.5, label: "잦은 휴재" },
  { minRatio: 0, mul: 0.35, label: "휴재" },
];

/** 순위 구간별 편집자 코멘트. `upTo` **이하**(더 좋은 순위)면 이 문구를 쓴다. */
export interface AuthorRankTier {
  upTo: number;
  label: string;
  line: string;
}

export const AUTHOR_RANK_TIERS: readonly AuthorRankTier[] = [
  {
    upTo: 1,
    label: "1위",
    line: "플랫폼 전체 1위예요!! 메인 최상단에 걸렸고, 편집부 회의에서 작가님 얘기만 했습니다 😱",
  },
  {
    upTo: 3,
    label: "최상위권",
    line: "톱3에 드셨어요! 이 자리는 아무나 못 옵니다. 단행본 얘기 슬슬 꺼내볼게요.",
  },
  {
    upTo: 10,
    label: "톱10",
    line: "톱10 진입입니다! 신규 유입이 확 늘었어요. 이 페이스만 유지해 주세요 🔥",
  },
  {
    upTo: 25,
    label: "중상위권",
    line: "순위표 위쪽에 자리 잡으셨네요. 고정 독자층이 생겼다는 뜻이에요.",
  },
  {
    upTo: AUTHOR_RANK_SIZE,
    label: "순위권",
    line: "순위표에 이름 올리셨어요. 여기 걸리는 것만 해도 연재작 중 상위입니다.",
  },
];

/** 순위권 밖일 때. */
export const AUTHOR_RANK_UNRANKED =
  "이번 달은 순위표에 못 들었어요. 아쉽지만 연재는 길게 보는 겁니다 — 다음 달에 올려봐요.";

/**
 * 순위표에서 내 위에 걸리는 경쟁작 이름(패러디).
 * 등수만 던지면 숫자 하나지만, 바로 위에 뭐가 있는지 보이면 표가 된다.
 */
export const RIVAL_TITLES: readonly string[] = [
  "회귀한 막내가 너무 강함",
  "사내 연애는 비밀입니다",
  "던전에 출근합니다",
  "폐급 헌터의 재취업",
  "그 집 고양이는 말을 한다",
  "월요일엔 세계가 멸망한다",
  "네 번째 계약자",
  "옆집 소리가 이상해",
  "천재 셰프의 하루",
  "이번 생은 조연으로",
  "새벽 세 시의 편의점",
  "악역인데 자꾸 착해짐",
];
