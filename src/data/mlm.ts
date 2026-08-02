/**
 * 다단계 사업자직 콘텐츠 — 매입비·수당 상수와 길거리 홍보 대상.
 *
 * 규칙(성사 판정·호감도 소모)은 `systems/mlm.ts`가 소유한다.
 *
 * ⚠️ **이 직업의 축은 관계다.** 지인 판매는 성사율이 높은 대신 그 사람의 호감도를 태우고,
 *    호감도가 0이 되면 **연락이 끊겨 다시는 권할 수 없다**(관계 서사도 함께 막힌다).
 *    지인 수가 유한한 자원이 되어 "언제 태울까"를 고민하게 만드는 게 설계 의도다.
 *
 * ⚠️ 보험설계사에서 넘어오며 **급여의 방향이 뒤집혔다.** 고정급을 받는 게 아니라
 *    매달 재고 매입비를 **낸다.** 아무것도 안 팔면 돈이 줄어드는 유일한 직업이고,
 *    그게 다단계다 — 안 팔면 손해라서 지인을 태우게 되는 구조.
 */

/** 회사 이름(패러디). 이사님 DM 핸들 `freedom_king`과 같은 세계관. */
export const MLM_COMPANY = "프리덤라이프";

/** 화면에 쓰는 직함. 회사는 절대 '직원'이라고 부르지 않는다 — 그게 이 직업의 아이러니다. */
export const MLM_TITLE = "사업자";

/**
 * 매월 10일 빠져나가는 재고 매입비(원). 회사원 월급날과 같은 날에 **반대 방향으로** 움직인다.
 *
 * ⚠️ 지인 판매 1건 수당(MLM_COMMISSION × KNOWN_SIZE_MULTIPLIER = 39만)보다 **살짝 많다.**
 *    한 달에 지인 하나는 태워야 본전이라는 뜻이고, 그 압박이 이 직업의 전부다.
 */
export const MLM_MONTHLY_STOCK_COST = 400_000;

/** 판매 1건 수당의 기준액. 실제 수당은 여기에 판매 규모 배율이 곱해진다. */
export const MLM_COMMISSION = 260_000;

/** 근무 1블록 행동력 소모 — 회사원(WORK_ACTION_COST 15)과 같은 급으로 맞춘다. */
export const MLM_ACTION_COST = 15;

/* ─────────────────── 지인 판매 ─────────────────── */

/**
 * 지인 판매 성사율의 기본값과 호감도 가산.
 * `성사율 = BASE + (호감도/100) × AFFINITY_WEIGHT` (클램프 0.15~0.95).
 * 친한 사람일수록 거절하기 어렵다 — 그게 지인 영업이 잔인한 이유다.
 */
export const KNOWN_BASE_CHANCE = 0.25;
export const KNOWN_AFFINITY_WEIGHT = 0.6;

/** 지인 판매 1회가 깎는 호감도(성사 여부와 무관하게 깎인다 — 물어본 것 자체가 부담이다). */
export const KNOWN_AFFINITY_COST = 22;
/** 성사됐을 때 추가로 더 깎이는 호감도(정말로 결제하게 만든 대가). */
export const KNOWN_AFFINITY_COST_SIGNED = 10;

/** 지인 판매는 규모가 크다 — 믿고 사는 만큼 금액도 크다. */
export const KNOWN_SIZE_MULTIPLIER = 1.5;

/** 호감도가 이 값 이하로 떨어진 지인은 **연락이 끊긴다**(권유 대상에서 영구 제외). */
export const KNOWN_BURNED_AT = 0;

/* ─────────────────── 길거리 홍보 ─────────────────── */

/**
 * 길거리 홍보 성사율 = `BASE + 친화력01 × SOCIABILITY_WEIGHT + 평판01 × REPUTATION_WEIGHT`.
 * 지인 판매보다 훨씬 낮다. 대신 아무도 잃지 않는다.
 */
export const COLD_BASE_CHANCE = 0.08;
export const COLD_SOCIABILITY_WEIGHT = 0.35;
export const COLD_REPUTATION_WEIGHT = 0.15;

/** 길거리 홍보 1회 정신력 소모(거절이 기본값인 일이다). */
export const COLD_MENTAL_COST = 7;
/** 길거리 홍보로 오르는 친화력(거절당하며 배우는 것도 있다). */
export const COLD_SOCIABILITY_GAIN = 8;

