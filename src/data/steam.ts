import type { TweetMedia } from "@/core/types";

/**
 * '증기'(스팀 패러디) 게임 스토어의 판매 게임 목록.
 * - 실존 게임명 도용 금지, 위트있는 패러디만(제목·개발사 모두 창작).
 * - price는 원 단위 정가, discount는 할인 %(예 50 = -50%), 없으면 정가.
 * - ratingLabel/ratingCount는 스팀 평가 톤. tags 2~4개. media는 스크린샷 묘사(모자이크).
 * - hue는 커버 장식 색(0~360). featured는 대표 배너 노출용(2~3개).
 * 데이터는 선언만 하며, 구매·리뷰·해금 규칙은 systems/steam.ts가 담당한다.
 */
export interface SteamGame {
  id: string;
  title: string;
  developer: string;
  price: number;
  discount?: number;
  ratingLabel: string;
  ratingCount: number;
  tags: string[];
  media: TweetMedia;
  hue: number;
  featured?: boolean;
}

const P = (prompt: string): TweetMedia => ({ kind: "photo", prompt });

export const STEAM_GAMES: SteamGame[] = [
  {
    id: "grand_theft_otter",
    title: "Grand Theft Otter",
    developer: "락스타 수달게임즈",
    price: 62000,
    discount: 40,
    ratingLabel: "매우 긍정적",
    ratingCount: 184203,
    tags: ["오픈월드", "액션", "범죄", "멀티플레이"],
    media: P("강가 도시를 무대로 수달 갱단이 보트를 훔쳐 질주하는 오픈월드 게임 스크린샷, 네온 간판과 폭발 이펙트(배경 인물 모자이크)"),
    hue: 28,
    featured: true,
  },
  {
    id: "cyberpang_2088",
    title: "사이버펑 2088",
    developer: "CD 프로절크",
    price: 59000,
    discount: 60,
    ratingLabel: "복합적",
    ratingCount: 97544,
    tags: ["오픈월드", "RPG", "사이버펑크", "스토리"],
    media: P("네온 빗줄기가 쏟아지는 미래 도시 뒷골목에서 의체 팔을 든 주인공이 서 있는 1인칭 RPG 스크린샷, 홀로그램 광고판"),
    hue: 315,
    featured: true,
  },
  {
    id: "elden_ringer",
    title: "엘든 링거",
    developer: "프롬소울즈",
    price: 64000,
    discount: 25,
    ratingLabel: "압도적으로 긍정적",
    ratingCount: 421890,
    tags: ["소울라이크", "오픈월드", "액션RPG", "다크판타지"],
    media: P("황금빛 거목 아래 안개 낀 폐허 성에서 갑옷 기사가 거대 보스와 대치하는 다크판타지 액션RPG 스크린샷, 'YOU DIED' 잔상"),
    hue: 45,
    featured: true,
  },
  {
    id: "valmore",
    title: "발more언트",
    developer: "라이엇수달",
    price: 0,
    ratingLabel: "매우 긍정적",
    ratingCount: 302011,
    tags: ["FPS", "택티컬", "멀티플레이", "무료플레이"],
    media: P("5대5 택티컬 FPS 라운드에서 요원들이 스킬 이펙트를 터뜨리며 사이트를 점령하는 스크린샷, 킬로그 UI"),
    hue: 350,
    featured: false,
  },
  {
    id: "stardew_valleyevo",
    title: "스타듀 밸리ево",
    developer: "혼자다만든개발자",
    price: 16000,
    ratingLabel: "압도적으로 긍정적",
    ratingCount: 512334,
    tags: ["농장경영", "인디", "힐링", "픽셀"],
    media: P("픽셀아트 농장에서 작물에 물을 주고 닭을 키우며 노을을 맞는 힐링 시뮬레이션 스크린샷, 인벤토리 바"),
    hue: 95,
    featured: false,
  },
  {
    id: "hollow_kknight",
    title: "할로우 크나이트",
    developer: "체리팀 셋이서",
    price: 15500,
    discount: 50,
    ratingLabel: "압도적으로 긍정적",
    ratingCount: 233190,
    tags: ["메트로배니아", "인디", "액션", "탐험"],
    media: P("먹빛 지하 왕국을 탐험하는 작은 벌레 기사가 낡은 벤치에서 쉬는 메트로배니아 스크린샷, 손그림풍 배경"),
    hue: 205,
    featured: false,
  },
  {
    id: "baldur_gate_tree",
    title: "발더스 게이트 3그루",
    developer: "라리안수풀",
    price: 66000,
    ratingLabel: "압도적으로 긍정적",
    ratingCount: 288417,
    tags: ["CRPG", "턴제", "스토리", "협동"],
    media: P("판타지 파티가 던전에서 주사위 판정을 굴리며 촉수 괴물과 턴제 전투를 벌이는 CRPG 스크린샷, 대화 선택지 UI"),
    hue: 268,
    featured: false,
  },
  {
    id: "counter_strife",
    title: "카운터 스트라이후",
    developer: "밸브말고증기소프트",
    price: 0,
    ratingLabel: "매우 긍정적",
    ratingCount: 668902,
    tags: ["FPS", "경쟁전", "멀티플레이", "무료플레이"],
    media: P("먼지 낀 사막 맵에서 대테러팀과 테러팀이 폭탄 해체를 두고 총격전을 벌이는 경쟁 FPS 스크린샷, 라운드 타이머"),
    hue: 32,
    featured: false,
  },
  {
    id: "among_uss",
    title: "어몽 어스스",
    developer: "이너슬로스삼남매",
    price: 4900,
    discount: 30,
    ratingLabel: "매우 긍정적",
    ratingCount: 145670,
    tags: ["파티게임", "인디", "추리", "멀티플레이"],
    media: P("우주선 안에서 콩알 모양 캐릭터들이 임무를 돌다 한 명이 사보타주를 저지르는 추리 파티게임 스크린샷, 긴급회의 버튼"),
    hue: 12,
    featured: false,
  },
  {
    id: "terror_ria",
    title: "테라리아리아",
    developer: "리로직혼자서",
    price: 10500,
    discount: 70,
    ratingLabel: "압도적으로 긍정적",
    ratingCount: 356201,
    tags: ["샌드박스", "생존", "인디", "탐험"],
    media: P("2D 픽셀 세계에서 곡괭이로 땅을 파 광물을 캐고 밤이 되자 몰려오는 좀비와 맞서는 샌드박스 생존 스크린샷, 체력 하트 UI"),
    hue: 130,
    featured: false,
  },
  {
    id: "sil_hunt_world",
    title: "몬스터 헌트월드",
    developer: "캡콤말고컵콤",
    price: 42000,
    discount: 55,
    ratingLabel: "매우 긍정적",
    ratingCount: 198740,
    tags: ["액션", "협동", "사냥", "RPG"],
    media: P("거대한 비룡을 네 명의 헌터가 협동으로 몰아붙이며 특수무기를 휘두르는 사냥 액션 스크린샷, 몬스터 체력 게이지"),
    hue: 18,
    featured: false,
  },
  {
    id: "sea_of_steal",
    title: "시 오브 스틸",
    developer: "레어수달 스튜디오",
    price: 38000,
    discount: 90,
    ratingLabel: "복합적",
    ratingCount: 61233,
    tags: ["오픈월드", "해적", "협동", "멀티플레이"],
    media: P("탁 트인 바다에서 해적선 갑판 위 선원들이 대포를 쏘고 돛을 조종하며 다른 배와 교전하는 협동 항해 스크린샷, 보물지도 팝업"),
    hue: 190,
    featured: false,
  },
];

