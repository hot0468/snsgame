/**
 * 포토카드/굿즈 가챠(뽑기)로 나오는 실물 아이템 카탈로그.
 *
 * 뽑기 확률·정신력·팔로워 등 '뽑기 역학'은 `systems/gacha.ts`가 갖고,
 * 여기엔 **뽑혀서 서랍장(ownedItems)에 들어가는 실물의 id/이름/설명/되팔이가**만 둔다.
 *
 * ⚠️ 등급 키(empty/common/rare/sr/ssr)는 systems/gacha.ts의 GachaRarity와 일치해야 한다.
 * ⚠️ 여기 id는 `systems/shop.ts`의 ITEM_INDEX에 등록된다 — 등록 안 하면 뽑은 굿즈가
 *    서랍장에서 조용히 사라진다(resolveItem 함정, CLAUDE.md 참조). 새 굿즈를 추가하면 반드시
 *    이 목록을 통해 ITEM_INDEX에 자동 등록되게 두어라.
 */

export interface GachaItem {
  id: string;
  name: string;
  desc: string;
  /** 되팔이 가격(피망마켓). 등급이 높을수록 비싸다. */
  price: number;
  /**
   * 카드가 아닌 실물(배지·아크릴·폴라로이드·굿즈세트·엽서·포스터)이면 true.
   * 등급 프레임(ui/photoCard.ts)을 씌우지 않고 **사진만** 보여준다 —
   * 배지에 카드 액자를 두르면 그게 뭔지 알아볼 수 없다(사용자 확정).
   * 사진 등록·서랍장 표시는 카드와 똑같이 동작한다. 프레임 유무만 다르다.
   */
  noFrame?: true;
}

/** 등급별 뽑기 실물 풀. '꽝(empty)'은 서랍장에 들어가지 않지만 리졸버 등록엔 무해하다. */
export const GACHA_ITEMS: Record<string, GachaItem[]> = {
  empty: [
    { id: "gc_empty_wrap", name: "빈 포장지", desc: "알맹이는 없고 포장지만 남았다. 뽑기의 쓴맛.", price: 0 },
    { id: "gc_empty_dup", name: "중복 스티커", desc: "이미 백 장은 있는 그 스티커. 또 나왔다.", price: 0 },
    { id: "gc_empty_misc", name: "정체불명 부록", desc: "이게 뭐에 쓰는 물건인지 아무도 모른다.", price: 0 },
  ],
  common: [
    { id: "gc_common_photocard", name: "일반 포토카드", desc: "흔하지만 그래도 최애는 최애. 한 장 늘었다.", price: 2_000 },
    { id: "gc_common_postcard", name: "기본 엽서", desc: "책상 앞에 붙여두기 딱 좋은 기본 엽서.", price: 2_000, noFrame: true },
    { id: "gc_common_miniposter", name: "미니 포스터", desc: "작지만 있으면 방이 채워지는 미니 포스터.", price: 2_500, noFrame: true },
  ],
  rare: [
    { id: "gc_rare_photocard", name: "레어 포토카드", desc: "구도도 표정도 살아있는 레어 컷. 득템.", price: 8_000 },
    { id: "gc_rare_holo", name: "홀로그램 카드", desc: "빛을 받으면 무지개로 반짝이는 홀로그램.", price: 9_000 },
    { id: "gc_rare_badge", name: "한정 배지", desc: "행사 한정으로 풀렸던 그 배지. 물량 적다.", price: 8_500, noFrame: true },
  ],
  sr: [
    { id: "gc_sr_photocard", name: "최애 포토카드", desc: "하필 최애가, 하필 이 컷으로. 심장이 나갔다.", price: 30_000 },
    { id: "gc_sr_signcard", name: "사인 카드", desc: "인쇄 사인이지만 그래도 사인은 사인이다.", price: 32_000 },
    { id: "gc_sr_acrylic", name: "특전 아크릴 스탠드", desc: "책상 위 명당을 차지할 특전 아크릴 스탠드.", price: 35_000, noFrame: true },
  ],
  ssr: [
    { id: "gc_ssr_polaroid", name: "최애 실물 사인 폴라로이드", desc: "진짜 손으로 쓴 사인 폴라로이드. 국보급.", price: 150_000, noFrame: true },
    { id: "gc_ssr_secret", name: "1/100 시크릿 카드", desc: "백 개 중 하나 나온다는 그 시크릿. 내 손에.", price: 180_000 },
    { id: "gc_ssr_goodsset", name: "당첨 실물 굿즈 세트", desc: "응모 당첨자에게만 갔다는 풀세트. 텅장이 아깝지 않다.", price: 200_000, noFrame: true },
  ],
};

/** ITEM_INDEX 등록용 평면 목록(꽝 포함 — ownedItems엔 비꽝만 들어가므로 무해). */
export const GACHA_ALL_ITEMS: GachaItem[] = Object.values(GACHA_ITEMS).flat();

/**
 * 아이템 id → 등급. 포토카드 프레임(ui/photoCard.ts)이 화려함 단계를 이걸로 고른다.
 * GACHA_ITEMS에서 파생하므로 굿즈를 추가하면 자동으로 따라온다(손으로 베끼지 마라).
 */
export const GACHA_RARITY_OF: Record<string, string> = Object.fromEntries(
  Object.entries(GACHA_ITEMS).flatMap(([rarity, items]) => items.map((it) => [it.id, rarity])),
);

/**
 * 사진을 붙일 수 있는 굿즈(= 꽝을 뺀 전부). 어드민 사진 등록 목록이 이걸 쓴다.
 * 꽝은 서랍장에 들어가지도 않으니 사진이 붙을 일이 없다.
 * ⚠️ '프레임이 붙는 것'과 다르다 — 프레임 여부는 `isFramedCard`가 정한다(배지·엽서 등은 제외).
 */
export const GACHA_CARD_ITEMS: GachaItem[] = Object.entries(GACHA_ITEMS)
  .filter(([rarity]) => rarity !== "empty")
  .flatMap(([, items]) => items);

/** 등급 프레임을 씌울 굿즈인가(카드류만 true — 배지·아크릴·폴라로이드·굿즈세트·엽서·포스터는 false). */
export function isFramedCard(itemId: string): boolean {
  const it = GACHA_ALL_ITEMS.find((x) => x.id === itemId);
  return !!it && !it.noFrame;
}
