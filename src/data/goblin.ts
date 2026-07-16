import type { SkillStatId } from "@/core/types";

/**
 * 도깨비 상점 — 네이놈 검색창에 '열려라 참깨'를 입력하면 열리는 단발 사이트.
 * 스탯을 대폭(일반 상점보다 큰 폭·좋은 가성비로) 올려주는 레어 아이템을 판다. 한 달에 한 번만 접속 가능.
 * (구매는 ownedItems로 관리 — 아이템당 1회)
 */
export interface GoblinItem {
  id: string;
  name: string;
  desc: string;
  /** 가격(1천만원 이내. 일반 상점보다 스탯 가성비가 좋게 책정) */
  price: number;
  /** 구매 시 영구 상승하는 세부 스탯들(대폭) */
  boosts: Partial<Record<SkillStatId, number>>;
}

export const GOBLIN_ITEMS: GoblinItem[] = [
  {
    id: "gob_bat",
    name: "도깨비 방망이",
    desc: "휘두르면 뭐든 나온다는 전설의 방망이. 만능 재주가 깃든다.",
    price: 1_200_000,
    boosts: { sociability: 150, beauty: 150, creativity: 150 },
  },
  {
    id: "gob_glasses",
    name: "천리안 안경",
    desc: "천 리 밖을 꿰뚫어 본다. 지식과 언변이 트인다.",
    price: 1_500_000,
    boosts: { knowledge: 300, vocabulary: 300 },
  },
  {
    id: "gob_elixir",
    name: "불로초",
    desc: "한 뿌리 씹으면 지치지 않는 몸이 된다는 영약.",
    price: 1_000_000,
    boosts: { fitness: 400 },
  },
  {
    id: "gob_gumiho",
    name: "구미호의 미소",
    desc: "홀리는 아름다움과 매혹이 스며든다.",
    price: 1_500_000,
    boosts: { beauty: 350, lewd: 250 },
  },
  {
    id: "gob_fan",
    name: "만담 도깨비 부채",
    desc: "부치면 좌중을 뒤집는 입담이 솟는다.",
    price: 900_000,
    boosts: { comedy: 350 },
  },
  {
    id: "gob_brush",
    name: "황금 붓",
    desc: "그리는 대로 살아 움직인다는 신필. 창작혼이 폭발한다.",
    price: 1_200_000,
    boosts: { creativity: 400 },
  },
];