/**
 * 보유 게임 리뷰 트윗 문구 풀. `{title}`은 systems가 게임 제목으로 치환한다.
 * 카테고리: gaming(게임계) 톤 — SNS 게이머 말투, 짧고 구어체.
 */
export const GAME_REVIEW_TWEETS: string[] = [
  "{title} 방금 엔딩 봤다… 이거 그냥 인생겜이네 며칠 잠 못 잘 듯 #갓겜 #{title}",
  "요즘 {title}만 함 밥도 안 먹고 함 이러다 손목 나갈 듯 근데 못 끊음 ㅋㅋㅋ",
  "{title} 세일할 때 산 거 진심 개이득… 이 가격에 이 퀄이 말이 되냐 스팀… 아니 증기 만세",
  "다들 {title} 하라고 노래를 부르길래 깔았는데 왜 이제 함? 3시간이 3분 같음 시간 순삭 주의",
  "{title} 첫 보스한테 47번 죽고 드디어 깼다 컨트롤러 안 부순 나 칭찬해 #소울겜 #존버승리",
  "친구랑 {title} 멀티 돌리는데 이거 우정파괴 게임 아님?? 웃다가 싸우다가 화해함 완전 추천",
  "{title} 도전과제 100% 방금 찍었다 이제 뭐하고 살지… 현자타임 오는 갓겜의 저주",
  "솔직히 {title} 초반엔 노잼인 줄 알았는데 후반 가니까 미쳤음 참고 한 나 자신 칭찬 #입문추천",
];
