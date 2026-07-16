/**
 * 미디북스(가상의 전자책 스토어)에 뜨는 도서 데이터.
 * 실제 도서/저자와 무관한 창작(패러디) 데이터다.
 */

/** 책 종류 — 감상 시 오르는 관련 스탯이 다르다 */
export type BookCategory = "culture" | "novel" | "comic" | "cooking";

export const BOOK_CATEGORY_LABEL: Record<BookCategory, string> = {
  culture: "교양",
  novel: "소설",
  comic: "만화",
  cooking: "요리",
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
  { id: "b13", title: "하루 15분 진짜 쉬운 집밥", author: "김밥심", category: "cooking", rating: 4.8, reviews: 2103, hue: 25 },
  { id: "b14", title: "에어프라이어 하나로 끝", author: "정한끼", category: "cooking", rating: 4.7, reviews: 1560, hue: 205 },
  { id: "b15", title: "초보를 위한 홈베이킹의 정석", author: "오븐요정", category: "cooking", rating: 4.9, reviews: 884, hue: 45 },
  { id: "b16", title: "제철 재료로 차리는 사계절 밥상", author: "이한상 외 1명", category: "cooking", rating: 4.8, reviews: 631, hue: 130 },
  { id: "b17", title: "혼밥러의 5분 레시피", author: "나혼밥", category: "cooking", rating: 4.6, reviews: 1247, hue: 340 },
];
