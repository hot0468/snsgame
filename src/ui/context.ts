import type { Store } from "@/core/store";
import type { Account, AttributeId, Tweet } from "@/core/types";
import type { EventTrigger } from "@/data/events";
import type { Video } from "@/data/videos";

export type BrowserTabId =
  | "sns"
  | "search"
  | "blank"
  | "youtube"
  | "medibooks"
  | "steam"
  | "housing"
  | "mail"
  | "grocery"
  | "peemang"
  | "pushtime"
  | "yabam"
  | "dartpin"
  | "stocks"
  | "shop";

/** SNS 중앙 영역에서 보여줄 페이지(팝업 대신 인라인으로 전환) */
export type SnsPage = "home" | "explore" | "posts" | "search" | "tweet" | "dm" | "ad" | "me" | "profile";

/** 내 트윗 피드를 한 번에 몇 개까지 그릴지(윈도잉 단위). "더 보기"가 이만큼씩 늘린다.
 *  전체 재렌더가 리스트를 통째로 DOM에 그리므로, 긴 타임라인을 전량 렌더하면 상호작용마다 렉이 낀다. */
export const FEED_PAGE = 30;

/** 렌더링에만 쓰이는 휘발성 UI 상태(게임 저장 대상 아님) */
export interface UIState {
  activeTab: BrowserTabId;
  startMenuOpen: boolean;
  calendarOpen: boolean;
  /** 달력에서 보고 있는 월 오프셋(0=이번 달, -1=지난달 …) */
  calendarMonthOffset: number;
  /** 현재 떠 있는 모달을 그리는 함수. null이면 없음 */
  modal: ((ctx: GameContext) => HTMLElement) | null;
  toast: string | null;
  /** 현재 토스트 색조(빨강=부정/초록=긍정). null이면 기본(중립). */
  toastKind: "bad" | "good" | null;
  /** 고양이 전원 버튼 블랙아웃 연출 중인지(2초 후 팝업으로 이어진다) */
  catBlackout: boolean;
  /** 멘션이 펼쳐진 트윗 id 집합(전체 재렌더에도 유지) */
  expandedTweets: Set<string>;
  /** 내 트윗 피드(홈 추천·내 프로필 게시물)를 현재 몇 개까지 그리는지. "더 보기"로 FEED_PAGE씩 증가. */
  feedShown: number;

