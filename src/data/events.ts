import type { AttributeId, GameState, SkillStatId } from "@/core/types";
import { getActiveAccount } from "@/core/state";

/** 이벤트를 발생시킬 수 있는 행동 트리거 */
export type EventTrigger = "offline" | "tweet" | "explore" | "ad" | "day";

/**
 * 선언형 효과. 로직은 systems/events.ts가 적용한다(데이터는 규칙에 의존하지 않음).
 * 값이 음수면 감소.
 */
export interface EventEffect {
  action?: number;
  mental?: number;
  morality?: number;
  /** 평판 증감 */
  reputation?: number;
  money?: number;
  /** 팔로워 고정 증감 */
  followers?: number;
  /** 현재 팔로워의 비율(%) 증감. 예: -10 = 10% 감소, 20 = 20% 증가 */
  followersPct?: number;
  skills?: Partial<Record<SkillStatId, number>>;
  /** 트윗 작성 속성 해금 */
  unlockAttribute?: AttributeId;
  /**
   * 선언형으로 표현할 수 없는 특수 효과의 키.
   * 실제 로직은 systems/events.ts의 CUSTOM_EFFECTS가 처리하며,
   * 반환한 문구가 있으면 선택지 result 대신 표시된다.
   */
  customKey?:
    | "trendWave"
    | "counterAttack"
    | "outdoorShoot"
    | "coworkerFollow"
    | "coinPump"
    | "openPaidChannel"
    | "companyDinner"
    | "hackRansom"
    | "lottery";
}

export interface EventChoice {
  label: string;
  /** 선택 시 적용될 효과 */
  effect: EventEffect;
  /** 선택 결과로 보여줄 문구 */
  result: string;
  /** 이 선택지를 노출할 조건(미충족 시 숨김) */
  requires?: (s: GameState) => boolean;
}

export interface GameEvent {
  id: string;
  emoji: string;
  title: string;
  description: string;
  /** 이 이벤트가 발생 가능한 트리거들 */
  triggers: EventTrigger[];
  /** 가중치(클수록 자주). 기본 1 */
  weight?: number;
  /** 발생 조건(미충족 시 후보 제외) */
  condition?: (s: GameState) => boolean;
  choices: EventChoice[];
}

/** 조건 헬퍼 */
const hasFollowers = (n: number) => (s: GameState) => getActiveAccount(s).followers >= n;
const moralityBelow = (n: number) => (s: GameState) => s.resources.morality < n;
/** 계정 성인물 해제가 켜져 있어야 함 */
const adultOn = (s: GameState) => getActiveAccount(s).adultMode;
/** 여러 조건을 모두 만족해야 함 */
const all =
  (...conds: ((s: GameState) => boolean)[]) =>
  (s: GameState) =>
    conds.every((c) => c(s));

/**
 * 이벤트 풀.
 * - triggers로 어떤 행동 뒤에 뜰 수 있는지 제한.
 * - condition으로 상황(팔로워 규모, 도덕성 등)에 맞는 이벤트만 후보로.
 */
