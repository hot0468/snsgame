import type { AttributeId, GameState, SkillStatId } from "@/core/types";
import { getActiveAccount } from "@/core/state";

/** 이벤트를 발생시킬 수 있는 행동 트리거 */
export type EventTrigger = "offline" | "tweet" | "explore" | "ad" | "day" | "like" | "retweet";

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
    | "lottery"
    | "sponsorDeal"
    | "taxPay"
    | "taxDodge"
    | "whaleOrgy"
    | "blackVanOrgy"
    | "crewGangDrill"
    | "mutualFollowDM";
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
/** 성인물 해제(유저 전역 설정)가 켜져 있어야 함 */
const adultOn = (s: GameState) => s.adultMode;
/** '강압/범죄 안 보기'가 꺼져 있어야 함(비합의 성인 상황 게이트) */
const coercionOk = (s: GameState) => !s.adultNoCoercion;
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
    // brand_deal(500팔로워·소액)의 후반 확대판 — 규모가 커져야 뜨는 '첫 대형 협찬'.
    // 수락 시 목돈이 들어오지만 낮은 확률로 뒷광고 논란(ctrl_paid_promo)이 터진다.
    // 논란 굴림은 데이터로 못 하므로 customKey: "sponsorDeal"이 처리한다(돈·팔로워는 선언형).
    id: "first_big_sponsor",
    title: "첫 대형 협찬 제안",
    description:
      "제법 큰 브랜드의 마케팅팀에서 정식 협찬을 제안해왔다. 단가도 지금까지와는 자릿수가 다르다.",
    triggers: ["tweet", "day"],
    weight: 0.5,
    condition: hasFollowers(10000),
    choices: [
      {
        label: "계약서에 사인한다",
        // 목돈 + 협찬 트윗 노출로 소폭 유입. 그 뒤 customKey가 뒷광고 논란을 낮은 확률로 굴린다.
        effect: { money: 500000, followersPct: 3, customKey: "sponsorDeal" },
        result: "",
      },
      {
        label: "'광고 없는 계정'을 지킨다",
        effect: { reputation: 8, followersPct: 2 },
        result: "돈보다 신뢰를 택한 당신을 두고 '믿고 보는 계정'이라는 말이 돌았다.",
      },
    ],
  },
  {
    id: "collab_offer",
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

  {
    // 후반 돈 싱크 — 협찬·후원 수입이 쌓이면 종합소득세가 날아온다.
    // 세액은 소지금 비례라(선언형으로 못 함) 두 선택지 모두 customKey가 처리한다.
    // 축소 신고는 낮은 확률로 세무조사에 걸려 가산세까지 추징당하는 도박이다.
    id: "tax_bomb",
    title: "종합소득세 신고 안내",
    description:
      "국세청에서 종합소득세 신고 안내문이 날아왔다. 그동안 쌓인 협찬·후원 수입에 세금이 붙는다. 어떻게 신고할까?",
    triggers: ["day"],
    weight: 0.6,
    condition: (s) => s.money >= 500000,
    choices: [
      {
        label: "성실하게 신고·납부한다",
        effect: { customKey: "taxPay" },
        result: "",
      },
      {
        label: "수입을 줄여 신고한다 (적발 시 추징)",
        effect: { customKey: "taxDodge" },
        result: "",
      },
    ],
  },

  // ── 현생(offline) 스탯 게이팅 — 키운 스탯이 현실에서 빛을 본다 ────────
  {
    id: "street_snatch",
    title: "날치기 목격",
    description: "길을 걷는데 오토바이를 탄 날치기가 행인의 가방을 낚아채 달아난다!",
    triggers: ["offline"],
    condition: (s) => s.skills.fitness >= 400,
    choices: [
      {
        label: "쫓아가 제압한다",
        effect: { reputation: 8, followers: 50, mental: -6, skills: { fitness: 10 } },
        result:
          "단련된 몸으로 순식간에 따라잡아 제압했다! 시민 영웅으로 목격담이 퍼지며 계정이 화제가 됐다.",
      },
      {
        label: "괜히 다칠라 못 본 척한다",
        effect: { mental: +2 },
        result: "위험한 일에 끼어들 필요 없지. 못 본 척 발길을 옮겼다.",
      },
    ],
  },
  {
    id: "street_debate",
    title: "길거리 토론 배틀",
    description:
      "광장에서 열변을 토하던 사람이 지나가는 당신을 붙잡고 논쟁을 걸어왔다. 구경꾼이 모여든다.",
    triggers: ["offline"],
    condition: (s) => s.skills.vocabulary >= 350 && s.skills.knowledge >= 350,
    choices: [
      {
        label: "논리로 완벽하게 논파한다",
        effect: { followers: 45, mental: -5, skills: { vocabulary: 15, knowledge: 5 } },
        result:
          "빈틈없는 논리로 상대를 말문 막히게 했다. 구경하던 사람들이 감탄하며 계정을 찾아왔다.",
      },
      {
        label: "말 섞기 싫어 지나친다",
        effect: { mental: +2 },
        result: "굳이 길에서 입씨름할 이유가 없지. 조용히 자리를 떴다.",
      },
    ],
  },
  {
    id: "instant_network",
    title: "즉석 인맥",
    description: "카페 옆자리 사람과 눈이 마주쳤다. 자연스레 말을 트니 대화가 술술 풀린다.",
    triggers: ["offline"],
    condition: (s) => s.skills.sociability >= 400,
    choices: [
      {
        label: "친화력을 발휘해 친해진다",
        effect: { followers: 60, mental: +5, skills: { sociability: 15 } },
        result:
          "특유의 붙임성으로 금세 친해졌다. 알고 보니 인플루언서라 서로 계정을 팔로우하며 팬층이 유입됐다.",
      },
      {
        label: "가볍게 인사만 하고 만다",
        effect: {},
        result: "적당히 인사만 나누고 각자 갈 길을 갔다.",
      },
    ],
  },
  {
    id: "street_busking",
    title: "길거리 버스킹",
    description: "번화가 한켠, 사람들이 모여 있다. 여기서 즉석 개그 한 판 펼쳐볼까?",
    triggers: ["offline"],
    condition: (s) => s.skills.comedy >= 350,
    choices: [
      {
        label: "즉석 만담으로 좌중을 휘어잡는다",
        effect: { followers: 45, mental: +8, skills: { comedy: 15 } },
        result: "던지는 드립마다 빵빵 터졌다! 촬영된 영상이 SNS에 퍼지며 팔로워가 늘었다.",
      },
      {
        label: "괜히 부끄러워 관둔다",
        effect: { mental: +2 },
        result: "사람들 앞에 나서기엔 아직... 슬그머니 자리를 떴다.",
      },
    ],
  },
  {
    id: "flea_market_stall",
    title: "벼룩시장 좌판",
    description: "주말 벼룩시장이 열렸다. 직접 만든 소품을 들고 좌판을 깔아볼까?",
    triggers: ["offline"],
    condition: (s) => s.skills.creativity >= 350,
    choices: [
      {
        label: "손수 만든 굿즈를 판다",
        effect: { money: 80000, mental: -4, skills: { creativity: 10 } },
        result: "정성껏 만든 소품이 제법 팔려나갔다. 쏠쏠한 부수입에 창작 재미도 붙었다.",
      },
      {
        label: "귀찮아서 구경만 한다",
        effect: { mental: +3 },
        result: "남의 좌판만 실컷 구경하다 왔다.",
      },
    ],
  },
  {
    id: "arcade_ranking",
    title: "오락실 랭킹 도전",
    description: "동네 오락실 기계에 전국 랭킹 보드가 붙어 있다. 1위 기록에 도전해볼까?",
    triggers: ["offline"],
    condition: (s) => s.skills.game >= 400,
    choices: [
      {
        label: "동전을 쏟아부어 1위에 도전한다",
        effect: { money: -3000, followers: 40, skills: { game: 15 } },
        result: "손이 보이지 않는 컨트롤로 전국 1위를 갈아치웠다! 인증 영상이 게이머들 사이에 퍼졌다.",
        requires: (s) => s.money >= 3000,
      },
      {
        label: "돈 아깝다, 눈으로만 즐긴다",
        effect: { mental: +2 },
        result: "괜히 동전만 날릴라. 남 플레이나 구경하다 왔다.",
      },
    ],
  },
  {
    id: "kiosk_fix",
    title: "먹통 된 무인점포 키오스크",
    description: "무인 편의점 키오스크가 먹통이 돼 손님들이 발을 동동 구른다. 슬쩍 봐줄까?",
    triggers: ["offline"],
    condition: (s) => s.skills.it >= 350,
    choices: [
      {
        label: "능숙하게 손봐 고쳐준다",
        effect: { reputation: 6, mental: +5, skills: { it: 10 } },
        result: "몇 번 만지니 금방 정상 작동. 지켜보던 사람들이 '금손'이라며 고마워했다.",
      },
      {
        label: "내 일 아니니 지나친다",
        effect: {},
        result: "괜히 건드렸다 책임질라. 그냥 지나쳤다.",
      },
    ],
  },
  {
    id: "luxury_splurge",
    title: "명품샵의 유혹",
    description: "백화점 명품관을 지나는데 점원이 '딱 어울리신다'며 은근슬쩍 지갑을 노린다.",
    triggers: ["offline"],
    condition: (s) => s.money >= 1000000,
    choices: [
      {
        label: "질러버린다 (거금 지출)",
        effect: { money: -500000, mental: +10 },
        result: "눈 딱 감고 카드를 긁었다. 통장은 홀쭉해졌지만 새 명품을 걸치니 기분만은 최고다.",
        requires: (s) => s.money >= 500000,
      },
      {
        label: "이성을 붙잡고 참는다",
        effect: { mental: -5, morality: +2 },
        result: "하마터면 지를 뻔했다. 아쉬움을 삼키며 매장을 빠져나왔다.",
      },
    ],
  },
  {
    // 도덕성 저점 전용 어두운 이벤트(성인 카테고리로 요청) — lost_wallet '돈만 챙기기'의 심화판.
    id: "mugging_temptation",
    title: "삥뜯기 유혹",
    description: "인적 드문 골목, 앞서 걷던 이가 방심한 채 지갑을 흘릴 듯 걷는다. 어두운 충동이 스친다.",
    triggers: ["offline"],
    condition: all(adultOn, moralityBelow(30)),
    choices: [
      {
        label: "약한 상대를 골라 등쳐먹는다",
        effect: { money: 50000, morality: -15, mental: +2 },
        result: "겁을 줘 손쉽게 돈을 뜯어냈다. 죄책감은 옅고 주머니만 두둑해졌다.",
      },
      {
        label: "그래도 사람인데, 참는다",
        effect: { morality: +3, mental: +1 },
        result: "아무리 그래도 선은 넘지 말자. 스치는 충동을 애써 눌렀다.",
      },
    ],
  },

  // ── 좋아요/리트윗 트리거 — 무심코 누른 상호작용이 일을 키운다 ────────
  {
    id: "like_mutual_dm",
    title: "좋아요 알림을 본 상대",
    description: "방금 좋아요를 누른 계정 주인이 알림을 보고 먼저 말을 걸어왔다. 반가운 눈치다.",
    triggers: ["like"],
    weight: 0.7,
    condition: (s) => s.skills.sociability >= 300,
    choices: [
      {
        label: "맞팔하고 친하게 지낸다",
        effect: { followers: 20, skills: { sociability: 10 }, customKey: "mutualFollowDM" },
        result: "",
      },
      {
        label: "그냥 좋아요만 남긴다",
        effect: { mental: +2 },
        result: "굳이 대화까지 트진 않고, 가볍게 좋아요만 남겼다.",
      },
    ],
  },
  {
    id: "rt_misinfo",
    title: "허위정보 리트윗",
    description: "방금 리트윗한 글이 알고 보니 근거 없는 가짜뉴스였다. 지적하는 답글이 달리기 시작한다.",
    triggers: ["retweet"],
    weight: 0.7,
    choices: [
      {
        label: "바로 삭제하고 정정한다",
        effect: { reputation: 5, followers: -10, mental: -4 },
        result: "재빨리 리트윗을 지우고 정정 글을 올렸다. 발 빠른 대처에 신뢰는 지켰다.",
      },
      {
        label: "'뭐 어때' 하고 버틴다",
        effect: { reputation: -8, followersPct: -5, morality: -3 },
        result: "굳이 내리지 않고 버텼다. 가짜뉴스 퍼뜨린 계정으로 찍히며 사람들이 등을 돌렸다.",
      },
    ],
  },
  {
    id: "rt_spam_chain",
    title: "스팸 리트윗 체인",
    description: "'이 글을 리트윗하면 추첨을 통해 상품권 증정!' 수상한 이벤트 계정이 참여를 유도한다.",
    triggers: ["retweet"],
    choices: [
      {
        label: "혹해서 참여한다",
        effect: { followers: 15, reputation: -6, morality: -2 },
        result: "얼떨결에 체인에 동참했다. 타임라인이 스팸으로 도배되며 팔로워는 늘었지만 눈총을 샀다.",
      },
      {
        label: "사기 냄새가 나 무시한다",
        effect: { morality: +2 },
        result: "이런 건 백이면 백 낚시지. 깔끔하게 무시했다.",
      },
    ],
  },
  {
    id: "rt_trap_hookup",
    title: "RT 함정 글",
    description:
      "방금 리트윗한 글이 '실종 제보·긴급 구조'처럼 보였는데, 곧 DM이 온다. " +
      "'RT 고마워요. 제보자 맞죠? 지금 근처인데 잠깐만 나와 주세요. 위치 보냈어요.' " +
      "지도 핀은 외진 상가 뒤편이다.",
    triggers: ["retweet"],
    weight: 0.55,
    condition: all(adultOn, (s) => s.skills.lewd >= 380),
    choices: [
      {
        label: "위치로 나간다",
        effect: { mental: -12, morality: -15, followers: 55, skills: { lewd: 48 } },
        result:
          "상가 뒤에 도착하자 제보자가 아니라 남자 서넛이 서 있었다. 'RT한 거 네가 맞지?' " +
          "말이 끝나기 전에 팔이 잡히고 건물 뒷편 창고로 끌려 들어갔다. 미끼 글은 낚싯바늘이었다. " +
          "좁은 방에서 번갈아 유린당한 뒤 밤에 큰길에 버려지듯 나왔다. 리트윗 버튼이 한동안 두려워졌다.",
      },
      {
        label: "DM만 보고 차단한다",
        effect: { mental: -2, morality: +3 },
        result:
          "위치가 수상해 바로 차단하고 리트윗을 내렸다. 이후 유사 제보 글은 손대지 않기로 했다.",
      },
      {
        label: "캡처해 플랫폼에 신고한다",
        effect: { mental: -1, morality: +4, reputation: +2 },
        result:
          "DM과 원글을 캡처해 신고했다. 처리 메일은 늦었지만, 함정에 몸으로 뛰어들진 않았다.",
      },
    ],
  },

  // ── 성인(계정 성인물 해제 필요) ────────────────────────────────
  {
    id: "adult_awakening",
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
    id: "whale_meetup",
    title: "고액 후원자의 만남 요청",
    description:
      "100만원을 후원한 '큰손'이 DM을 보냈다. 얼굴 한번 보고 싶다며, 조용한 주택으로 초대한다. " +
      "돈은 이미 두둑이 넣어줬다는데...",
    triggers: ["explore", "day"],
    weight: 0.5,
    // 저택 결박·희롱 난교(비합의) — '강압/범죄 안 보기' 켜면 이 이벤트 자체가 후보에서 빠진다.
    condition: all(adultOn, coercionOk, (s) => s.skills.lewd >= 300),
    choices: [
      {
        label: "만나러 간다",
        effect: { customKey: "whaleOrgy" },
        result: "",
      },
      {
        label: "후원만 받고 거절한다",
        effect: { money: 1_000_000, mental: 2 },
        result: "찜찜해서 후원 100만원만 챙기고 만남은 정중히 거절했다.",
      },
    ],
  },
  {
    id: "paid_channel_open",
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
  {
    id: "crew_gang_drill",
    title: "크루 합동 훈련",
    description:
      "크루 단톡에 공지가 떴다. '합동 훈련 — 카메라 OFF, 체력·호흡·교대 감각 점검. 참가 인원만 디엠.' " +
      "겉으로는 합방 리허설이지만, 이미 애프터를 아는 멤버들 사이에서는 다른 의미로 통한다.",
    triggers: ["explore", "day"],
    weight: 0.7,
    condition: all(
      adultOn,
      (s) => s.crewJoined,
      (s) => getActiveAccount(s).groupUnlocked,
      (s) => s.skills.lewd >= 350,
    ),
    choices: [
      {
        label: "합동 훈련에 참가한다",
        effect: { customKey: "crewGangDrill" },
        result: "",
      },
      {
        label: "이번엔 빠져 있는다",
        effect: { mental: +2, morality: +2 },
        result:
          "단톡에 '일정 겹침'이라고만 남겼다. 다음 날 합방 리허설 클립만 공유됐고, 애프터 이야기는 슬쩍 피했다.",
      },
    ],
  },
];
