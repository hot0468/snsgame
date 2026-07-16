import type { AttributeId, TweetMedia } from "@/core/types";

/**
 * 추천탭에 매일 스폰되는 광고 트윗 템플릿.
 * - 브랜드 계정 페르소나(이름/핸들) + 실제 SNS 광고 카피 톤(과장·유머 허용, 실존 상표는 패러디).
 * - media: 광고 이미지/영상 자리(모자이크 설명만). 미디어 클릭 시 +AD_REWARD원(트윗당 1회) — 적립 로직은 systems가 처리.
 * - app: 지정되면 '앱 홍보 광고'로, '바로가기' 클릭 시 해당 브라우저 탭이 해금된다(해금 로직은 systems/ui가 처리).
 * 데이터는 선언만 하며, 스폰·적립·해금 규칙은 systems/adTweets.ts가 담당한다.
 */
export interface AdTweetTemplate {
  authorName: string;
  authorHandle: string;
  attribute: AttributeId;
  text: string;
  media: TweetMedia;
  /** 앱 홍보 광고면 '바로가기'로 해금할 탭 */
  app?: "youtube" | "medibooks" | "steam";
}

const P = (prompt: string): TweetMedia => ({ kind: "photo", prompt });
const V = (prompt: string): TweetMedia => ({ kind: "video", prompt });

/** 미디어 클릭 시 적립되는 광고 리워드(원). */
export const AD_REWARD = 100;

/** 일반 상품/서비스 광고(앱 해금 없음, 미디어 클릭 적립만). */
export const GENERIC_AD_TEMPLATES: AdTweetTemplate[] = [
  {
    authorName: "배달의노예",
    authorHandle: "baedal_slave",
    attribute: "food",
    text: "😱 오늘 저녁 뭐 먹지 고민은 그만! 첫 주문 15,000원 할인 쿠폰 뿌립니다 지금 안 받으면 손해 #배달의노예 #오늘도야식각",
    media: P("치킨·떡볶이·피자가 한 상 가득 차려진 배달 음식 광고 이미지, 하단에 '첫 주문 15,000원 할인' 쿠폰 배너"),
  },
  {
    authorName: "쿠파로켓",
    authorHandle: "coopa_rocket",
    attribute: "daily",
    text: "🚀 밤 12시 전에 주문하면 내일 아침 문 앞 도착! 안 사면 나만 손해인 로켓세일 오픈 세상 편한 쇼핑은 여기 #쿠파로켓 #새벽배송",
    media: V("택배 상자가 로켓처럼 문 앞에 순간이동하는 과장된 쇼핑앱 광고 영상, '내일 아침 도착' 자막"),
  },
  {
    authorName: "궁수전설 리부트",
    authorHandle: "gungsu_rvt",
    attribute: "gaming",
    text: "🏹 지금 설치하면 전설 등급 활 + 다이아 3000개 무료 지급! 출시 3일 만에 100만 다운로드 손가락만 있으면 누구나 갓겜 입문 #궁수전설 #방치형",
    media: V("화려한 이펙트로 몬스터를 쓸어담는 모바일 방치형 게임 플레이 영상, '전설 활 무료 지급' 팝업"),
  },
  {
    authorName: "토스뱅킁",
    authorHandle: "toss_banking",
    attribute: "info",
    text: "💰 파킹통장 연 5% 이벤트?! 하루만 넣어도 이자 붙습니다 은행 이자 이거 실화냐 소리 나오는 특판 지금 딱 오픈했어요 #토스뱅킁 #고금리특판",
    media: P("스마트폰 화면에 '연 5.0% 파킹통장' 문구와 쌓이는 이자 그래프가 뜬 금융앱 광고 이미지"),
  },
  {
    authorName: "글로우랩",
    authorHandle: "glowlab_kr",
    attribute: "beauty",
    text: "✨ 바른 다음 날 거울 보고 놀란 사람 후기 폭발 중… 물광 세럼 오늘 하루 1+1 마지막 찬스 안 써본 사람은 있어도 한 번만 쓴 사람은 없다는 그 세럼 #글로우랩",
    media: P("세럼 한 방울과 물광 피부 클로즈업, '1+1 오늘 마감' 라벨이 붙은 뷰티 광고 이미지(모델 얼굴은 모자이크)"),
  },
  {
    authorName: "혼밥천국 밀키트",
    authorHandle: "honbap_kit",
    attribute: "cooking",
    text: "🍲 요리 1도 몰라도 5분이면 완성! 마라탕·부대찌개·감바스 밀키트 첫 구매 990원 자취생 눈물의 특가 냉장고에 쟁여두면 든든 #혼밥천국 #밀키트",
    media: P("전자레인지 5분 조리로 완성된 마라탕 밀키트 사진, '첫 구매 990원' 스티커"),
  },
  {
    authorName: "챗도비 AI",
    authorHandle: "chatdovi_ai",
    attribute: "it",
    text: "🤖 보고서·자소서·코드까지 3초 만에 뚝딱… 이거 쓰고 야근 사라졌다는 후기 실화 무료체험 7일 지금 시작 안 쓰는 사람이 바보 되는 세상 #챗도비 #AI비서",
    media: V("타이핑 한 줄에 문서·표·코드가 자동으로 채워지는 AI 도구 데모 영상, '7일 무료' 배너"),
  },
  {
    authorName: "홈트짐 24",
    authorHandle: "hometgym24",
    attribute: "fitness",
    text: "💪 헬스장 등록만 하고 안 가는 당신… 집에서 하루 15분이면 끝! 3개월 만에 인생 바뀐 사람들 후기 지금 첫 달 100원 이벤트 진행 중 #홈트짐 #오운완",
    media: V("좁은 원룸에서 15분 홈트로 땀 흘리는 회원 비포·애프터 영상, '첫 달 100원' 자막"),
  },
  {
    authorName: "무진장 세일",
    authorHandle: "mujinjang_kr",
    attribute: "daily",
    text: "🔥 브랜드 운동화 최대 80% 폭탄세일 떴다 재고 진짜 얼마 없음… 장바구니 담다가 품절되면 그건 인연이 아닌 것 카드 즉시할인까지 중복 #무진장 #시즌오프",
    media: P("운동화와 패딩이 산더미처럼 쌓인 '최대 80% OFF' 세일 매대 광고 이미지"),
  },
];

