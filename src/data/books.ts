/**
 * 미디북스(가상의 전자책 스토어)에 뜨는 도서 데이터.
 * 실제 도서/저자와 무관한 창작(패러디) 데이터다.
 */

/** 책 종류 — 감상 시 오르는 관련 스탯이 다르다 */
export type BookCategory = "culture" | "novel" | "comic" | "cooking" | "adult";

export const BOOK_CATEGORY_LABEL: Record<BookCategory, string> = {
  culture: "교양",
  novel: "소설",
  comic: "만화",
  cooking: "요리",
  adult: "성인",
};

/** 미디북스 권당 감상료(계열별). 감상 시 소지금에서 차감된다(systems/books.readBook). */
export const BOOK_PRICE_BY_CATEGORY: Record<BookCategory, number> = {
  comic: 3000, // 만화는 권당 저렴
  novel: 8000,
  culture: 9000,
  cooking: 10000,
  adult: 12000,
};

export interface Book {
  id: string;
  title: string;
  author: string;
  category: BookCategory;
  /** 평점(5점 만점) */
  rating: number;
  /** 평가 수 */
  reviews: number;
  /** 표지 그라데이션 색상(hue) */
  hue: number;
  /**
   * 이 책이 추가로 올려주는 **변태력**(없으면 카테고리 기본값만).
   *
   * ⚠️ 성인 도서는 전부 변태력 기본치(ADULT_BOOK_PERVERT)를 주지만, 취향이 뚜렷한
   *    책은 여기서 더 얹는다 — 변태력은 '얼마나 야한가'가 아니라 '어느 방향인가'라
   *    같은 성인물이라도 로맨스와 규율서를 같은 값으로 묶으면 축이 뭉개진다.
   */
  pervertBonus?: number;
  /** 읽으려면 필요한 최소 변태력(취향이 안 맞으면 목록에 안 뜬다). */
  minPervert?: number;
}

export const BOOKS: Book[] = [
  { id: "b1", title: "돈의 온도", author: "김서연", category: "culture", rating: 4.7, reviews: 1492, hue: 18 },
  { id: "b2", title: "느리게 걷는 뇌", author: "이도현", category: "culture", rating: 4.8, reviews: 2242, hue: 210 },
  { id: "b3", title: "우주를 걷는 법", author: "앤디 무어 외 1명", category: "culture", rating: 4.9, reviews: 3926, hue: 265 },
  { id: "b4", title: "설득의 온도", author: "정하람 외 1명", category: "culture", rating: 4.4, reviews: 335, hue: 40 },
  { id: "b5", title: "밤의 도서관", author: "이영채", category: "novel", rating: 4.8, reviews: 1912, hue: 285 },
  { id: "b6", title: "고양이를 삼킨 도시", author: "이영채", category: "novel", rating: 4.9, reviews: 722, hue: 340 },
  { id: "b7", title: "세 번째 여름", author: "이우혁", category: "novel", rating: 4.9, reviews: 96, hue: 150 },
  { id: "b8", title: "유리 정원의 살인", author: "베르나르 뒤퐁", category: "novel", rating: 4.5, reviews: 88, hue: 8 },
  { id: "b9", title: "던전 브레이커", author: "유영만", category: "comic", rating: 4.7, reviews: 331, hue: 200 },
  { id: "b10", title: "라면 요정 3", author: "박도담", category: "comic", rating: 4.6, reviews: 540, hue: 12 },
  { id: "b11", title: "0교시 히어로", author: "한겨울", category: "comic", rating: 4.8, reviews: 1204, hue: 250 },
  { id: "b12", title: "검은 고양이 탐정", author: "무명작가 외 1명", category: "comic", rating: 4.5, reviews: 61, hue: 320 },
  { id: "b18", title: "회귀자의 만렙 공략집", author: "백서진", category: "comic", rating: 4.9, reviews: 4821, hue: 220 },
  { id: "b19", title: "악녀는 오늘도 우아하게", author: "문세라", category: "comic", rating: 4.8, reviews: 3675, hue: 335 },
  { id: "b20", title: "S급 헌터 등록 대행소", author: "강도현", category: "comic", rating: 4.7, reviews: 2190, hue: 185 },
  { id: "b21", title: "편의점 여신님의 야간근무", author: "오유리", category: "comic", rating: 4.6, reviews: 812, hue: 155 },
  { id: "b22", title: "검을 삼킨 막내제자", author: "천유성", category: "comic", rating: 4.7, reviews: 1533, hue: 25 },
  { id: "b23", title: "반지하 히어로즈", author: "정만복", category: "comic", rating: 4.4, reviews: 274, hue: 95 },
  { id: "b24", title: "마왕님의 이력서", author: "한도깨비", category: "comic", rating: 4.5, reviews: 638, hue: 280 },
  { id: "b25", title: "9회말 대타 인생", author: "구자성", category: "comic", rating: 4.6, reviews: 449, hue: 205 },
  { id: "b13", title: "하루 15분 진짜 쉬운 집밥", author: "김밥심", category: "cooking", rating: 4.8, reviews: 2103, hue: 25 },
  { id: "b14", title: "에어프라이어 하나로 끝", author: "정한끼", category: "cooking", rating: 4.7, reviews: 1560, hue: 205 },
  { id: "b15", title: "초보를 위한 홈베이킹의 정석", author: "오븐요정", category: "cooking", rating: 4.9, reviews: 884, hue: 45 },
  { id: "b16", title: "제철 재료로 차리는 사계절 밥상", author: "이한상 외 1명", category: "cooking", rating: 4.8, reviews: 631, hue: 130 },
  { id: "b17", title: "혼밥러의 5분 레시피", author: "나혼밥", category: "cooking", rating: 4.6, reviews: 1247, hue: 340 },
];

