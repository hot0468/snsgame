import type { SkillStatId } from "@/core/types";

/**
 * 주거(집) 단계 데이터 — '남의방'에서 계약(구매)한다.
 * 단계가 오를수록 월세가 비싸지지만, 잠에서 깰 때 회복하는 행동력·정신력이 늘어난다.
 * 아파트(구축) 이상부터는 계약 시 세부 스탯이 영구히 오르는 효과가 붙는다.
 *
 * ⚠️ 혜택의 귀속 방식이 두 가지로 갈린다:
 *    - `actionBonus`/`mentalBonus` — **현재 집에 귀속**. 이사하면 새 집 값으로 바뀐다
 *      (상태에 저장되지 않고 `systems/time.ts`가 매 기상마다 현재 단계를 직접 읽는다).
 *    - `permaSkills` — **계약 즉시 영구 상승**. 다른 집으로 옮겨도 빠지지 않는다.
 */
export interface Housing {
  id: string;
  name: string;
  /** 평형/유형 표기 */
  tagline: string;
  /** 월세(30일마다) */
  rent: number;
  /** 계약(입주) 비용 — 보증금·이사비 개념(1회) */
  price: number;
  /** 잠에서 깰 때 추가로 회복하는 행동력 */
  actionBonus: number;
  /** 잠에서 깰 때 추가로 회복하는 정신력 */
  mentalBonus: number;
  /** 아파트 이상: 계약 시 1회 영구 스탯 상승(이사해도 빠지지 않는다) */
  permaSkills?: Partial<Record<SkillStatId, number>>;
}

export const HOUSINGS: Housing[] = [
  {
    id: "oneroom3",
    name: "3평 원룸",
    tagline: "지금 사는 곳 · 몸만 겨우 눕는 방",
    rent: 300_000,
    price: 0,
    actionBonus: 0,
    mentalBonus: 0,
  },
  {
    id: "oneroom7",
    name: "7평 원룸",
    tagline: "그래도 숨통은 트이는 원룸",
    rent: 450_000,
    price: 2_000_000,
    actionBonus: 3,
    mentalBonus: 3,
  },
  {
    id: "tworoom10",
    name: "10평 투룸",
    tagline: "방이 둘이라 작업 공간이 생겼다",
    rent: 650_000,
    price: 5_000_000,
    actionBonus: 5,
    mentalBonus: 6,
  },
  {
    id: "villa",
    name: "빌라",
    tagline: "낡았지만 넓고 조용한 빌라",
    rent: 900_000,
    price: 12_000_000,
    actionBonus: 7,
    mentalBonus: 9,
  },
  {
    id: "oldapt",
    name: "구축 아파트",
    tagline: "관리실·주차장까지, 아파트 라이프 입문",
    rent: 1_400_000,
    price: 40_000_000,
    actionBonus: 9,
    mentalBonus: 12,
    permaSkills: { sociability: 20, beauty: 15 },
  },
  {
    id: "newapt",
    name: "신축 아파트",
    tagline: "커뮤니티 시설 완비, 삶의 질이 다르다",
    rent: 2_200_000,
    price: 120_000_000,
    actionBonus: 12,
    mentalBonus: 15,
    permaSkills: { sociability: 30, beauty: 25, knowledge: 20 },
  },
  {
    id: "country",
    name: "전원주택",
    tagline: "마당 있는 집, 자연이 주는 여유",
    rent: 3_000_000,
    price: 300_000_000,
    actionBonus: 15,
    mentalBonus: 20,
    permaSkills: { fitness: 30, creativity: 30 },
  },
  {
    id: "mansion",
    name: "대저택",
    tagline: "정원과 홈시어터가 있는 대저택",
    rent: 6_000_000,
    price: 900_000_000,
    actionBonus: 20,
    mentalBonus: 25,
    permaSkills: { sociability: 40, beauty: 40, creativity: 30, knowledge: 30 },
  },
  {
    id: "highend",
    name: "하이엔드 팰리스",
    tagline: "이 도시 최상위 1%의 초고층 펜트하우스",
    rent: 12_000_000,
    price: 3_000_000_000,
    actionBonus: 28,
    mentalBonus: 32,
    permaSkills: { sociability: 60, beauty: 60, creativity: 50, knowledge: 50, vocabulary: 40 },
  },
];