export const GAME_EVENTS: GameEvent[] = [
  // ── 오프라인 계열 ────────────────────────────────
  {
    id: "street_interview",
    emoji: "",
    title: "길거리 인터뷰 요청",
    description: "외출 중 방송국 리포터가 즉석 인터뷰를 요청했다. 카메라 앞에 서볼까?",
    triggers: ["offline"],
    choices: [
      {
        label: "당당하게 인터뷰한다",
        effect: { mental: -5, followers: 40, skills: { sociability: 15 } },
        result: "방송을 본 사람들이 계정을 찾아왔다! 팔로워가 늘었다.",
      },
      {
        label: "부끄러워 도망친다",
        effect: { mental: +3 },
        result: "그래도 마음은 편하다. 다음 기회에...",
      },
    ],
  },
  {
    id: "lost_wallet",
    emoji: "",
    title: "길에 떨어진 지갑",
    description: "인도 한복판에 지갑이 떨어져 있다. 주변엔 아무도 없다.",
    triggers: ["offline"],
    choices: [
      {
        label: "경찰서에 가져다준다",
        effect: { action: -5, morality: +10 },
        result: "주인을 찾아줬다. 뿌듯함에 도덕성이 올랐다.",
      },
      {
        label: "돈만 챙긴다",
        effect: { morality: -15, money: 300 },
        result: "찜찜하지만 지갑 속 현금을 챙겼다. 도덕성이 크게 떨어졌다.",
      },
    ],
  },
  {
    id: "gym_trainer",
    emoji: "",
    title: "헬스 트레이너의 제안",
    description: "체육관에서 트레이너가 무료 자세 교정을 해주겠다고 한다.",
    triggers: ["offline"],
    choices: [
      {
        label: "제대로 배운다",
        effect: { action: -10, skills: { fitness: 30, beauty: 10 } },
        result: "자세가 교정되어 운동 효율이 크게 올랐다!",
      },
      {
        label: "괜찮다고 사양한다",
        effect: {},
        result: "혼자 하던 대로 마무리했다.",
      },
    ],
  },

  // ── 트윗 계열 ────────────────────────────────
  {
    id: "viral_tweet",
    emoji: "",
    title: "떡상! 트윗이 터졌다",
    description: "방금 올린 트윗이 알고리즘을 타고 급속도로 퍼지고 있다!",
    triggers: ["tweet"],
    weight: 0.7,
    condition: hasFollowers(30),
    choices: [
      {
        label: "이때다 싶어 프로필을 정비한다",
        effect: { followersPct: 25, mental: -5 },
        result: "유입 폭발! 팔로워가 25% 급증했다.",
      },
      {
        label: "그냥 지켜본다",
        effect: { followersPct: 12 },
        result: "자연스럽게 팔로워가 늘었다.",
      },
    ],
  },
  {
    id: "flame_war",
    emoji: "",
    title: "악플러 등장",
    description: "한 계정이 당신의 트윗에 시비를 걸며 언쟁을 유도하고 있다.",
    triggers: ["tweet"],
    choices: [
      {
        label: "받아쳐서 논파한다",
        effect: { mental: -15, followers: 25, skills: { vocabulary: 10 } },
        result: "사이다 발언에 구경꾼들이 팔로우했다! 하지만 진이 빠졌다.",
      },
      {
        label: "차단하고 무시한다",
        effect: { mental: -3, morality: +3 },
        result: "깔끔하게 차단. 멘탈을 지켰다.",
      },
    ],
  },
  {
    id: "screenshot_leak",
    emoji: "",
    title: "과거 트윗 박제",
    description: "예전에 올린 아슬아슬한 트윗이 캡처되어 돌아다니기 시작했다.",
    triggers: ["tweet", "explore"],
    condition: moralityBelow(40),
    choices: [
      {
        label: "쿨하게 인정하고 사과한다",
        effect: { mental: -8, followers: -30, morality: +5 },
        result: "일부는 떠났지만 진정성 있는 태도로 수습했다.",
      },
      {
        label: "계정을 잠그고 잠수탄다",
        effect: { mental: -12, followersPct: -15 },
        result: "논란은 커졌고 팔로워가 대거 이탈했다.",
      },
    ],
  },

  // ── SNS/탐색·수익화 계열 ────────────────────────────────
  {
    id: "brand_deal",
    emoji: "",
    title: "협찬 제안 DM",
    description: "한 브랜드에서 제품 홍보 트윗을 조건으로 협찬을 제안했다.",
    triggers: ["explore", "tweet", "day"],
    condition: hasFollowers(500),
    choices: [
      {
        label: "협찬을 수락한다",
        effect: { money: 1500, followers: -20, morality: -3 },
        result: "광고 트윗으로 수익을 얻었다. 일부 팔로워는 아쉬워한다.",
      },
      {
        label: "정중히 거절한다",
        effect: { morality: +5, followers: 10 },
        result: "진정성을 지킨 당신에게 팔로워들이 호감을 보였다.",
      },
    ],
  },
  {
    id: "collab_offer",
    emoji: "",
    title: "합방 제안",
    description: "비슷한 결의 계정이 함께 콘텐츠를 만들자고 제안해왔다.",
    triggers: ["explore", "day"],
    condition: hasFollowers(200),
    choices: [
      {
        label: "합방을 진행한다",
        effect: { action: -10, followers: 120, skills: { sociability: 20 } },
        result: "서로의 팬층이 유입되어 팔로워가 크게 늘었다!",
      },
      {
        label: "지금은 사양한다",
        effect: {},
        result: "다음 기회를 기약했다.",
      },
    ],
  },
  {
    id: "fake_follower_ad",
    emoji: "",
    title: "팔로워 구매 광고",
    description: "'팔로워 1만명 즉시 충전!' 이라는 수상한 광고가 떴다.",
    triggers: ["ad", "explore"],
    choices: [
      {
        label: "돈 주고 구매한다",
        effect: { money: -500, followers: 300, morality: -10 },
        result: "숫자는 늘었지만 유령 계정뿐... 뒷맛이 씁쓸하다.",
        requires: (s) => s.money >= 500,
      },
      {
        label: "사기 같아 무시한다",
        effect: { morality: +2 },
        result: "역시 정도가 최고. 무시했다.",
      },
    ],
  },

  // ── 범용(아무 행동 뒤에나) ────────────────────────────────
  {
    id: "trend_wave",
    emoji: "",
    title: "실시간 트렌드 발생",
    description:
      "오늘의 인기 카테고리 중 하나가 실시간 트렌드로 떠올랐다. 편승해볼까?\n" +
      "(내 계정 색과 잘 맞는 트렌드면 팔로워가 늘지만, 안 맞으면 오히려 빠진다)",
    triggers: ["tweet", "explore", "day"],
    choices: [
      {
        label: "트렌드에 편승한다",
        effect: { action: -5, customKey: "trendWave" },
        result: "트렌드에 편승했다.",
      },
      {
        label: "내 페이스를 지킨다",
        effect: { mental: +3 },
        result: "휩쓸리지 않고 내 콘텐츠에 집중했다.",
      },
    ],
  },
  {
    id: "burnout",
    emoji: "",
    title: "번아웃 경고",
    description: "쉬지 않고 달렸더니 손끝이 무겁다. 정신력이 바닥이다.",
    triggers: ["tweet", "explore", "offline"],
    condition: (s) => s.resources.mental < 25,
    choices: [
      {
        label: "하루 푹 쉰다",
        effect: { mental: +40, action: +20 },
        result: "충분한 휴식으로 컨디션을 회복했다.",
      },
      {
        label: "그래도 버틴다",
        effect: { mental: -5, followers: 15 },
        result: "무리해서 성과는 냈지만 몸이 상했다...",
      },
    ],
  },
  {
    id: "coworker_follow_request",
    emoji: "",
    title: "동료의 팔로우 요청",
    description:
      "회사 동료가 'SNS 하신다면서요? 계정 좀 알려주세요~' 하며 트위터 계정을 물어왔다.",
    triggers: ["day"],
    weight: 0.8,
    condition: (s) => s.employment != null,
    choices: [
      {
        label: "계정을 알려준다",
        effect: { customKey: "coworkerFollow" },
        result: "",
      },
      {
        label: "SNS는 안 한다고 둘러댄다",
        effect: { mental: -2 },
        result: "괜히 긁어 부스럼 만들 필요 없지. 안 한다고 얼버무렸다.",
      },
    ],
  },
  {
    id: "coin_pump",
    emoji: "",
    title: "급등 종목 제보",
    description:
      "'이 종목 지금 사면 무조건 오릅니다!' 출처 불명의 급등 제보가 돌발로 떴다. 현금의 30%를 태워볼까? (50% 대박, 50% 손실)",
    triggers: ["explore", "ad", "day"],
    weight: 0.7,
    choices: [
      {
        label: "지른다 (현금 30% 투자)",
        effect: { customKey: "coinPump" },
        result: "",
        requires: (s) => s.money >= 3000,
      },
      {
        label: "손대지 않는다",
        effect: { mental: +2 },
        result: "괜히 도박했다 물리면 답도 없지. 조용히 넘겼다.",
      },
    ],
  },
  {
    id: "company_dinner",
    emoji: "",
    title: "단체 회식",
    description: "부서 전체 회식이 잡혔다. '다들 빠지지 말고 참석하라'는 분위기다. 어떻게 할까?",
    triggers: ["day"],
    weight: 0.8,
    condition: (s) => s.employment != null,
    choices: [
      {
        label: "참석한다 (저녁 시간·정신력 소모)",
        effect: { customKey: "companyDinner" },
        result: "",
      },
      {
        label: "핑계 대고 불참한다",
        effect: { reputation: -8, mental: +3 },
        result: "몸이 안 좋다며 빠졌다. 편하긴 한데, 안 왔다고 뒷말이 도는 모양이다.",
      },
    ],
  },
  {
    id: "account_hack",
    emoji: "",
    title: "계정 해킹",
    description:
      "누군가 계정을 탈취해 비밀번호를 바꿔버렸다! 해커가 '돈을 보내면 돌려주겠다'며 협박한다.",
    triggers: ["day", "explore"],
    choices: [
      {
        label: "돈을 보내 되찾으려 한다 (50% 성공)",
        effect: { customKey: "hackRansom" },
        result: "",
        requires: (s) => s.money >= 3000,
      },
      {
        label: "요구를 거절한다",
        effect: { followersPct: -10, mental: -8 },
        result: "협박에 굴하지 않았다. 다만 계정을 되찾는 동안 스팸 피해로 팔로워가 빠졌다.",
      },
    ],
  },
  {
    id: "street_casting",
    emoji: "",
    title: "길거리 캐스팅",
    description:
      "외출 중 한 기획사 관계자가 명함을 건네며 '한번 제대로 키워보고 싶다'고 캐스팅을 제안했다.",
    triggers: ["offline"],
    condition: (s) => s.skills.beauty >= 400,
    choices: [
      {
        label: "명함을 받고 미팅한다",
        effect: { followers: 60, mental: +4, skills: { beauty: 10, sociability: 10 } },
        result:
          "미팅에서 좋은 인상을 남겼다. 관계자가 SNS를 홍보해줘 팔로워가 늘고 자신감도 붙었다.",
      },
      {
        label: "사양하고 갈 길 간다",
        effect: { mental: +2 },
        result: "괜히 엮이기 싫어 정중히 사양했다.",
      },
    ],
  },
  {
    id: "lottery",
    emoji: "",
    title: "복권 판매점",
    description:
      "집 앞 복권 판매점을 지난다. '이번 주 1등 이 자리에서!' 현수막이 펄럭인다. 한 장 긁어볼까?",
    triggers: ["offline", "day"],
    weight: 0.6,
    choices: [
      {
        label: "한 장 산다 (1,000원)",
        effect: { customKey: "lottery" },
        result: "",
        requires: (s) => s.money >= 1000,
      },
      {
        label: "돈 아깝다, 지나친다",
        effect: {},
        result: "복권은 무슨. 그 돈으로 커피나 마시자.",
      },
    ],
  },
  {
    id: "injury_illness",
    emoji: "",
    title: "몸살과 부상",
    description: "무리한 탓인지 몸이 천근만근이다. 열도 나고 삭신이 쑤신다. 어떡하지?",
    triggers: ["offline", "day"],
    weight: 0.7,
    condition: (s) => s.resources.action < 40,
    choices: [
      {
        label: "병원에 간다 (치료비 3만원)",
        effect: { money: -30000, action: +25, mental: +8 },
        result: "병원에서 진료받고 약을 지어왔다. 치료비는 아프지만 몸은 한결 가벼워졌다.",
        requires: (s) => s.money >= 30000,
      },
      {
        label: "그냥 앓아눕는다",
        effect: { action: -10, mental: -12, followers: -10 },
        result: "약도 없이 끙끙 앓았다. 며칠 손 놓은 사이 계정도 시들해졌다.",
      },
    ],
  },

  // ── 성인(계정 성인물 해제 필요) ────────────────────────────────
  {
    id: "adult_awakening",
    emoji: "",
    title: "성인계로의 첫발",
    description:
      "은근한 수위의 게시글에 반응이 심상치 않다. 이 길로 제대로 발을 들이면 완전히 새로운 판이 열릴 것 같은데...",
    triggers: ["tweet", "explore"],
    weight: 0.8,
    condition: all(
      adultOn,
      (s) => !getActiveAccount(s).unlockedAttributes.includes("adult"),
    ),
    choices: [
      {
        label: "제대로 발을 들인다",
        effect: { morality: -5, skills: { lewd: 25 }, unlockAttribute: "adult" },
        result: "돌이킬 수 없는 선을 넘었다. 이제 성인계 콘텐츠로 승부를 볼 수 있다.",
      },
      {
        label: "아직은 아니다",
        effect: { mental: +3, morality: +2 },
        result: "호기심은 접어두기로 했다. 지금은 내 페이스를 지킨다.",
      },
    ],
  },
  {
    id: "secret_sponsor",
    emoji: "",
    title: "은밀한 후원 제안 DM",
    description:
      "한 팬이 '개인적으로 은밀한 콘텐츠를 보내주면 두둑이 후원하겠다'며 DM을 보내왔다.",
    triggers: ["explore", "day"],
    condition: adultOn,
    choices: [
      {
        label: "몰래 거래한다",
        effect: { money: 900, followers: 10, morality: -8, skills: { lewd: 15 } },
        result: "은밀한 거래로 두둑한 후원금을 챙겼다. 뒷맛은 찜찜하지만 지갑은 두둑해졌다.",
      },
      {
        label: "정중히 거절한다",
        effect: { reputation: +4, mental: +2 },
        result: "선을 지켰다. 떳떳함이 남았다.",
      },
    ],
  },
  {
    id: "nsfw_slip",
    emoji: "",
    title: "수위 조절 실패",
    description: "실수로 예정보다 훨씬 수위 높은 사진을 올려버렸다. 이미 리트윗이 돌기 시작했다!",
    triggers: ["tweet"],
    condition: adultOn,
    choices: [
      {
        label: "이왕 이렇게 된 거 그냥 둔다",
        effect: { followersPct: 15, reputation: -6, morality: -3, skills: { lewd: 10 } },
        result: "폭발적으로 퍼지며 팔로워가 급증했다. 다만 점잖던 몇몇은 등을 돌렸다.",
      },
      {
        label: "서둘러 삭제한다",
        effect: { followers: -8, mental: -4 },
        result: "재빨리 지웠지만 이미 캡처한 사람들이... 진땀만 뺐다.",
      },
    ],
  },
  {
    id: "live_request",
    emoji: "",
    title: "즉석 라이브 요청",
    description: "시청자들이 지금 당장 수위 있는 라이브 방송을 켜달라며 후원을 쏟아붓고 있다.",
    triggers: ["explore", "tweet"],
    condition: all(adultOn, (s) => s.skills.lewd >= 200),
    choices: [
      {
        label: "과감하게 방송을 켠다",
        effect: { followers: 45, money: 400, mental: -6, morality: -4, skills: { lewd: 20 } },
        result: "아슬아슬한 라이브에 채팅과 후원이 폭발했다! 팔로워도 후원금도 두둑이 챙겼다.",
      },
      {
        label: "다음 기회로 미룬다",
        effect: { mental: +3 },
        result: "지금은 무리하지 않기로 했다. 아쉬워하는 반응이 이어졌다.",
      },
    ],
  },
  {
    id: "paid_shoot",
    emoji: "",
    title: "성인 화보 촬영 섭외",
    description: "한 업체가 성인 화보 촬영을 제안하며 두둑한 섭외비를 불렀다.",
    triggers: ["ad", "day"],
    condition: all(adultOn, hasFollowers(500)),
    choices: [
      {
        label: "촬영을 수락한다",
        effect: { money: 1500, followers: 30, morality: -8, skills: { lewd: 25, beauty: 10 } },
        result: "전문 스튜디오에서 화보를 찍었다. 섭외비도 두둑했고, 결과물이 화제가 되며 팔로워도 늘었다.",
      },
      {
        label: "부담스러워 거절한다",
        effect: { morality: +3 },
        result: "아직은 카메라 앞에 그렇게까지 설 자신이 없다. 정중히 거절했다.",
      },
    ],
  },
  {
    id: "outdoor_shoot",
    emoji: "",
    title: "야외 노출 촬영 도전",
    description:
      "인적 드문 골목, 지금이라면 아무도 없다. 아슬아슬한 야외 촬영을 감행해볼까? " +
      "대박이 날 수도, 누군가에게 딱 걸릴 수도 있다.",
    triggers: ["offline"],
    condition: all(adultOn, (s) => s.skills.lewd >= 250),
    choices: [
      {
        label: "과감하게 촬영을 감행한다",
        effect: { customKey: "outdoorShoot" },
        result: "",
      },
      {
        label: "위험하니 그만둔다",
        effect: { mental: +2 },
        result: "괜히 위험을 무릅쓸 필요는 없지. 조용히 발길을 돌렸다.",
      },
    ],
  },
  {
    id: "worn_clothes_sale",
    emoji: "",
    title: "중고 착용품 판매 제안",
    description: "한 사람이 '입던 옷을 그대로 팔지 않겠냐'며 웃돈을 얹어 은근한 제안을 보내왔다.",
    triggers: ["explore", "day"],
    condition: adultOn,
    choices: [
      {
        label: "몰래 판매한다",
        effect: { money: 700, morality: -6, skills: { lewd: 5 } },
        result: "은밀하게 거래를 마쳤다. 생각보다 쏠쏠한 부수입이 됐지만, 뒷맛은 묘하다.",
      },
      {
        label: "선을 넘는 것 같아 거절한다",
        effect: { morality: +3, mental: +1 },
        result: "아무리 그래도 그건 좀... 정중히 거절했다.",
      },
    ],
  },
  {
    id: "swing_party",
    emoji: "",
    title: "스와핑 파티 초대",
    description:
      "그룹 플레이로 알게 된 지인이 은밀한 스와핑 파티에 초대했다. 파트너를 바꿔가며 즐기는 자리라고 한다.",
    triggers: ["explore", "day"],
    condition: all(adultOn, (s) => getActiveAccount(s).groupUnlocked),
    choices: [
      {
        label: "호기심에 참가한다",
        effect: { followers: 50, mental: +4, morality: -12, skills: { lewd: 40 } },
        result:
          "짜릿하고 아찔한 밤이었다. 은밀한 소문이 퍼지며 계정이 달아올랐고, 새로운 세계에 한층 더 깊이 발을 들였다.",
      },
      {
        label: "그건 아닌 것 같아 거절한다",
        effect: { mental: +2, morality: +4 },
        result: "선을 긋기로 했다. 호기심은 접어두는 게 낫겠다.",
      },
    ],
  },
  {
    id: "paid_channel_open",
    emoji: "",
    title: "유료 구독 채널 개설 제안",
    description:
      "플랫폼에서 '충성 팬을 위한 유료 구독 채널을 열어보라'고 제안했다. 개설하면 매달 구독료가 정산된다(음란도가 높을수록 수익↑).",
    triggers: ["explore", "day"],
    condition: all(adultOn, (s) => !s.paidChannelJoined),
    choices: [
      {
        label: "채널을 개설한다",
        effect: { customKey: "openPaidChannel" },
        result: "",
      },
      {
        label: "지금은 안 한다",
        effect: {},
        result: "아직은 무료로 팬들과 소통하는 게 낫겠다.",
      },
    ],
  },
];