/**
 * 성인(19금) 도서 — 성인물 보기(adultMode)가 켜졌을 때만 미디북스 '성인' 탭에 노출된다.
 * 실제 작품/저자와 무관한 창작 패러디이며, 톤은 자극적이되 노골 묘사는 두지 않는다(제목·감상 위주).
 */
export const ADULT_BOOKS: Book[] = [
  { id: "ab1", title: "사장님은 밤에 더 위험해", author: "야한밤", category: "adult", rating: 4.8, reviews: 4821, hue: 345 },
  { id: "ab2", title: "은밀한 옆집", author: "달세뇨", category: "adult", rating: 4.7, reviews: 2610, hue: 300 },
  { id: "ab3", title: "달콤한 독점욕", author: "설탕중독", category: "adult", rating: 4.9, reviews: 6042, hue: 330 },
  { id: "ab4", title: "한밤의 개인 레슨", author: "야근요정", category: "adult", rating: 4.6, reviews: 1888, hue: 280 },
  { id: "ab5", title: "금지된 사이", author: "밤을잊은그대", category: "adult", rating: 4.8, reviews: 3355, hue: 355 },
  { id: "ab6", title: "닿을 듯 말 듯", author: "간질간질", category: "adult", rating: 4.7, reviews: 2199, hue: 315 },
  // ── 취향 계열(변태력이 더 오른다) ─────────────────────────────
  // 위 여섯은 로맨스 결이라 카테고리 기본치만 준다. 아래는 방향이 뚜렷한 책들이다.
  // ⚠️ 활자는 실행이 아니라 취향 탐색이라, 같은 방향의 실제 경험(클럽 세션·야밤 영상)보다
  //    상승폭을 작게 잡는다. 대신 게이트 밖에서 축을 여는 **진입로** 역할을 한다.
  { id: "ab7", title: "규율의 문법", author: "채찍과당근", category: "adult", rating: 4.6, reviews: 1204, hue: 350, pervertBonus: 7 },
  { id: "ab8", title: "목줄 사용 설명서", author: "가죽공방", category: "adult", rating: 4.5, reviews: 892, hue: 265, pervertBonus: 9 },
  { id: "ab9", title: "매듭의 미학", author: "밧줄장인", category: "adult", rating: 4.7, reviews: 1533, hue: 200, pervertBonus: 10, minPervert: 60 },
  { id: "ab10", title: "관객 앞에서", author: "유리방", category: "adult", rating: 4.4, reviews: 706, hue: 25, pervertBonus: 12, minPervert: 120 },
  { id: "ab11", title: "복종 계약서 작성법", author: "계약의밤", category: "adult", rating: 4.6, reviews: 1077, hue: 290, pervertBonus: 11, minPervert: 120 },
];
