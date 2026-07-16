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
  | "pushtime"
  | "yabam"
  | "dartpin"
  | "stocks"
  | "shop";

/** SNS 중앙 영역에서 보여줄 페이지(팝업 대신 인라인으로 전환) */
export type SnsPage = "home" | "explore" | "posts" | "search" | "tweet" | "dm" | "ad" | "me";

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
  /** 고양이 전원 버튼 블랙아웃 연출 중인지(2초 후 팝업으로 이어진다) */
  catBlackout: boolean;
  /** 멘션이 펼쳐진 트윗 id 집합(전체 재렌더에도 유지) */
  expandedTweets: Set<string>;

  /** 현재 SNS 중앙 페이지 */
  snsPage: SnsPage;
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
  /** 트윗 상세 페이지: 단독으로 펼쳐 볼 내 트윗 id(null이면 미선택) */
  tweetDetailId: string | null;
  /** 쪽지 페이지: 선택된 대화 스레드 id */
  dmThreadId: string | null;
  /** 이미 좋아요/악플 반응을 남긴 남의 트윗 id 집합 */
  reactedTweetIds: Set<string>;
  /** 홈 피드 탭: 추천(내 타임라인) / 팔로잉(팔로우한 계정 트윗) */
  homeTab: "recommend" | "following";
  /** 팔로잉 탭에 표시 중인 랜덤 트윗들 */
  followingFeed: Tweet[];
  /** 네이놈 포털에서 열어본 기사 id(null이면 목록) */
  portalArticleId: string | null;
  /** 너튜브 탭에 표시 중인 랜덤 영상 목록 */
  youtubeVideos: Video[];
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
  /** '서던피스' 경매장이 열려 있는지(피메일 초대장 링크로만 진입, 탭 이동 시 닫힘) */
  auctionSiteOpen: boolean;
  /** 피메일에서 선택해 열어본 메일 id */
  mailSelectedId: string | null;
  /** 마켓걸리버 장바구니에 담은 식재료 id 목록(중복 허용) */
  groceryCart: string[];
  /** 야밤 사이트에서 보고 있는 섹션(성인영상/토토/성인용품) */
  yabamSection: "video" | "toto" | "product";
  /** 다트 핀에서 열어본 게시물 id(null이면 목록) */
  dartpinPostId: string | null;
}

export function createUIState(): UIState {
  return {
    activeTab: "sns",
    startMenuOpen: false,
    calendarOpen: false,
    calendarMonthOffset: 0,
    modal: null,
    toast: null,
    catBlackout: false,
    expandedTweets: new Set(),
    snsPage: "home",
    exploreAccounts: [],
    exploreSelectedId: null,
    explorePosts: [],
    searchCategory: null,
    searchPosts: [],
    tweetDetailId: null,
    dmThreadId: null,
    reactedTweetIds: new Set(),
    homeTab: "recommend",
    followingFeed: [],
    portalArticleId: null,
    youtubeVideos: [],
    youtubeFitnessMode: false,
    wishSiteOpen: false,
    wishOptions: [],
    goblinSiteOpen: false,
    onetSiteOpen: false,
    auctionSiteOpen: false,
    mailSelectedId: null,
    groceryCart: [],
    yabamSection: "video",
    dartpinPostId: null,
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
  toast: (message: string) => void;
  /**
   * 행동 직후 이벤트 발생을 시도한다.
   * 다른 모달이 떠 있으면 겹치지 않도록 그냥 넘어간다.
   */
  afterAction: (trigger: EventTrigger) => void;
}