/** '너튜브'(영상 플랫폼) 홍보 광고 — 바로가기 클릭 시 너튜브 탭 해금. */
export const YOUTUBE_AD_TEMPLATES: AdTweetTemplate[] = [
  {
    authorName: "너튜브 공식",
    authorHandle: "nutube_kr",
    attribute: "daily",
    text: "▶️ 심심할 땐 역시 너튜브! 애니·먹방·게임·브이로그까지 밤새 봐도 안 끝나는 영상 지금 바로가기 눌러서 첫 화면 구경하러 오세요 알고리즘이 당신을 기다립니다 #너튜브",
    media: V("추천 영상 썸네일이 끝없이 스크롤되는 너튜브 앱 첫 화면 소개 영상, '지금 바로 시청' 버튼 강조"),
    app: "youtube",
  },
  {
    authorName: "너튜브 공식",
    authorHandle: "nutube_kr",
    attribute: "anime",
    text: "🍿 신작 애니 1화 무료 공개 중! 남들 다 보는 화제작 나만 못 봤다고? 바로가기 한 번이면 오늘부터 정주행 시작 광고 스킵은 덤 #너튜브 #신작애니",
    media: V("인기 애니·예능 클립이 빠르게 지나가는 하이라이트 영상, '1화 무료' 자막과 재생 버튼"),
    app: "youtube",
  },
  {
    authorName: "너튜브 공식",
    authorHandle: "nutube_kr",
    attribute: "gaming",
    text: "🎮 요즘 뜨는 게임 공략, 실시간 스트리밍까지 전부 여기! 구독하면 알림으로 챙겨줌 바로가기 눌러 채널 구경하고 내 최애 스트리머 찾아보세요 #너튜브 #게임방송",
    media: V("게임 실시간 방송 화면과 폭발하는 채팅창을 담은 스트리밍 홍보 영상, '바로 보기' 배너"),
    app: "youtube",
  },
];