  /** 현재 SNS 중앙 페이지 */
  snsPage: SnsPage;
  /** "profile" 페이지에 표시할 남의 계정(아무 트윗 아바타 클릭 시 세팅). null이면 없음 */
  viewProfile: Account | null;
  /** "profile"에서 뒤로가기로 돌아갈 페이지(프로필 진입 직전 페이지) */
  profilePrevPage: SnsPage;
  /** 탐색 페이지: 표시 중인 랜덤 계정들 */
  exploreAccounts: Account[];
  /** 탐색 페이지: 상세 프로필로 연 계정 id(null이면 목록) */
  exploreSelectedId: string | null;
  /** 둘러보기 페이지: 표시 중인 랜덤 트윗들 */
  explorePosts: Tweet[];
  /** 검색 페이지: 현재 선택된 카테고리(성향). null이면 미선택 */
  searchCategory: AttributeId | null;
  /** 검색 페이지: 현재 카테고리의 랜덤 트윗들 */
  searchPosts: Tweet[];
  /** 검색 페이지: 단어 검색어(Enter 확정). 비어 있으면 카테고리 결과를 보여준다. */
  searchQuery: string;
  /** 검색 페이지: 단어 검색 결과(searchQuery로 검색한 트윗들) */
  searchWordPosts: Tweet[];
  /** 트윗 상세 페이지: 단독으로 펼쳐 볼 내 트윗 id(null이면 미선택) */
  tweetDetailId: string | null;
  /** 쪽지 페이지: 선택된 대화 스레드 id */
  dmThreadId: string | null;
  /**
   * 방금 연 스레드의 '안 읽은 첫 메시지' 위치 — app.ts가 그 말풍선을 화면 맨 위로 스크롤한다.
   * `len`(앵커를 잡을 때의 메시지 수)이 달라지거나 스레드를 바꾸면 dmPage가 버린다
   * (그 뒤로는 평소대로 맨 아래로 붙는다). 렌더 1회로 못 끊는다 —
   * 읽음 처리 dispatch가 microtask 뒤 재렌더를 한 번 더 부른다.
   */
  dmUnreadAnchor: { threadId: string; index: number; len: number } | null;
  /** 이미 좋아요/악플 반응을 남긴 남의 트윗 id 집합(재반응 차단용) */
  reactedTweetIds: Set<string>;
  /** 좋아요(긍정)를 누른 남의 트윗 id 집합 — 하트 채움 표시용(악플과 구분). */
  likedTweetIds: Set<string>;
  /** 홈 피드 탭: 추천(내 타임라인) / 팔로잉(팔로우한 계정 트윗) */
  homeTab: "recommend" | "following";
  /** 미디북스 탭: 홈(일반 도서) / 성인(성인물 보기 ON일 때만) */
  medibooksTab: "home" | "adult";
  /** 미디북스 홈 도서 필터(상단 메뉴 도서/만화): 일반도서(만화 제외) / 만화 */
  medibooksFilter: "book" | "comic";
  /** 팔로잉 탭에 표시 중인 랜덤 트윗들 */
  followingFeed: Tweet[];
  /** 추천 탭에 표시 중인 남의 트윗들(하루치 조합). 날짜가 바뀌면 재생성한다. */
  homeFeed: Tweet[];
  /** 현재 homeFeed가 생성된 게임 날짜(day) */
  homeFeedDay?: number;
  /** 네이놈 포털에서 열어본 기사 id(null이면 목록) */
  portalArticleId: string | null;
  /** 너튜브 탭에 표시 중인 랜덤 영상 목록 */
  youtubeVideos: Video[];
  /** 현재 너튜브 목록이 생성된 게임 날짜(day). 날짜가 바뀌면 재생성한다. */
  youtubeVideosDay?: number;
  /** 너튜브 검색창 입력값(Enter 확정). 빈 문자열이면 홈 목록을 보여준다. */
  youtubeSearch: string;
  /** 현재 너튜브 목록이 운동/스포츠 영상을 포함해 생성됐는지(운동 스탯 30 초과) */
  youtubeFitnessMode: boolean;
  /** '소원을 이루어주는 가게' 사이트가 열려 있는지(탭 이동 시 닫히고 재진입 불가) */
  wishSiteOpen: boolean;
  /** 소원 가게에 표시 중인 소원 3개(wish id) */
  wishOptions: string[];
  /** '도깨비 상점' 사이트가 열려 있는지(탭 이동 시 닫힘) */
  goblinSiteOpen: boolean;
  /** 'O넷' 자격증 사이트가 열려 있는지(탭 이동 시 닫힘, 재진입 제한 없음) */
  onetSiteOpen: boolean;
  /** EBS 강의 사이트가 열려 있는지(네이놈 '듄' 검색으로 진입, 탭 이동 시 닫힘) */
  ebsSiteOpen: boolean;
  /** 재능마켓(외주) 사이트가 열려 있는지(네이놈 '외주' 검색으로 진입, 탭 이동 시 닫힘) */
  gigSiteOpen: boolean;
  /** 달빛운수(택시 채용) 오버레이가 열려 있는지 — 네이놈 '택시' 검색으로 진입 */
  taxiSiteOpen: boolean;
  /** 한소리고객센터(콜센터 채용) 오버레이 — 네이놈 '콜센터' 검색으로 진입 */
  callCenterSiteOpen: boolean;
  /** 세이신내과의원 사이트가 열려 있는지(네이놈 '내과'/'순환기내과' 검색으로 진입, 탭 이동 시 닫힘) */
  hospitalSiteOpen: boolean;
  /** 직플래닛(기업정보) 사이트가 열려 있는지(채용공고 '직플래닛' 버튼으로 진입, 탭 이동 시 닫힘) */
  jobplanetSiteOpen: boolean;
  /** 직플래닛 업체명 검색어(엔터/버튼으로 확정, 재렌더 넘어 유지). 빈 문자열이면 전체. */
  jobplanetQuery: string;
  /** '서던피스' 경매장이 열려 있는지(피메일 초대장 링크로만 진입, 탭 이동 시 닫힘) */
  auctionSiteOpen: boolean;
  /** 피메일에서 선택해 열어본 메일 id */
  mailSelectedId: string | null;
  /** 마켓걸리버 장바구니에 담은 식재료 id 목록(중복 허용) */
  groceryCart: string[];
  /** 피망마켓에서 보고 있는 면(동네 매물 사기 / 내 물건 팔기) */
  peemangTab: "buy" | "sell";
  /** 야밤 사이트에서 보고 있는 섹션(성인영상/토토/성인용품) */
  yabamSection: "video" | "toto" | "product";
  /** 다트 핀에서 열어본 게시물 id(null이면 목록) */
  dartpinPostId: string | null;
  /** 주소창 ⋮ 메뉴(개발자 도구 진입로) 팝오버가 열려 있는지 */
  settingsMenuOpen: boolean;
  /** 'd스토리' 블로그가 열려 있는지(IT계 검색의 링크 트윗으로만 진입, 탭 이동 시 닫힘) */
  dstorySiteOpen: boolean;
  /** d스토리에서 열어본 게시글 id(null이면 목록) */
  dstoryPostId: string | null;
  /** '니글니글' 취업 지원 사이트가 열려 있는지(주소창에 NIGL_URL 입력으로만 진입, 탭 이동 시 닫힘) */
  niglSiteOpen?: boolean;
  /** 방문기록 페이지가 열려 있는지(⋮ 메뉴로 진입, 탭 이동 시 닫힘) */
  historySiteOpen: boolean;
  /** 괴담 사이트(goedam.kr)가 열려 있는지(hosts 매핑 후 주소창 입력으로 진입, 탭 이동 시 닫힘) */
  goedamSiteOpen: boolean;
  /** momo.com(에로서적·킬러 진입로)이 열려 있는지(주소창 momo.com 입력, 성인모드 필요) */
  momoSiteOpen: boolean;
  /** 괴담 사이트에서 열어본 글 id(null이면 목록) */
  goedamStoryId: string | null;
}

