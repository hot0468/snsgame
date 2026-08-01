/**
 * 보험설계사 콘텐츠 — 급여·성사율 상수와 무작위 영업 대상.
 *
 * 규칙(성사 판정·호감도 소모)은 `systems/insurance.ts`가 소유한다.
 *
 * ⚠️ **이 직업의 축은 관계다.** 지인 영업은 성사율이 높은 대신 그 사람의 호감도를 태우고,
 *    호감도가 0이 되면 **연락이 끊겨 다시는 영업할 수 없다**(관계 서사도 함께 막힌다).
 *    지인 수가 유한한 자원이 되어 "언제 태울까"를 고민하게 만드는 게 설계 의도다.
 */

/** 보험사 이름(패러디). */
export const INSURANCE_COMPANY = "한백생명";

/** 월 고정급(매월 10일 지급 — 회사원과 같은 날). 출근을 강제하는 직업이 벌이 0일 수는 없다. */
export const INSURANCE_BASE_SALARY = 900_000;

/** 계약 1건 수당의 기준액. 실제 수당은 여기에 계약 규모 배율이 곱해진다. */
export const INSURANCE_COMMISSION = 260_000;

/** 근무 1블록 행동력 소모 — 회사원(WORK_ACTION_COST 15)과 같은 급으로 맞춘다. */
export const INSURANCE_ACTION_COST = 15;

/* ─────────────────── 지인 영업 ─────────────────── */

/**
 * 지인 영업 성사율의 기본값과 호감도 가산.
 * `성사율 = BASE + (호감도/100) × AFFINITY_WEIGHT` (클램프 0.15~0.95).
 * 친한 사람일수록 거절하기 어렵다 — 그게 지인 영업이 잔인한 이유다.
 */
export const KNOWN_BASE_CHANCE = 0.25;
export const KNOWN_AFFINITY_WEIGHT = 0.6;

/** 지인 영업 1회가 깎는 호감도(성사 여부와 무관하게 깎인다 — 물어본 것 자체가 부담이다). */
export const KNOWN_AFFINITY_COST = 22;
/** 성사됐을 때 추가로 더 깎이는 호감도(계약서에 도장을 찍게 만든 대가). */
export const KNOWN_AFFINITY_COST_SIGNED = 10;

/** 지인 계약은 규모가 크다 — 믿고 드는 만큼 금액도 크다. */
export const KNOWN_SIZE_MULTIPLIER = 1.5;

/** 호감도가 이 값 이하로 떨어진 지인은 **연락이 끊긴다**(영업 대상에서 영구 제외). */
export const KNOWN_BURNED_AT = 0;

/* ─────────────────── 무작위 영업 ─────────────────── */

/**
 * 무작위 영업 성사율 = `BASE + 친화력01 × SOCIABILITY_WEIGHT + 평판01 × REPUTATION_WEIGHT`.
 * 지인 영업보다 훨씬 낮다. 대신 아무도 잃지 않는다.
 */
export const COLD_BASE_CHANCE = 0.08;
export const COLD_SOCIABILITY_WEIGHT = 0.35;
export const COLD_REPUTATION_WEIGHT = 0.15;

/** 무작위 영업 1회 정신력 소모(거절이 기본값인 일이다). */
export const COLD_MENTAL_COST = 7;
/** 무작위 영업으로 오르는 친화력(거절당하며 배우는 것도 있다). */
export const COLD_SOCIABILITY_GAIN = 8;

/** 무작위 영업 대상 — 성사되면 이름이 계약자로 뜬다. */
export interface ColdTarget {
  /** 어디서 만났는지 */
  place: string;
  /** 어떤 사람인지 */
  who: string;
}

export const COLD_TARGETS: readonly ColdTarget[] = [
  { place: "지하철역 앞", who: "출근길에 담배 피우던 사람" },
  { place: "상가 3층 미용실", who: "손님 없는 시간대의 원장" },
  { place: "아파트 단지 경비실", who: "교대 준비 중이던 경비원" },
  { place: "구청 민원실 대기줄", who: "번호표를 든 채 앉아 있던 사람" },
  { place: "헬스장 락커룸", who: "운동 끝내고 나오던 회원" },
  { place: "동네 치킨집", who: "포장 기다리던 손님" },
  { place: "학원 앞 주차장", who: "아이를 기다리던 학부모" },
  { place: "공사장 컨테이너", who: "점심 먹고 쉬던 반장" },
  { place: "24시 카페", who: "노트북을 펴고 있던 사람" },
  { place: "재래시장 청과점", who: "박스를 정리하던 주인" },
];

/** 무작위 영업 결과 문구(성사). */
export const COLD_SUCCESS_LINES: readonly string[] = [
  "설명을 끝까지 들어줬다. \"마침 하나 알아보고 있었어요.\"",
  "명함을 두 번 보더니 펜을 달라고 했다.",
  "\"어차피 들 거면 아는 사람한테 드는 게 낫죠.\" 아는 사이는 아니었지만 그렇게 됐다.",
];

/** 무작위 영업 결과 문구(실패). */
export const COLD_FAIL_LINES: readonly string[] = [
  "\"관심 없습니다.\" 말이 끝나기도 전에 등을 돌렸다.",
  "명함은 받았다. 뒤돌아서 버리는 것도 봤다.",
  "\"생각해볼게요.\" 이 일을 하면서 그 말의 뜻을 배웠다.",
  "문전박대라는 말이 실제로 문 앞에서 일어나는 일임을 알았다.",
];

/** 지인 영업 결과 문구(성사) — `{name}`은 지인 닉네임으로 치환된다. */
export const KNOWN_SUCCESS_LINES: readonly string[] = [
  "{name}은(는) 한참 말이 없다가 \"너니까 든다\"고 했다.",
  "{name}이(가) 서류에 도장을 찍으며 물었다. \"이거 너한테 도움 되는 거지?\"",
  "설명을 다 듣고 {name}이(가) 말했다. \"안 들면 네가 곤란해지는 거잖아.\"",
];

/** 지인 영업 결과 문구(실패). */
export const KNOWN_FAIL_LINES: readonly string[] = [
  "{name}은(는) 커피만 두 잔 사주고 일어섰다. 보험 얘기는 꺼내지도 못했다.",
  "\"미안한데 그런 거는 좀…\" {name}의 말끝이 흐려졌다.",
  "{name}이(가) 웃으면서 화제를 돌렸다. 세 번쯤 돌린 뒤에 알아들었다.",
];

/** 연락이 끊긴 순간의 문구. */
export const KNOWN_BURNED_LINE =
  "{name}은(는) 그 뒤로 연락을 받지 않는다. 읽음 표시만 남는다.";
