import type { ShopItem } from "./shop";

/**
 * 피망마켓 — 동네 중고 직거래. 정가 10만원 이하, 스탯은 소량(10~20)만 오른다.
 * shape은 상점과 같은 ShopItem이라 구매는 systems/shop.ts의 buyItem을 그대로 쓴다.
 * (content-author가 물품을 채운다 — export 이름 PEEMANG_ITEMS는 systems가 참조하므로 유지할 것)
 *
 * 밸런스: boost 구간별로 가격이 단조 — 10:1.2~2.5만 / 15:3.5~6만 / 20:8~9.5만.
 * repeatable·adultOnly는 쓰지 않는다(전부 1회 구매, 스탯 단수). id는 전부 pm_ 프리픽스.
 */
export const PEEMANG_ITEMS: ShopItem[] = [
  // ── 운동
  { id: "pm_yoga_mat", name: "요가매트 (거의 새것)", desc: "작심삼일 했습니다. 세 번 깔았어요. 직거래만 합니다.", price: 12_000, skill: "fitness", boost: 10 },
  { id: "pm_dumbbell", name: "고무 덤벨 세트 5kg", desc: "옷걸이로 쓴 적 없습니다. 진짜예요. 무거우니 차 갖고 오세요.", price: 45_000, skill: "fitness", boost: 15 },
  { id: "pm_bike", name: "접이식 자전거", desc: "이사 가서 급처합니다. 체인 갈았고 상태 A급. 네고 사절이요.", price: 95_000, skill: "fitness", boost: 20 },

  // ── 미용
  { id: "pm_perfume", name: "향수 (7할 남음)", desc: "선물받았는데 향이 안 맞아서요. 뚜껑 그대로 있습니다.", price: 25_000, skill: "beauty", boost: 10 },
  { id: "pm_coat", name: "브랜드 코트 (택 안 뗌)", desc: "사이즈 실패입니다... 정가 40만원대예요. 쿨거래 우대합니다.", price: 90_000, skill: "beauty", boost: 20 },

  // ── 어휘력
  { id: "pm_novel_box", name: "소설 전집 한 박스", desc: "책장 정리합니다. 밑줄 없고 깨끗해요. 통째로만 가져가세요. 무료나눔 문의는 사양할게요.", price: 20_000, skill: "vocabulary", boost: 10 },

  // ── 지식
  { id: "pm_workbook", name: "자격증 문제집 세트", desc: "3회독 하려다 0회독 했습니다. 필기 하나도 없어요.", price: 15_000, skill: "knowledge", boost: 10 },
  { id: "pm_encyclopedia", name: "백과사전 전집", desc: "부모님이 사주신 건데 이제 보내드립니다. 20권 풀세트, 상태 좋음.", price: 80_000, skill: "knowledge", boost: 20 },

  // ── 친화력
  { id: "pm_boardgame", name: "보드게임 모음 5종", desc: "같이 할 사람이 없었습니다. 부품 하나도 안 잃어버렸어요.", price: 40_000, skill: "sociability", boost: 15 },
  { id: "pm_camping", name: "캠핑 의자·테이블 세트", desc: "두 번 나갔다가 창고행이었습니다. 곰팡이 없어요. 오늘 안에 가져가실 분만.", price: 85_000, skill: "sociability", boost: 20 },

  // ── 개그
  { id: "pm_standup_dvd", name: "개그 공연 DVD 박스", desc: "지금은 해체한 팀 공연 전편입니다. 알아보시는 분만 연락 주세요.", price: 18_000, skill: "comedy", boost: 10 },

  // ── 창작
  { id: "pm_ukulele", name: "우쿨렐레 (튜너 포함)", desc: "코드 세 개 치고 접었습니다. 줄은 새로 갈았어요. 케이스도 같이 드려요.", price: 50_000, skill: "creativity", boost: 15 },

  // ── 게임
  { id: "pm_gamepad", name: "무선 게임패드", desc: "쏠림 없습니다. 스틱 상태 확인하고 가져가셔도 돼요. 충전 케이블 포함.", price: 35_000, skill: "game", boost: 15 },

  // ── IT
  { id: "pm_keyboard", name: "기계식 키보드 (적축)", desc: "키캡 새로 씌워놨습니다. 야식 흘린 적 없어요. 저녁에 지하철역에서 봬요.", price: 60_000, skill: "it", boost: 15 },
];