/** '미디북스'(전자책·웹툰 플랫폼) 홍보 광고 — 바로가기 클릭 시 미디북스 탭 해금. */
export const MEDIBOOKS_AD_TEMPLATES: AdTweetTemplate[] = [
  {
    authorName: "미디북스",
    authorHandle: "medibooks_kr",
    attribute: "info",
    text: "📚 웹툰·웹소설·전자책 수만 권이 손안에! 첫 결제 없이 매일 무료 코인으로 골라 읽는 재미 지금 바로가기 눌러 오늘의 무료작 받아가세요 #미디북스 #오늘도정주행",
    media: P("스마트폰에 웹툰·웹소설 표지가 격자로 가득 뜬 미디북스 서재 화면, '매일 무료 코인' 배너"),
    app: "medibooks",
  },
  {
    authorName: "미디북스",
    authorHandle: "medibooks_kr",
    attribute: "anime",
    text: "🔥 지금 1위 웹툰, 다음 화 궁금해서 잠 못 잔다는 그 작품… 1화부터 정주행 무료! 바로가기 딱 한 번이면 오늘 밤 일정 사라집니다 책임 안 짐 #미디북스 #웹툰추천",
    media: P("화제의 웹툰 대표 컷과 '1~5화 무료' 띠지가 붙은 미디북스 신작 홍보 이미지"),
    app: "medibooks",
  },
  {
    authorName: "미디북스",
    authorHandle: "medibooks_kr",
    attribute: "daily",
    text: "☕ 출퇴근 지하철이 순삭되는 마법… 전자책 리더기 없이 폰 하나로 베스트셀러 완독 첫 달 무제한 이용권 이벤트 중이니 바로가기로 확인해봐요 #미디북스 #전자책",
    media: P("지하철에서 스마트폰으로 전자책을 읽는 장면과 '첫 달 무제한' 문구가 담긴 미디북스 광고 이미지(인물 얼굴 모자이크)"),
    app: "medibooks",
  },
];

/** '증기'(게임 스토어) 홍보 광고 — 바로가기 클릭 시 증기 탭 해금. */
export const STEAM_AD_TEMPLATES: AdTweetTemplate[] = [
  {
    authorName: "증기 STORE",
    authorHandle: "jeunggi",
    attribute: "gaming",
    text: "🎮 여름 대할인 개막! 명작 게임 최대 90% 폭탄세일 뜸 장바구니 담다 지갑 순삭 주의… 바로가기 눌러서 오늘의 특가 확인하고 인생겜 하나 건져가세요 #증기 #여름세일",
    media: P("게임 커버 수십 개가 격자로 깔리고 '-90%' 빨간 할인 딱지가 곳곳에 붙은 증기 스토어 여름세일 첫 화면, 다크블루 톤"),
    app: "steam",
  },
  {
    authorName: "증기 STORE",
    authorHandle: "jeunggi",
    attribute: "gaming",
    text: "🕹️ 무료로 시작하는 갓겜만 모았다! 설치만 하면 오늘 밤 순삭 보장 친구랑 같이 하면 우정도 순삭 바로가기로 무료게임 라이브러리 구경 오세요 #증기 #무료플레이",
    media: V("무료플레이 게임 플레이 장면이 빠르게 지나가는 증기 스토어 홍보 영상, '무료 시작' 버튼과 다운로드 카운터 강조"),
    app: "steam",
  },
  {
    authorName: "증기 STORE",
    authorHandle: "jeunggi",
    attribute: "gaming",
    text: "⭐ '압도적으로 긍정적' 평가만 골라 담은 명작 컬렉션 공개! 실패 없는 게임 고르기 힘들었죠? 바로가기 한 번이면 검증된 갓겜 리스트가 쫙 #증기 #갓겜모음",
    media: P("'압도적으로 긍정적' 라벨이 붙은 게임 카드들이 캐러셀로 나열된 증기 스토어 추천 배너, 별점과 리뷰수 강조"),
    app: "steam",
  },
];
