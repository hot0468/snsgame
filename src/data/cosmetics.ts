import type { ShopItem } from "./shop";

/**
 * 화장품 상품 풀 — 쇼핑의 '이달의 신상 화장품' 코너에 노출된다.
 * 매달(monthKey) 신상품 4종이 로테이션되고,
 * 그 신상품을 보유한 채 '뷰티계' 트윗에 홍보로 쓰면 팔로워 증가분이 오른다.
 * 모든 화장품은 구매 시 미용(beauty) 스탯이 오른다(기존 쇼핑 아이템과 동일 처리).
 */
export const COSMETICS: ShopItem[] = [
  { id: "cos_velvet_lip", name: "벨벳 매트 립스틱", desc: "하루 종일 지워지지 않는 벨벳 매트 발색.", price: 38_000, skill: "beauty", boost: 25 },
  { id: "cos_glow_found", name: "글로우 세럼 파운데이션", desc: "속광 가득, 얇게 발리는 세럼 파운데이션.", price: 62_000, skill: "beauty", boost: 30 },
  { id: "cos_aqua_cream", name: "아쿠아 수분 크림", desc: "촉촉함이 오래가는 저자극 수분 크림.", price: 45_000, skill: "beauty", boost: 25 },
  { id: "cos_silk_cushion", name: "실크 쿠션 팩트", desc: "무너짐 없는 실크 피니시 쿠션.", price: 55_000, skill: "beauty", boost: 30 },
  { id: "cos_volume_mascara", name: "볼륨 컬링 마스카라", desc: "번짐 없이 풍성하게, 하루 종일 컬 유지.", price: 29_000, skill: "beauty", boost: 20 },
  { id: "cos_eye_palette", name: "데이오라 아이팔레트", desc: "데일리부터 파티까지, 12색 멀티 팔레트.", price: 72_000, skill: "beauty", boost: 35 },
  { id: "cos_rose_blusher", name: "로즈 틴트 블러셔", desc: "은은하게 물드는 생기 로즈 블러셔.", price: 33_000, skill: "beauty", boost: 20 },
  { id: "cos_night_ampoule", name: "나이트 리페어 앰플", desc: "자는 동안 피부 결을 정돈하는 고농축 앰플.", price: 88_000, skill: "beauty", boost: 40 },
  { id: "cos_mist_fixer", name: "롱래스팅 미스트 픽서", desc: "메이크업을 오래 고정하는 픽싱 미스트.", price: 27_000, skill: "beauty", boost: 20 },
  { id: "cos_bright_toner", name: "브라이트닝 토너", desc: "맑고 환한 피부로 정돈하는 데일리 토너.", price: 41_000, skill: "beauty", boost: 25 },
  { id: "cos_gel_liner", name: "워터프루프 젤 아이라이너", desc: "번짐 없이 또렷하게, 부드러운 젤 라이너.", price: 24_000, skill: "beauty", boost: 20 },
  { id: "cos_silky_primer", name: "실키 스무딩 프라이머", desc: "모공을 매끈하게 잡아주는 베이스 프라이머.", price: 46_000, skill: "beauty", boost: 25 },
  { id: "cos_collagen_mask", name: "콜라겐 마스크팩 세트", desc: "탄력과 수분을 채우는 콜라겐 시트팩.", price: 36_000, skill: "beauty", boost: 25 },
  { id: "cos_dewy_high", name: "듀이 글로우 하이라이터", desc: "은은하게 빛나는 물광 하이라이터.", price: 34_000, skill: "beauty", boost: 25 },
  { id: "cos_color_conceal", name: "컬러 커버 컨실러", desc: "잡티·다크서클을 자연스럽게 커버.", price: 31_000, skill: "beauty", boost: 20 },
  { id: "cos_perfume_lotion", name: "퍼퓸 바디로션", desc: "은은한 잔향이 오래 남는 퍼퓸 바디로션.", price: 49_000, skill: "beauty", boost: 30 },
];

/** 이달의 신상품 수 */
export const NEW_COSMETIC_COUNT = 4;
/** 신상 화장품을 홍보로 쓴 뷰티 트윗의 팔로워 증가 배율 */
export const NEW_COSMETIC_MULTIPLIER = 1.6;

const COSMETIC_BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

/** id로 화장품 조회 */
export function cosmeticById(id: string): ShopItem | undefined {
  return COSMETIC_BY_ID.get(id);
}

/**
 * 그 달(monthKey)의 신상 화장품 목록 — 매달 4종이 로테이션된다.
 */
export function monthlyNewCosmetics(monthKey: number): ShopItem[] {
  const len = COSMETICS.length;
  const start = (((monthKey * NEW_COSMETIC_COUNT) % len) + len) % len;
  return Array.from({ length: NEW_COSMETIC_COUNT }, (_, i) => COSMETICS[(start + i) % len]);
}

/** 신상 화장품 홍보/언박싱 트윗 문구(상품명이 들어간다). */
export function cosmeticTweetLines(product: ShopItem): string[] {
  const n = product.name;
  return [
    `이번에 나온 신상 ${n} 언박싱! 발색이며 지속력이 미쳐서 강력 추천합니다 #신상 #뷰티`,
    `요즘 최애템 된 ${n} 후기 남겨요 이거 안 써본 사람 없게 해주세요 진심 인생템`,
    `${n} 드디어 겟했다 신상은 못 참지 오늘 메이크업에 바로 써봤는데 대만족`,
    `이달의 신상 ${n} 발색샷 투척합니다 나오자마자 질렀는데 후회 없는 소비`,
    `${n} 데일리로 쓰기 딱이라 벌써 재구매각이에요 신상 미리 써보고 강추 남겨요`,
  ];
}
