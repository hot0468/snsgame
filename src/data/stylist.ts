/**
 * 헤어디자이너 콘텐츠 — 시술 종류·손님·상수.
 *
 * 규칙(예약 수·단가·단골 판정)은 `systems/stylist.ts`가 소유한다.
 *
 * ⚠️ **이 직업만 SNS와 협력한다.** 택시는 심야 슬롯을 뺏고 콜센터는 정신력을 깎아
 *    본편과 경쟁하지만, 헤어디자이너는 팔로워가 곧 손님이다 —
 *    SNS를 키우는 게 그대로 본업 수입이 된다.
 */

/** 미용실 이름(패러디). */
export const SALON_NAME = "가위손";

/** 취업에 필요한 자격증 id — `data/certifications.ts`의 미용사(일반). */
export const STYLIST_REQ_CERT = "hairdresser";

/** 시술 1건 기본 시술비(뷰티 스탯·팔로워 배율 전). */
export const STYLIST_BASE_FEE = 28_000;

/** 근무 1블록(한 타임 손님 받기) 행동력 소모. */
export const STYLIST_ACTION_COST = 12;

/* ─────────────────── 팔로워 → 손님 ─────────────────── */

/**
 * 한 타임에 잡히는 예약 수 = `BASE + floor(팔로워 / PER_BOOKING)` (상한 MAX).
 *
 * ⚠️ 이게 이 직업의 축이다. 팔로워가 손님을 데려온다 — SNS 본편이 그대로 매출이 된다.
 *    1만 팔로워당 +1명. 10만이면 상한에 닿는다.
 */
export const BOOKING_BASE = 1;
export const BOOKING_PER_FOLLOWER = 10_000;
export const BOOKING_MAX = 6;

/**
 * 팔로워가 단가에 얹는 최대 배율(+80%). 유명한 디자이너에게는 더 낸다.
 * 상한(FAME_CAP_FOLLOWERS)에서 최대치에 닿는다.
 */
export const FAME_FEE_BONUS_MAX = 0.8;
export const FAME_CAP_FOLLOWERS = 200_000;

/** 뷰티 스킬이 단가에 얹는 최대 배율(+120%). 실력이 명성보다 크게 먹는다. */
export const SKILL_FEE_BONUS_MAX = 1.2;

/* ─────────────────── 단골 ─────────────────── */

/**
 * 단골 1명이 얹는 단가 배율(누적). 상한은 REGULAR_BONUS_MAX.
 *
 * 보험설계사의 지인이 **태우는** 자원이라면 단골은 **쌓는** 자원이다 — 방향이 반대라
 * 두 직업이 같은 축으로 안 겹친다.
 */
export const REGULAR_FEE_BONUS = 0.04;
export const REGULAR_BONUS_MAX = 0.6;

/** 시술이 잘 나오면 이 확률로 단골이 된다(뷰티 스킬이 높을수록 오른다 — systems 참조). */
export const REGULAR_BASE_CHANCE = 0.25;
/** 시술을 망치면 이 수만큼 단골이 떠난다. */
export const REGULAR_LOST_ON_FAIL = 2;

/* ─────────────────── 시술 결과 ─────────────────── */

/**
 * 시술 성공률 = `BASE + 뷰티01 × SKILL_WEIGHT` (클램프 0.3~0.97).
 * 초보도 대충은 되지만, 어려운 시술을 받으려면 실력이 있어야 한다.
 */
export const CUT_BASE_CHANCE = 0.45;
export const CUT_SKILL_WEIGHT = 0.5;

/** 시술을 망쳤을 때 깎이는 평판 — 손님이 SNS에 올린다. */
export const BOTCH_REPUTATION = -4;
/** 시술 1건 정신력 소모(서서 하는 일이고 사람을 상대한다). */
export const STYLIST_MENTAL_COST = 3;

/** 시술 종류 — 어려울수록 비싸고 실패 위험이 크다. */
export interface CutStyle {
  id: string;
  label: string;
  /** 시술비 배율 */
  feeMul: number;
  /** 성공률 가감(어려운 시술은 음수) */
  chanceMod: number;
  /** 성공 시 문구 */
  success: string;
  /** 실패 시 문구 */
  fail: string;
}

export const CUT_STYLES: readonly CutStyle[] = [
  {
    id: "trim",
    label: "다듬기",
    feeMul: 0.6,
    chanceMod: 0.25,
    success: "끝만 정리했다. 손님이 거울을 보고 고개를 끄덕였다.",
    fail: "한쪽이 미묘하게 짧다. 손님은 눈치챘지만 아무 말도 안 했다.",
  },
  {
    id: "cut",
    label: "커트",
    feeMul: 1,
    chanceMod: 0,
    success: "가르마를 넘기자 선이 딱 떨어졌다. \"이대로 계속 해주세요.\"",
    fail: "생각한 길이보다 많이 갔다. 손님 표정이 굳는 게 거울로 보였다.",
  },
  {
    id: "perm",
    label: "펌",
    feeMul: 2.2,
    chanceMod: -0.12,
    success: "말린 컬이 자연스럽게 풀렸다. 손님이 사진을 찍어갔다.",
    fail: "컬이 너무 세게 나왔다. 손님이 거울 앞에서 한참 말이 없었다.",
  },
  {
    id: "dye",
    label: "염색",
    feeMul: 2.6,
    chanceMod: -0.18,
    success: "빛에 비추자 원하던 색이 정확히 올라왔다.",
    fail: "색이 얼룩졌다. 조명 아래서 더 티가 났다.",
  },
  {
    id: "makeover",
    label: "전체 변신",
    feeMul: 4,
    chanceMod: -0.3,
    success: "의자를 돌리자 손님이 소리를 질렀다. 좋은 쪽으로.",
    fail: "의자를 돌렸다. 손님은 아무 소리도 내지 않았다. 그게 더 무서웠다.",
  },
];

/** 손님 한 명(어떤 사람이 앉았는지 — 시술 선택 전 묘사). */
export interface Customer {
  text: string;
  /** 이 손님이 원하는 시술 id(있으면 그것만 고를 수 있다). 없으면 자유 */
  wants?: string;
}

export const CUSTOMERS: readonly Customer[] = [
  { text: "\"알아서 예쁘게 해주세요.\" 제일 어려운 주문이 들어왔다." },
  { text: "휴대폰 사진을 내민다. \"이거랑 똑같이요.\" 사진 속 사람은 골격이 다르다." },
  { text: "\"저번에 해주신 분 맞죠?\" 얼굴은 기억이 안 나는데 웃으며 앉는다." },
  { text: "\"짧게요. 아주 짧게.\" 방금 무슨 일이 있었는지는 묻지 않기로 했다.", wants: "cut" },
  { text: "\"내일 면접이라서요.\" 손이 조금 떨리고 있다.", wants: "trim" },
  { text: "\"머릿결 상한 거 아는데요, 그래도 하고 싶어요.\"", wants: "perm" },
  { text: "\"인스타에서 보고 왔어요.\" 팔로워가 데려온 손님이다." },
  { text: "\"엄마가 여기 가라고 해서요.\" 교복 차림의 학생이 앉았다.", wants: "trim" },
  { text: "\"색 좀 확 바꿔주세요. 사람 좀 달라 보이게.\"", wants: "dye" },
  { text: "\"결혼식이 다음 주예요.\" 사진첩을 스무 장쯤 넘겨 보여준다." },
];