export function createUIState(): UIState {
  return {
    activeTab: "sns",
    startMenuOpen: false,
    calendarOpen: false,
    calendarMonthOffset: 0,
    modal: null,
    toast: null,
    toastKind: null,
    catBlackout: false,
    expandedTweets: new Set(),
    feedShown: FEED_PAGE,
    snsPage: "home",
    viewProfile: null,
    profilePrevPage: "home",
    exploreAccounts: [],
    exploreSelectedId: null,
    explorePosts: [],
    searchCategory: null,
    searchPosts: [],
    searchQuery: "",
    searchWordPosts: [],
    tweetDetailId: null,
    dmThreadId: null,
    dmUnreadAnchor: null,
    reactedTweetIds: new Set(),
    likedTweetIds: new Set(),
    homeTab: "recommend",
    medibooksTab: "home",
    medibooksFilter: "book",
    followingFeed: [],
    homeFeed: [],
    portalArticleId: null,
    youtubeVideos: [],
    youtubeSearch: "",
    youtubeFitnessMode: false,
    wishSiteOpen: false,
    wishOptions: [],
    goblinSiteOpen: false,
    onetSiteOpen: false,
    ebsSiteOpen: false,
    gigSiteOpen: false,
    taxiSiteOpen: false,
    callCenterSiteOpen: false,
    hospitalSiteOpen: false,
    jobplanetSiteOpen: false,
    jobplanetQuery: "",
    auctionSiteOpen: false,
    mailSelectedId: null,
    groceryCart: [],
    peemangTab: "buy",
    yabamSection: "video",
    dartpinPostId: null,
    settingsMenuOpen: false,
    dstorySiteOpen: false,
    dstoryPostId: null,
    historySiteOpen: false,
    goedamSiteOpen: false,
    goedamStoryId: null,
    momoSiteOpen: false,
  };
}

/** 모든 UI 컴포넌트에 전달되는 컨텍스트 */
export interface GameContext {
  store: Store;
  ui: UIState;
  /** 게임 상태를 바꾸는 헬퍼(dispatch 래핑) */
  update: (fn: (draft: import("@/core/types").GameState) => void) => void;
  /** UI 상태만 바꾸고 재렌더 */
  refresh: () => void;
  openModal: (render: (ctx: GameContext) => HTMLElement) => void;
  closeModal: () => void;
  /**
   * 토스트를 띄운다. kind로 색조를 지정("bad"=빨강/"good"=초록).
   * 생략하면 메시지 내용으로 부정 여부를 추정해 부정이면 빨강으로 표시한다.
   */
  toast: (message: string, kind?: "bad" | "good") => void;
  /**
   * 행동 직후 이벤트 발생을 시도한다.
   * 다른 모달이 떠 있으면 겹치지 않도록 그냥 넘어간다.
   */
  afterAction: (trigger: EventTrigger) => void;
}
