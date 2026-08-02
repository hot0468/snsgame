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

  /* ────────────────────────────────────────────────────────────
   * ⚠️ 아래는 매대를 채우려고 늘린 물량이다. 하루에 6개씩 뽑는데 14개뿐이라
   *    아홉 개만 사면 매대가 안 찼다(systems/shop.todayPeemangItems 주석 참조).
   *    **스탯 축은 위와 같은 9종을 유지하고 물건만 늘린다** — 새 축을 여기서 열면
   *    "피망마켓에서만 오르는 스탯"이 생겨 상점과 역할이 겹친다.
   * ──────────────────────────────────────────────────────────── */

  // ── 운동
  { id: "pm_jumprope", name: "줄넘기 (디지털 카운터)", desc: "층간소음 항의 받고 접었습니다. 배터리 새로 넣었어요.", price: 13_000, skill: "fitness", boost: 10 },
  { id: "pm_yogaball", name: "짐볼 + 펌프", desc: "의자 대신 쓰려고 샀는데 굴러다니기만 합니다. 바람 빼서 드릴게요.", price: 22_000, skill: "fitness", boost: 10 },
  { id: "pm_pullup_bar", name: "문틀 철봉", desc: "설치했다가 문틀이 삐걱거려서 뗐습니다. 나사 다 있어요.", price: 38_000, skill: "fitness", boost: 15 },
  { id: "pm_treadmill", name: "가정용 러닝머신 (접이식)", desc: "빨래건조대로 두 달 썼습니다. 반성하며 내놓습니다. 2층까지 들어주실 분만.", price: 92_000, skill: "fitness", boost: 20 },

  // ── 미용
  { id: "pm_hairdryer", name: "고급 드라이기", desc: "선물받았는데 집에 하나 더 있어서요. 필터 청소 완료.", price: 24_000, skill: "beauty", boost: 10 },
  { id: "pm_makeup_box", name: "화장품 정리함 + 브러시 세트", desc: "브러시는 안 쓴 새것이고 정리함만 두 달 썼습니다.", price: 23_000, skill: "beauty", boost: 10 },
  { id: "pm_led_mask", name: "LED 마스크", desc: "꾸준히 못 해서 팝니다. 정품이고 어댑터 있어요. 사진 더 필요하시면 말씀 주세요.", price: 82_000, skill: "beauty", boost: 20 },

  // ── 어휘력
  { id: "pm_essay_set", name: "에세이 묶음 12권", desc: "이사 짐 줄이는 중입니다. 접힌 자국 좀 있어요. 낱권 판매는 안 합니다.", price: 16_000, skill: "vocabulary", boost: 10 },
  { id: "pm_dictionary", name: "두꺼운 국어사전", desc: "요즘 누가 종이 사전 보냐 하시겠지만 저는 잘 봤습니다.", price: 40_000, skill: "vocabulary", boost: 15 },

  // ── 지식
  { id: "pm_docu_dvd", name: "다큐멘터리 DVD 20장", desc: "케이스에 스크래치 조금 있고 재생은 다 됩니다. 목록 사진 올려뒀어요.", price: 24_000, skill: "knowledge", boost: 10 },
  { id: "pm_microscope", name: "학습용 현미경", desc: "조카 준다고 샀다가 못 줬습니다. 슬라이드 세트도 같이요.", price: 55_000, skill: "knowledge", boost: 15 },

  // ── 친화력
  { id: "pm_teaset", name: "손님용 찻잔 세트", desc: "집들이 때 한 번 썼습니다. 이가 나간 곳 없어요.", price: 21_000, skill: "sociability", boost: 10 },
  { id: "pm_karaoke_mic", name: "블루투스 노래방 마이크", desc: "혼자 부르니 재미가 없더라고요. 에코 잘 먹습니다.", price: 35_000, skill: "sociability", boost: 15 },

  // ── 개그
  { id: "pm_gag_books", name: "유머 모음집 + 짤 도감", desc: "화장실 독서용이었습니다. 상태는... 읽는 데 지장 없어요.", price: 14_000, skill: "comedy", boost: 10 },
  { id: "pm_prop_box", name: "개그 소품 박스 (가발·안경)", desc: "동아리 공연에 쓰던 것들입니다. 세탁했어요. 통째로 가져가실 분.", price: 36_000, skill: "comedy", boost: 15 },

  // ── 창작
  { id: "pm_sketch_kit", name: "스케치북 + 색연필 72색", desc: "취미 시작하려다 세 장 그렸습니다. 색연필은 거의 새것이에요.", price: 19_000, skill: "creativity", boost: 10 },
  { id: "pm_tablet", name: "액정 없는 드로잉 태블릿", desc: "펜 두 개 다 있고 펜촉 여유분도 드립니다. 케이블 포함.", price: 58_000, skill: "creativity", boost: 15 },
  { id: "pm_keyboard_midi", name: "미디 키보드 49건", desc: "작곡 배우려다 접었습니다. 건반 눌림 이상 없어요. 직접 쳐보고 가세요.", price: 88_000, skill: "creativity", boost: 20 },

  // ── 게임
  { id: "pm_retro_console", name: "레트로 게임기 (게임 30종 내장)", desc: "추억 삼아 샀는데 손이 안 가네요. 컨트롤러 두 개 다 됩니다.", price: 25_000, skill: "game", boost: 10 },
  { id: "pm_gaming_chair", name: "게이밍 의자", desc: "쿠션 꺼짐 없고 팔걸이 멀쩡합니다. 부피 크니 차 꼭 갖고 오세요.", price: 87_000, skill: "game", boost: 20 },

  // ── IT
  { id: "pm_usb_hub", name: "USB 허브 + 케이블 뭉치", desc: "서랍 정리하다 나왔습니다. 다 테스트해봤고 되는 것만 담았어요.", price: 12_000, skill: "it", boost: 10 },
  { id: "pm_monitor", name: "27인치 모니터", desc: "불량화소 없습니다. 받침대 있고 HDMI 케이블 같이 드려요.", price: 90_000, skill: "it", boost: 20 },
];
