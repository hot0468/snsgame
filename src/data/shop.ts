import type { SkillStatId } from "@/core/types";

/**
 * 쇼핑 아이템 — 돈을 써서 세부 스탯을 영구히 올린다(기본 1회 구매).
 * 스탯 상승 없이 다른 시스템에만 효과를 주는 아이템은 skill/boost를 생략한다.
 * 성인 아이템은 성인물 해제 계정에서만 노출.
 */
export interface ShopItem {
  id: string;
  name: string;
  /** 상점에 노출할 설명(효과를 감추려면 생략) */
  desc?: string;
  price: number;
  /** 구매 시 오르는 세부 스탯(직접 상승이 없으면 생략) */
  skill?: SkillStatId;
  /** skill 상승폭(skill과 함께 지정) */
  boost?: number;
  /** true면 보유 중이어도 몇 번이든 재구매 가능(효과 누적) */
  repeatable?: boolean;
  /** 성인물 해제가 켜져 있어야 노출 */
  adultOnly?: boolean;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "dress", name: "명품 원피스", desc: "어디서든 시선을 사로잡는 한 벌.", price: 180_000, skill: "beauty", boost: 50 },
  { id: "cosmetics", name: "화장품 풀세트", desc: "베이스부터 색조까지 완벽 구성.", price: 90_000, skill: "beauty", boost: 30 },
  { id: "camera", name: "고급 미러리스 카메라", desc: "콘텐츠 퀄리티가 확 올라간다.", price: 250_000, skill: "creativity", boost: 50 },
  { id: "pen_paper", name: "펜 & 종이", desc: "가볍게 시작하는 손그림 세트. 애니/만화 창작이 열린다.", price: 30_000, skill: "creativity", boost: 20 },
  { id: "pen_tablet", name: "판 타블렛", desc: "화면 없이 그리는 입문용 태블릿. 애니/만화 창작이 열린다.", price: 150_000, skill: "creativity", boost: 40 },
  { id: "display_tablet", name: "액정 타블렛", desc: "화면에 바로 그리는 전문가용. 애니/만화 창작이 열린다.", price: 400_000, skill: "creativity", boost: 70 },
  { id: "gpu", name: "그래픽카드", price: 600_000 },
  { id: "mouse", name: "마우스", desc: "클릭이 손끝을 그대로 따라온다. 하나 늘 때마다 티켓팅 제한 시간이 0.1초씩 벌어지고, 그 0.1초가 자리를 가른다.", price: 100_000, repeatable: true },
  { id: "ereader", name: "전자책 리더기", desc: "어휘와 지식을 틈틈이 채운다.", price: 70_000, skill: "vocabulary", boost: 30 },
  { id: "hometrainer", name: "홈트 기구 세트", desc: "집에서도 꾸준히 몸을 만든다.", price: 100_000, skill: "fitness", boost: 30 },
  { id: "concert_goods", name: "인싸 굿즈 풀장착", desc: "모임마다 대화가 끊이지 않는다.", price: 60_000, skill: "sociability", boost: 30 },
  { id: "mic", name: "방송용 마이크 세트", desc: "드립 타이밍이 살아난다.", price: 110_000, skill: "comedy", boost: 30 },
  { id: "stream_mic", name: "웹방송용 마이크", desc: "숨소리까지 잡아내는 콘덴서. 하나 늘 때마다 어휘력이 조금, 사바나 방송 도네이션이 소폭 오른다.", price: 100_000, skill: "vocabulary", boost: 15, repeatable: true },
  { id: "lingerie", name: "고급 란제리", desc: "은밀한 자신감을 더한다.", price: 130_000, skill: "lewd", boost: 40, adultOnly: true },
];
