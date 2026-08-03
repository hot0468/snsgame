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
  { id: "dress", name: "명품 원피스", desc: "어디서든 시선을 사로잡는 한 벌.", price: 2_500_000, skill: "beauty", boost: 50 },
  { id: "cosmetics", name: "화장품 풀세트", desc: "베이스부터 색조까지 완벽 구성.", price: 90_000, skill: "beauty", boost: 30 },
  { id: "camera", name: "고급 미러리스 카메라", desc: "콘텐츠 퀄리티가 확 올라간다.", price: 250_000, skill: "creativity", boost: 50 },
  { id: "pen_paper", name: "펜 & 종이", desc: "가볍게 시작하는 손그림 세트. 애니/만화 창작이 열린다.", price: 30_000, skill: "creativity", boost: 20 },
  { id: "pen_tablet", name: "판 타블렛", desc: "화면 없이 그리는 입문용 태블릿. 애니/만화 창작이 열린다.", price: 150_000, skill: "creativity", boost: 40 },
  { id: "display_tablet", name: "액정 타블렛", desc: "화면에 바로 그리는 전문가용. 애니/만화 창작이 열린다.", price: 1_500_000, skill: "creativity", boost: 70 },
  { id: "gpu", name: "그래픽카드", price: 3_500_000 },
  { id: "pc_upgrade", name: "컴퓨터 업그레이드", desc: "부품을 하나씩 손보면 작업 흐름이 빨라진다. 하나 늘 때마다 트윗 게시에 드는 행동력이 1씩 영구히 줄어든다(최소 5까지). 업그레이드할수록 다음 부품값이 비싸진다.", price: 300_000, repeatable: true },
  { id: "mouse", name: "마우스", desc: "클릭이 손끝을 그대로 따라온다. 하나 늘 때마다 티켓팅 제한 시간이 0.1초씩 벌어지고, 그 0.1초가 자리를 가른다.", price: 100_000, repeatable: true },
  { id: "ereader", name: "전자책 리더기", desc: "어휘와 지식을 틈틈이 채운다.", price: 70_000, skill: "vocabulary", boost: 30 },
  { id: "hometrainer", name: "홈트 기구 세트", desc: "집에서도 꾸준히 몸을 만든다.", price: 100_000, skill: "fitness", boost: 30 },
  { id: "concert_goods", name: "인싸 굿즈 풀장착", desc: "모임마다 대화가 끊이지 않는다.", price: 60_000, skill: "sociability", boost: 30 },
  { id: "mic", name: "방송용 마이크 세트", desc: "드립 타이밍이 살아난다.", price: 110_000, skill: "comedy", boost: 30 },
  { id: "stream_mic", name: "웹방송용 마이크", desc: "숨소리까지 잡아내는 콘덴서. 하나 늘 때마다 어휘력이 조금, 사바나 방송 도네이션이 소폭 오른다.", price: 100_000, skill: "vocabulary", boost: 15, repeatable: true },
  { id: "aircon", name: "에어컨", desc: "한여름 폭염을 버티게 해주는 필수 가전.", price: 500_000 },
  { id: "heatpad", name: "전기장판", desc: "한겨울 한파에도 등을 지질 수 있다.", price: 60_000 },
  { id: "lingerie", name: "고급 란제리", desc: "은밀한 자신감을 더한다.", price: 130_000, skill: "lewd", boost: 40, adultOnly: true },
  { id: "sound_booth", name: "방음부스", desc: "옆집 눈치 없이 목청껏 녹음할 수 있는 나만의 방. 창작의 완성도가 달라진다.", price: 20_000_000, skill: "creativity", boost: 90 },
  { id: "handheld_console", name: "닌자보이 스위블", desc: "손바닥 위 콘솔. 침대에서도 지하철에서도 켠다.", price: 400_000, skill: "game", boost: 40 },
  { id: "home_console", name: "재생스테이션5", desc: "거실 TV를 통째로 점령하는 고성능 콘솔.", price: 700_000, skill: "game", boost: 60 },
  { id: "racing_wheel", name: "레이싱휠 세트", desc: "페달까지 갖춘 풀세트. 손맛부터가 다르다.", price: 7_000_000, skill: "game", boost: 100 },
  // ⚠️ boost가 작은 건 실수가 아니다. **응모권 목적으로 수십 장씩 사는 아이템**이라
  //    buyItem이 살 때마다 boost를 액면 지급하는 구조상(systems/shop.ts) 값이 크면
  //    CD 20장에 덕질 +200이 들어와 스탯 인플레 통로가 된다. 여기선 응모가 본체고
  //    스탯은 덤이어야 한다 — 올리지 마라.
  { id: "music_cd", name: "음원CD", desc: "최애 아이돌의 새 앨범. 응모권이 들어있어 다음 날 아침 추첨에 자동으로 들어간다. 여러 장 살수록 당첨 확률이 오르고, 응모한 CD는 소모된다.", price: 18_000, skill: "otaku", boost: 2, repeatable: true },
];

/** 계절 이벤트(seasonal)가 소유 판정에 import. */
export const AIRCON_ID = "aircon";
export const HEATPAD_ID = "heatpad";
/** 컴퓨터 업그레이드 — 보유 개수만큼 트윗 게시 행동력이 줄어든다(tweetSystem.tweetActionCost). */
export const PC_UPGRADE_ID = "pc_upgrade";
