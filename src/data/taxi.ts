/**
 * 택시 기사직 콘텐츠 — 요금 상수와 승객 응대 이벤트.
 *
 * 규칙(요금 계산·평점 반영)은 `systems/taxi.ts`가 소유한다. 여기는 **무엇을**만 선언한다.
 */

/** 택시회사 이름(패러디). 이 세계에 실존 업체는 없다. */
export const TAXI_COMPANY = "달빛운수";

/** 지원에 필요한 자격증 id — `data/certifications.ts`의 1종 보통. */
export const TAXI_REQ_CERT = "driver_1";
/** 모범택시 승격 자격증 id — 1종 대형. */
export const TAXI_DELUXE_CERT = "driver_large";

/** 운행 1회 기본 요금(평점·시간대 배율 전). */
export const TAXI_BASE_FARE = 42_000;

/**
 * 심야 운행 할증.
 *
 * ⚠️ **이 값이 이 직업의 존재 이유다.** 심야는 트윗 도달 배율이 가장 높은 슬롯이라
 *    (`data/timing.ts` SLOT_TIMING_MULTIPLIERS: 낮 1.0 · 심야 1.25, 토요일이면 1.5),
 *    심야에 운행한다는 건 그날의 제일 좋은 게시 시간을 파는 것이다.
 *    할증이 그 손해보다 작으면 아무도 심야에 안 뛰고, 너무 크면 낮 운행이 죽는다.
 */
export const TAXI_NIGHT_MULTIPLIER = 1.6;

/** 모범택시(1종 대형 보유) 요금 배율. */
export const TAXI_DELUXE_MULTIPLIER = 1.35;

/** 운행 1회 행동력 소모 — `systems/offline.ts`의 활동 정의와 값을 맞춰야 한다. */
export const TAXI_ACTION_COST = 14;

/* ─────────────────── 평점 ─────────────────── */

/** 입사 시 평점(0~100). 중립에서 시작한다. */
export const TAXI_RATING_START = 50;

/**
 * 평점 → 요금 배율의 양 끝(평점 0 → MIN, 100 → MAX).
 * 폭을 좁게 잡은 건 의도다 — 평점이 수입을 **좌우**하면 승객 이벤트 한 번의 실수가
 * 너무 오래 아프다. 체감되되 복구 가능한 선이다.
 */
export const TAXI_RATING_FARE_MIN = 0.8;
export const TAXI_RATING_FARE_MAX = 1.3;

/** 평점 구간 라벨(내림차순). UI가 숫자 대신 이 문구를 쓴다. */
export const TAXI_RATING_TIERS: readonly { min: number; label: string }[] = [
  { min: 85, label: "별 다섯 기사님" },
  { min: 65, label: "평이 좋은 기사" },
  { min: 40, label: "무난한 기사" },
  { min: 20, label: "불만이 쌓인 기사" },
  { min: 0, label: "배차가 안 잡히는 기사" },
];

/* ─────────────────── 승객 이벤트 ─────────────────── */

/** 승객 응대 선택 하나. */
export interface TaxiChoice {
  /** 버튼에 깔리는 내 대응 */
  label: string;
  /** 고른 뒤 뜨는 결과 문구 */
  result: string;
  /** 평점 증감(0~100 스케일) */
  rating: number;
  /** 이번 운행 요금 배율(팁·할인·미터기 조작 등). 1이면 그대로 */
  fareMul?: number;
  /** 정신력 증감(0~100 스케일) */
  mental?: number;
  /** 도덕성 증감(0~100 스케일) */
  morality?: number;
}

/** 운행 중 뜨는 승객 상황. */
export interface TaxiPassenger {
  id: string;
  /** 상황 묘사(2~3문장) */
  text: string;
  /** 심야에만 뜨는 상황이면 true(취객 등) */
  nightOnly?: boolean;
  choices: TaxiChoice[];
}

/**
 * 승객 상황 풀.
 *
 * ⚠️ 선택지는 **양날이어야 한다.** 평점을 올리는 쪽엔 대가(정신력·요금)를,
 *    돈을 버는 쪽엔 평점·도덕성 비용을 붙인다. 한쪽이 항상 정답이면 고를 이유가 없다.
 */
