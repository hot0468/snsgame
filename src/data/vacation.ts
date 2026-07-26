import type { SkillStatId } from "@/core/types";

/**
 * 휴가 이벤트 풀. '휴식' 탭의 '휴가'(1회 10만원) 활동에서 하나가 랜덤 발생한다.
 * 행동력·정신력 회복과 별개로, 여기 이벤트가 특정 세부 스탯을 올린다.
 *
 * ⚠️ 세부 스탯은 0~999 스케일(×5 관례). amount는 +15~25 권장.
 * lewd(음란)는 전연령 휴가라 제외한다 — 새 이벤트도 lewd는 넣지 마라.
 */
export interface VacationEvent {
  /** 이 이벤트로 오르는 세부 스탯 */
  stat: SkillStatId;
  /** 상승량(세부 스탯은 0~999 스케일 · ×5 관례 → +15~25 권장) */
  amount: number;
  /** 결과 팝업에 뜨는 휴가 경험 문구(1인칭·다녀온 톤) */
  message: string;
}

export const VACATION_EVENTS: VacationEvent[] = [
  // fitness (운동) ×2
  {
    stat: "fitness",
    amount: 22,
    message: "지리산 종주에 도전했다. 셋째 날엔 다리가 알아서 산을 오르더라.",
  },
  {
    stat: "fitness",
    amount: 18,
    message: "제주 해안도로를 자전거로 한 바퀴 돌았더니 종아리가 단단해졌다.",
  },

  // beauty (미용) ×2
  {
    stat: "beauty",
    amount: 20,
    message: "온천 리조트에서 사흘 내내 반신욕을 했더니 피부가 반질반질해졌다.",
  },
  {
    stat: "beauty",
    amount: 16,
    message: "스파에서 전신 관리를 받고 나왔다. 거울 속 얼굴이 낯설 만큼 화사했다.",
  },

  // vocabulary (어휘력) ×2
  {
    stat: "vocabulary",
    amount: 20,
    message: "산속 북스테이에서 소설 다섯 권을 내리 읽었다. 문장이 머릿속에 쌓였다.",
  },
  {
    stat: "vocabulary",
    amount: 17,
    message: "필사 워크숍에 참가해 명문장을 손으로 옮겨 적었다. 표현이 손끝에 붙었다.",
  },

  // knowledge (지식) ×2
  {
    stat: "knowledge",
    amount: 23,
    message: "동남아 배낭여행에서 도시마다 박물관을 훑었다. 세상이 조금 넓어졌다.",
  },
  {
    stat: "knowledge",
    amount: 18,
    message: "전국 맛집투어를 돌며 지역 향토음식의 유래를 하나하나 캐물었다.",
  },

  // sociability (친화력) ×2
  {
    stat: "sociability",
    amount: 21,
    message: "게스트하우스 파티에서 처음 본 사람들과 밤새 떠들었다. 낯가림이 녹았다.",
  },
  {
    stat: "sociability",
    amount: 18,
    message: "여름 페스티벌 잔디밭에서 옆자리 일행과 어울려 떼창을 했다.",
  },

  // comedy (개그) ×2
  {
    stat: "comedy",
    amount: 20,
    message: "소극장 코미디쇼 맨 앞줄에 앉았다. 애드리브의 타이밍을 눈으로 훔쳐 배웠다.",
  },
  {
    stat: "comedy",
    amount: 16,
    message: "개그 페스티벌을 하루 종일 봤더니 웃음 포인트 잡는 감이 생겼다.",
  },

  // creativity (창작) ×2
  {
    stat: "creativity",
    amount: 22,
    message: "미술관 특별전을 천천히 돌았다. 색과 구도가 머릿속에서 계속 맴돌았다.",
  },
  {
    stat: "creativity",
    amount: 18,
    message: "시골 도예 공방에서 물레를 돌려 그릇을 빚었다. 손으로 만드는 재미를 알았다.",
  },

  // game (게임) ×2
  {
    stat: "game",
    amount: 21,
    message: "e스포츠 결승전을 직관했다. 프로들의 운영을 보며 감이 확 트였다.",
  },
  {
    stat: "game",
    amount: 17,
    message: "레트로 오락실 원정을 떠나 하루 종일 고전 게임을 클리어했다.",
  },

  // it (IT) ×2
  {
    stat: "it",
    amount: 22,
    message: "개발자 컨퍼런스 투어를 돌며 최신 기술 세션을 몰아 들었다.",
  },
  {
    stat: "it",
    amount: 18,
    message: "바닷가 코워킹 스페이스에서 디지털 노마드들과 사이드 프로젝트를 붙잡았다.",
  },

  // otaku (덕질) ×2
  {
    stat: "otaku",
    amount: 21,
    message: "코믹콘에 원정을 갔다. 굿즈 부스를 순례하며 지갑과 함께 덕심을 불태웠다.",
  },
  {
    stat: "otaku",
    amount: 17,
    message: "최애 작품의 배경이 된 마을로 성지순례를 다녀왔다. 장면마다 소름이 돋았다.",
  },
];
