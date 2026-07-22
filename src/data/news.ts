/**
 * 내 트윗이 기사화 — 언론사명·헤드라인 템플릿·밸런스 상수.
 * 판정은 systems/news가 한다. 실존 언론사/인물 패러디 금지.
 */

/** 떡상 시 기사화 예약 확률. */
export const NEWS_CHANCE = 0.25;
/** 예약된 기사가 왜곡 보도일 확률(나머지는 정상). */
export const NEWS_DISTORT_RATE = 0.4;
/** 정상 보도 2차 유입 = gain × 이 값. */
export const NEWS_BOOST_RATE = 0.5;
/** 왜곡 [해명] 성공 시 동정 유입 = gain × 이 값. */
export const NEWS_CLARIFY_RATE = 0.2;
/** 왜곡 [무시] 시 손실 = gain × 이 값. */
export const NEWS_IGNORE_LOSS_RATE = 0.15;
/** 왜곡 [해명]이 역풍날 확률(추가 손실 + 논란). */
export const NEWS_BACKFIRE_CHANCE = 0.2;

/** 언론사 패러디명(실존 금지). */
export const NEWS_OUTLETS: string[] = [
  "데일리트짹", "스포츠서울숲", "짹짹일보", "인터넷연예뉴스", "오늘의짹",
];

/** 정상 헤드라인 템플릿. {snippet}=트윗 발췌. */
export const NEWS_HEADLINES_NORMAL: string[] = [
  "네티즌 A씨의 '{snippet}' 게시물, 온라인서 화제",
  "\"{snippet}\"… SNS 달군 한 줄에 누리꾼 폭발적 공감",
  "화제의 트윗 '{snippet}', 하루 만에 수만 회 공유",
];

/** 왜곡 헤드라인 템플릿(문맥 잘림). */
export const NEWS_HEADLINES_DISTORTED: string[] = [
  "[단독] '{snippet}' 발언 논란… 진의 두고 갑론을박",
  "\"{snippet}\"… 부적절 발언 도마 위, 누리꾼 갑론을박",
  "'{snippet}' 트윗에 시끌… \"실망\" vs \"오해\"",
];