/** 길거리 홍보 대상 — 성사되면 이름이 구매자로 뜬다. */
export interface ColdTarget {
  /** 어디서 붙잡았는지 */
  place: string;
  /** 어떤 사람인지 */
  who: string;
}

export const COLD_TARGETS: readonly ColdTarget[] = [
  { place: "지하철역 출구", who: "설문 좀 부탁드린다는 말에 멈춰 선 사람" },
  { place: "대학가 카페 앞", who: "취업 준비 중이라던 복학생" },
  { place: "아파트 단지 놀이터", who: "유모차를 세워둔 채 앉아 있던 사람" },
  { place: "고시원 복도", who: "라면을 들고 나오던 옆방 사람" },
  { place: "헬스장 락커룸", who: "몸 좋아지는 법을 묻던 회원" },
  { place: "동네 치킨집", who: "혼자 소주를 따르던 손님" },
  { place: "새벽 인력사무소", who: "일감이 없어 돌아서던 사람" },
  { place: "PC방 흡연실", who: "며칠째 같은 자리에 앉아 있던 사람" },
  { place: "24시 카페", who: "노트북에 사업계획서를 띄워둔 사람" },
  { place: "재래시장 뒷골목", who: "가게를 접는 중이라던 주인" },
];

/** 길거리 홍보 결과 문구(성사). */
export const COLD_SUCCESS_LINES: readonly string[] = [
  "\"솔직히 지금 뭐라도 해야 해서요.\" 그 말에 더 물어보지 않았다.",
  "센터 주소를 적어줬더니 다음 주에 오겠다고 했다. 정말로 왔다.",
  "\"이거 사면 저도 할 수 있는 거죠?\" 그렇다고 대답했다. 반은 맞는 말이었다.",
];

/** 길거리 홍보 결과 문구(실패). */
export const COLD_FAIL_LINES: readonly string[] = [
  "\"저 그거 뭔지 알아요.\" 말이 끝나기도 전에 등을 돌렸다.",
  "팸플릿은 받았다. 뒤돌아서 접어 버리는 것도 봤다.",
  "\"돈 버는 얘기죠?\" 웃으면서 물었고, 웃으면서 갔다.",
  "누가 멀리서 이쪽을 찍고 있었다. 서둘러 자리를 옮겼다.",
];

/** 지인 판매 결과 문구(성사) — `{name}`은 지인 닉네임으로 치환된다. */
export const KNOWN_SUCCESS_LINES: readonly string[] = [
  "{name}은(는) 한참 말이 없다가 카드를 꺼냈다. \"너니까 사는 거야.\"",
  "{name}이(가) 결제하며 물었다. \"이거 너한테 도움 되는 거지?\"",
  "설명을 다 듣고 {name}이(가) 말했다. \"안 사면 네가 곤란해지는 거잖아.\"",
  "{name}은(는) 박스를 받아들며 웃었다. 다 쓸 일이 없다는 걸 둘 다 알았다.",
];

/** 지인 판매 결과 문구(실패). */
export const KNOWN_FAIL_LINES: readonly string[] = [
  "{name}은(는) 커피만 두 잔 사주고 일어섰다. 제품 얘기는 꺼내지도 못했다.",
  "\"미안한데 그런 거는 좀…\" {name}의 말끝이 흐려졌다.",
  "{name}이(가) 웃으면서 화제를 돌렸다. 세 번쯤 돌린 뒤에 알아들었다.",
  "\"너 요즘 이상해졌어.\" {name}이(가) 한 말은 그게 전부였다.",
];

/** 연락이 끊긴 순간의 문구. */
export const KNOWN_BURNED_LINE =
  "{name}은(는) 그 뒤로 연락을 받지 않는다. 읽음 표시만 남는다.";

/* ─────────────────── 이사님 제의 ─────────────────── */

/**
 * 다단계 접선 DM(`systems/eggs.ts`의 pyramid 이스터에그)에서 제의를 수락했을 때 상대가 덧붙이는 말.
 * 이 직업의 **유일한 입사 경로**다 — 채용 사이트가 없다.
 */
export const MLM_ACCEPT_LINE =
  "잘 생각하셨어요! 내일 아침에 센터에서 뵈어요. 첫 달 물량은 제가 넣어드릴게요 😊";

/** 제의를 거절했을 때. */
export const MLM_DECLINE_LINE =
  "아쉽네요. 근데 마음 바뀌면 언제든지요, 저는 늘 여기 있으니까 :)";