export const TAXI_PASSENGERS: readonly TaxiPassenger[] = [
  {
    id: "drunk",
    text:
      "뒷좌석 손님이 안전벨트를 세 번째 풀었다. 노래를 부르다 말고 창문을 내리려 한다.\n" +
      "\"기사님, 저 오늘 진짜 억울한 일이 있었거든요…\"",
    nightOnly: true,
    choices: [
      {
        label: "들어드린다",
        result: "회사 얘기를 이십 분 들었다. 내릴 때 손님이 두 손으로 악수를 청했다.",
        rating: 6,
        mental: -5,
      },
      {
        label: "벨트만 매시라고 한다",
        result: "손님이 입을 다물었다. 남은 길이 조용했다.",
        rating: -2,
      },
      {
        label: "돌려서 세운다",
        result: "\"여기서 내리라고요?\" 실랑이 끝에 손님이 내렸다. 앱에 별 하나가 찍혔다.",
        rating: -12,
        mental: 3,
      },
    ],
  },
  {
    id: "detour",
    text:
      "앞이 막혔다. 우회로가 있는데 요금이 더 나온다.\n" +
      "손님은 창밖만 보고 있다. 말 안 하면 모를 길이다.",
    choices: [
      {
        label: "말하고 우회한다",
        result: "\"그게 빠르면 그렇게 해주세요.\" 미터기가 조금 더 올라갔지만 아무도 불편하지 않았다.",
        rating: 4,
        fareMul: 1.15,
      },
      {
        label: "말없이 우회한다",
        result: "요금을 보고 손님이 잠깐 멈칫했다. 그냥 카드를 내밀었다.",
        rating: -8,
        fareMul: 1.3,
        morality: -4,
      },
      {
        label: "그냥 막힌 길로 간다",
        result: "이십 분을 서 있었다. 손님도 나도 말이 없었다.",
        rating: -1,
        fareMul: 0.85,
        mental: -3,
      },
    ],
  },
  {
    id: "longhaul",
    text:
      "\"기사님, 혹시 지방까지 가능할까요.\"\n" +
      "장거리다. 요금은 크지만 오늘 남은 시간을 통째로 쓴다.",
    choices: [
      {
        label: "간다",
        result: "고속도로에 올랐다. 돌아오는 길은 빈 차였지만 오늘 벌이는 채웠다.",
        rating: 5,
        fareMul: 2.2,
        mental: -6,
      },
      {
        label: "정중히 거절한다",
        result: "\"그러실 수 있죠.\" 손님이 다른 차를 잡았다.",
        rating: -3,
      },
    ],
  },
  {
    id: "shortcut",
    text:
      "손님이 급하다. \"신호 좀 무시하고 가주시면 안 돼요? 늦으면 진짜 큰일 나요.\"\n" +
      "백미러로 보니 정말 얼굴이 하얗다.",
    choices: [
      {
        label: "규정대로 간다",
        result: "\"…네, 알겠습니다.\" 손님은 내내 시계를 봤다. 늦었는지는 모른다.",
        rating: -2,
      },
      {
        label: "조금 무리해서 간다",
        result: "제시간에 내려줬다. 손님이 잔돈을 안 받고 뛰어갔다.",
        rating: 8,
        fareMul: 1.2,
        morality: -3,
        mental: -4,
      },
    ],
  },
  {
    id: "lost_item",
    text:
      "손님이 내린 뒤 뒷좌석에서 지갑을 발견했다.\n" +
      "현금이 꽤 들어 있다. 다음 콜이 벌써 뜨고 있다.",
    choices: [
      {
        label: "돌아가서 돌려준다",
        result: "손님이 뛰어나와 두 번 인사했다. 그날 앱에 긴 후기가 올라왔다.",
        rating: 12,
        fareMul: 0.7,
      },
      {
        label: "회사에 맡긴다",
        result: "분실물 접수를 하고 다음 콜을 받았다. 그게 절차다.",
        rating: 3,
      },
      {
        label: "못 본 걸로 한다",
        result: "지갑은 조수석 아래로 밀어뒀다. 하루 종일 그쪽이 신경 쓰였다.",
        rating: 0,
        fareMul: 1.5,
        morality: -12,
        mental: -6,
      },
    ],
  },
  {
    id: "chatty",
    text:
      "손님이 계속 말을 건다. 자식 얘기, 날씨 얘기, 요즘 젊은 사람들 얘기.\n" +
      "대답을 안 해도 계속된다.",
    choices: [
      {
        label: "맞장구를 친다",
        result: "내릴 때 \"기사님 같은 분 오랜만이에요\"라는 말을 들었다.",
        rating: 7,
        mental: -3,
      },
      {
        label: "적당히 넘긴다",
        result: "손님이 어느 순간 조용해졌다. 라디오 소리만 남았다.",
        rating: 0,
      },
    ],
  },
  {
    id: "vomit",
    text:
      "신호 대기 중에 뒷좌석에서 이상한 소리가 났다.\n" +
      "돌아보니 손님이 입을 막고 있다. 늦었다.",
    nightOnly: true,
    choices: [
      {
        label: "괜찮다고 하고 치운다",
        result: "새벽에 세차장에 들렀다. 손님이 미안하다며 웃돈을 얹었다.",
        rating: 9,
        fareMul: 1.4,
        mental: -10,
      },
      {
        label: "세차비를 청구한다",
        result: "손님이 군말 없이 냈다. 다만 앱 평점은 짰다.",
        rating: -6,
        fareMul: 1.6,
      },
    ],
  },
  {
    id: "no_cash",
    text:
      "도착했는데 손님이 지갑을 뒤진다.\n" +
      "\"…카드가 안 되네요. 현금도 없고. 죄송한데 계좌로 보내드리면 안 될까요?\"",
    choices: [
      {
        // 믿어주는 쪽엔 '덜 받는다'는 대가를 붙인다 — 안 그러면 나머지 두 선택지가 죽는다.
        label: "연락처만 받고 보내준다",
        result:
          "다음 날 아침 입금이 됐다. 요금보다 조금 모자랐다.\n" +
          "\"지금은 이만큼밖에 없어서요. 정말 죄송합니다.\"",
        rating: 6,
        fareMul: 0.75,
      },
      {
        label: "같이 ATM까지 간다",
        result: "십 분을 더 썼지만 요금은 받았다. 손님도 나도 지쳤다.",
        rating: 1,
        mental: -4,
      },
      {
        label: "신고하겠다고 한다",
        result: "손님이 결국 지인에게 전화를 걸어 해결했다. 내리면서 문을 세게 닫았다.",
        rating: -10,
        fareMul: 1.1,
      },
    ],
  },
];
