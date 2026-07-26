import type { AttributeId } from "@/core/types";

/**
 * 네이놈 실시간 검색어(실검) 토픽 풀.
 * 매일 이 풀에서 일부를 뽑아 포털 실검 TOP 10을 구성한다(systems/trends.ts ensureTrendBoard).
 * 각 topic은 AttributeId 1종에 매핑되며, 그 카테고리로 트윗을 게시하면 팔로워 부스트가 붙는다.
 *
 * ⚠️ 파일명 주의: `data/trends.ts`는 이미 기존 "오늘의 인기 카테고리" 기능
 * (getTrendingCategories/isTrending/TRENDING_MULTIPLIER, TREND_POOL: AttributeId[])이
 * 점유 중이라 이름이 충돌한다. 그래서 이 신규 실검 토픽 풀은 별도 파일(trendTopics.ts)에 둔다.
 * `systems/trends.ts`의 import 경로를 `@/data/trends` → `@/data/trendTopics`로 맞춰야 연결된다.
 *
 * ⚠️ 전부 패러디 — 실존 인물·브랜드·기관 이름 금지.
 */
export interface TrendTopic {
  id: string;
  keyword: string;
  attr: AttributeId;
}

export const TREND_POOL: TrendTopic[] = [
  // politics
  { id: "trend_election_d30", keyword: "총선 D-30", attr: "politics" },
  { id: "trend_budget_pass", keyword: "예산안 새벽 본회의 통과", attr: "politics" },
  { id: "trend_mayor_debate", keyword: "시장 후보 토론회 실언 논란", attr: "politics" },

  // idol
  { id: "trend_idol_dating", keyword: "아이돌 유하린 열애설 인정", attr: "idol" },
  { id: "trend_idol_comeback", keyword: "걸그룹 루미너스 컴백 티저 공개", attr: "idol" },
  { id: "trend_idol_breakup", keyword: "인기 아이돌 커플 결별설", attr: "idol" },

  // actor
  { id: "trend_actor_denial", keyword: "배우 강도진 열애설 소속사 부인", attr: "actor" },
  { id: "trend_drama_ending", keyword: "화제 드라마 결말 논란", attr: "actor" },

  // anime
  { id: "trend_anime_hot", keyword: "신작 애니 3화 전개 폭발적 반응", attr: "anime" },
  { id: "trend_manga_end", keyword: "인기 만화 완결 임박설", attr: "anime" },

  // gaming
  { id: "trend_game_server", keyword: "신작 게임 서버 터짐", attr: "gaming" },
  { id: "trend_esports_upset", keyword: "e스포츠 결승 대이변", attr: "gaming" },

  // food
  { id: "trend_food_ad", keyword: "먹방 유튜버 뒷광고 논란", attr: "food" },
  { id: "trend_bungeoppang", keyword: "붕어빵 한 마리 가격 논쟁", attr: "food" },

  // beauty
  { id: "trend_padding_rush", keyword: "겨울 신상 패딩 대란", attr: "beauty" },
  { id: "trend_cosmetic_sale", keyword: "화장품 브랜드 세일 오픈런", attr: "beauty" },

  // humor
  { id: "trend_slang_eokten", keyword: "신조어 '억텐' 뜻 검색 폭주", attr: "humor" },
  { id: "trend_meme_revival", keyword: "밈짤 '반박시 니말이 맞음' 역주행", attr: "humor" },

  // it
  { id: "trend_phone_preorder", keyword: "신형 스마트폰 사전예약 서버 마비", attr: "it" },
  { id: "trend_ai_glitch", keyword: "인공지능 챗봇 오류 대란", attr: "it" },

  // fitness
  { id: "trend_gym_open", keyword: "헬스장 연초 오픈런 대란", attr: "fitness" },

  // info
  { id: "trend_side_job", keyword: "부업 정보 유튜브 조회수 폭발", attr: "info" },

  // dog
  { id: "trend_dog_kinder", keyword: "강아지 유치원 대기 3개월 대란", attr: "dog" },

  // cat
  { id: "trend_cat_feeder", keyword: "길고양이 급식소 설치 논란", attr: "cat" },

  // animal
  { id: "trend_zoo_baby", keyword: "동물원 아기 동물 공개 인파", attr: "animal" },

  // plant
  { id: "trend_plant_price", keyword: "반려식물 희귀종 가격 폭등", attr: "plant" },

  // cooking
  { id: "trend_mealkit_soldout", keyword: "밀키트 신제품 출시 5분 완판", attr: "cooking" },

  // daily
  { id: "trend_subway_delay", keyword: "출근길 지하철 고장 대란", attr: "daily" },
];
