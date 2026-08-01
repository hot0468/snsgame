/**
 * 게임 전역에서 공유하는 도메인 타입 정의.
 * 데이터/시스템/UI 계층이 모두 이 타입에 의존한다.
 */

/** 계정·게시글·트윗의 성향(속성) 키 */
export type AttributeId =
  | "daily" // 일상계
  | "politics" // 정치계
  | "idol" // 아이돌덕
  | "anime" // 애니덕
  | "actor" // 배우덕
  | "gaming" // 게임계
  | "food" // 먹방계
  | "fitness" // 운동계
  | "beauty" // 뷰티계
  | "humor" // 개그계
  | "info" // 정보계
  | "it" // IT계
  | "dog" // 강아지계(내 강아지 주접)
  | "cat" // 고양이계(내 고양이 주접)
  | "animal" // 동물계(반려동물이 아닌 동물)
  | "plant" // 식물계
  | "cooking" // 요리계
  | "finance" // 재테크/주식계
  | "sports" // 스포츠계
  | "fashion" // 패션계(OOTD)
  | "travel" // 여행계
  | "adult"; // 성인계

/**
 * 트윗 성격 — 계열(AttributeId)과 독립된 축. 작성 시 4종 후보 중 하나를 골라 등록한다.
 * 성과 계산에 실제 리스크/보상을 준다(가짜 톤 선택을 대체). 효과는 systems/followers.ts의
 * TWEET_KIND_EFFECTS가 정의한다. 이 배열 순서가 UI 카드 순서이자 content의 kinds 풀 순서다.
 * - plain(무난): 기준점, 리스크 없음
 * - provoke(자극): 고성과·고분산 + 논란 확률↑·평판 리스크
 * - info(정보): 유입 소폭↓ 대신 평판↑·지식 스킬↑
 * - emotional(감성): 유입↑, 부가 이득 없음
 */
export const TWEET_KINDS = ["plain", "provoke", "info", "emotional"] as const;
export type TweetKind = (typeof TWEET_KINDS)[number];

/** 데려올 수 있는 반려동물 종류 */
export type PetKind = "dog" | "cat";

/**
 * 성인 트윗의 종류.
 * "sekt"(섹트)는 세분화 없는 일반 성인 트윗으로 성인모드 ON이면 항상 사용 가능(기본 해금).
 * meetup/punish/dom은 야밤 성인용품 리뷰로 해금, group은 그룹 이벤트(groupUnlocked)로 해금.
 */
export type AdultKind = "sekt" | "meetup" | "punish" | "dom" | "group";

/** 성인 DM으로 오는 성기 사진의 크기(5단계) */
export type DickSize = "tiny" | "small" | "average" | "big" | "huge";

/** 남의 트윗에 붙는 이스터에그 종류(좋아요 시 특수 이벤트) */
export type EggKind = "coin" | "pyramid" | "animal";

/** 이스터에그·특수 이벤트 추적 상태 */
export interface EggState {
  /** 연속 심야 트윗 일수 */
  lateStreak: number;
  /** 마지막으로 심야 트윗한 일차(연속 판정) */
  lastLateDay: number;
  /** 봇/유령 계정 팔로우 누적 */
  botFollows: number;
  /** 동물 트윗 좋아요 누적 */
  animalLikes: number;
  /** 남 계정 핸들별 좋아요+리트윗 누적(찐친 판정) */
  authorEngage: Record<string, number>;
  /** 상품 광고 트윗을 올린 일차 목록(최근 7일 판정) */
  adDays: number[];
  /** 1회성 이벤트 발동 여부 */
  done: Record<string, boolean>;
}

/** 리소스형 스탯(행동으로 소모/회복) */
export type ResourceStatId = "action" | "mental" | "morality" | "reputation";

/** 성장형 세부 스탯(높을수록 연계 트윗 성과 상승) */
export type SkillStatId =
  | "fitness" // 운동
  | "beauty" // 미용
  | "vocabulary" // 어휘력
  | "knowledge" // 지식
  | "sociability" // 친화력
  | "comedy" // 개그
  | "creativity" // 창작
  | "lewd" // 음란 — '얼마나 야한가'(정도). 일반적인 관계까지만 연다.
  | "pervert" // 변태력 — '어느 방향인가'(취향). 강압·페티쉬 콘텐츠의 별도 게이트.
  | "game" // 게임
  | "it" // IT
  | "otaku"; // 덕질

export type StatId = ResourceStatId | SkillStatId;

/** 내 트윗에 달린 멘션(답글) */
export interface TweetReply {
  id: string;
  authorName: string;
  authorHandle: string;
  attribute: AttributeId;
  text: string;
  likes: number;
  /** 내가 좋아요를 눌렀는지 */
  likedByMe?: boolean;
  /** 내가 단 답글(있으면 멘션 아래 표시) */
  myReply?: string;
}

/** 특별 진행이 있는 행사 종류(예: 코믹콘은 참관객/부스/코스프레 선택) */
export type EventVariant = "comiccon";

/** 트윗에 첨부된 사진/영상 자리(실제 파일 없이 설명 프롬프트만) */
export interface TweetMedia {
  kind: "photo" | "video";
  /** 클릭 시 뜨는 사진/영상 설명 프롬프트 */
  prompt: string;
}

/** 아이돌/애니/배우 트윗에 가끔 붙는 행사 정보(참여하기 대상) */
export interface TweetEvent {
  /** 행사명(스케줄 등록용) */
  title: string;
  /** 행사 예정일(일차) */
  day: number;
  /** 행사 시간대 슬롯 */
  slot: number;
  attribute: AttributeId;
  /** 특별 진행이 있는 행사면 그 종류 */
  variant?: EventVariant;
  /** 관람 전에 티켓팅이 필요한 행사인지(무대인사·GV·콘서트) */
  ticketing?: boolean;
  /** 이미 참여 신청했는지 */
  joined?: boolean;
}

/** 하나의 트윗(내 글 또는 남의 글) */
export interface Tweet {
  id: string;
  authorName: string;
  authorHandle: string;
  attribute: AttributeId;
  isAdult: boolean;
  text: string;
  createdDay: number; // 게임 내 일차
  likes: number;
  retweets: number;
  /** 이 트윗으로 얻은 신규 팔로워(내 트윗일 때만 의미) */
  gainedFollowers: number;
  /** 내가 남의 트윗을 리트윗해 내 타임라인에 올린 항목인지 */
  isRetweet?: boolean;
  /** 리트윗 항목일 때 원본 트윗 id(중복 리트윗 방지용) */
  retweetSourceId?: string;
  /**
   * 인용 트윗(QRT)일 때 원문 스냅샷(원문 id 참조가 아니라 값 복사 — 세이브 안정).
   * ui가 이 값을 인용 카드로 렌더한다(systems/quote가 채운다).
   */
  quoted?: { authorName: string; authorHandle: string; text: string; attribute: AttributeId };
  /** 이 트윗에 달린 멘션(답글) — 내 트윗일 때 생성 */
  replies?: TweetReply[];
  /** 행사 안내 트윗이면 그 정보(참여하기 버튼 노출) */
  event?: TweetEvent;
  /** 첨부된 사진/영상(자리만, 클릭 시 설명 팝업) */
  media?: TweetMedia;
  /**
   * 게시 시점에 고정된 미디어 이미지(내가 등록한 트윗 전용).
   * imageForTweet은 등록 이미지 풀 크기로 hash%len을 굴려 풀이 늘면 같은 트윗도 다른 이미지가
   * 뽑힐 수 있다 — 게시 순간의 이미지를 여기 박제해 다음날에도 바뀌지 않게 한다.
   * adult=성인 풀 출처(블러 대상) 여부. 없으면(NPC/피드 트윗) imageForTweet으로 매번 해석.
   */
  mediaImage?: { url: string; adult: boolean };
  /**
   * 글 난이도(0~999 — 어휘력과 같은 스킬 스케일).
   * 읽는 사람의 어휘력이 이보다 낮으면 그만큼 글자가 깨져 보인다.
   * 남의 트윗에만 설정되며, 내 트윗엔 없다.
   */
  difficulty?: number;
  /** 이스터에그 트윗이면 그 종류(좋아요 시 특수 이벤트) */
  egg?: EggKind;
  /** 내 상품 광고 트윗인지 */
  isAd?: boolean;
  /**
   * 추천탭 광고 트윗의 프로모션 정보(기존 isAd와 별개).
   * - reward: 미디어 클릭 시 적립액(원). claimed: 적립 완료 여부(트윗당 1회).
   * - app: '바로가기'로 해금되는 앱 탭(있으면 앱 홍보 광고, 없으면 일반 광고).
   */
  adPromo?: { reward: number; claimed: boolean; app?: "youtube" | "medibooks" | "steam" };
  /**
   * 이 트윗에 첨부된 사이트 링크(광고 아님 — 일반인이 링크를 달아 공유한 트윗).
   *
   * ⚠️ `adPromo`와 혼동하지 마라. **하는 일이 아니라 '무엇으로 보이냐'가 다르다** —
   * 둘 다 결과적으로 브라우저 탭을 해금하지만:
   * - `adPromo.app`: **광고**다. 추천탭 광고 풀(state.adTweets)에 살고, `adTweetCard`가
   *   "광고" 라벨을 붙이며 미디어 클릭을 적립으로 바꾼다(unlockAppTab).
   * - `siteLink`: **광고가 아니다.** 광고 라벨도 적립도 없는, 남이 공유한 링크일 뿐이다.
   *   둘러보기 피드에 섞이고, 링크를 누르면 해당 탭이 해금된다(예: unlockDartpin).
   *
   * 형태가 겹친다고 `adPromo`로 합치지 마라 — 광고 라벨이 붙는 순간 톤이 죽는다.
   * 자세한 근거는 `systems/dartpin.ts` 헤더 참조.
   */
  siteLink?: SiteLinkId;
  /** 굿즈 공동구매 모집 트윗이면 그 정보('공구 참여하기' 버튼 노출). joined면 참여 완료 */
  groupBuy?: { itemId: string; price: number; joined?: boolean };
  /**
   * 창작 트윗이면 그 종류(1차=original / 2차=fan). 있으면 무조건 미디어(그림) 형태로 게시되고,
   * 이미지는 창작 전용 풀(assets/creation/)에서 붙는다(systems/mediaImages.ts의 pickCreationImage).
   */
  creation?: "original" | "fan";
}

/**
 * 트윗 링크가 가리키는 사이트.
 *
 * ⚠️ 여는 방식이 **id마다 다르다** — 하나로 뭉뚱그리지 마라:
 * - `"dartpin"`: **브라우저 탭**으로 열린다(`BrowserTabId`에 같은 id가 있다).
 *   게시판이 매일 갱신돼 재방문이 전제이므로 탭이어야 한다 — `systems/dartpin.ts` 헤더 참조.
 * - `"dstory"`: `ui.dstorySiteOpen` **단발 오버레이**다. 탭이 아니라 해금 상태도 없다.
 *   콘텐츠가 고정 2글이라 재방문 보장이 필요 없고, 두 글을 다 풀기 전까지 링크 트윗이
 *   계속 스폰되므로 재진입로가 이미 있다 — `systems/dstory.ts` 헤더 참조.
 */
export type SiteLinkId = "dartpin" | "dstory";

/** 탐색으로 등장하는 남의 계정 */
export interface Account {
  id: string;
  name: string;
  handle: string;
  attribute: AttributeId;
  isAdult: boolean;
  bio: string;
  followers: number;
  /** 간략 타임라인 미리보기 */
  timeline: Tweet[];
  followed: boolean;
  /** 봇/유령 계정인지(다수 팔로우 시 계정 신뢰도 하락 이벤트) */
  bot?: boolean;
}

/** 달력에 쌓이는 스케줄 이벤트 */
export interface ScheduleEvent {
  id: string;
  day: number;
  title: string;
  kind: "offline" | "sns" | "system";
}

/** DM 한 통 */
export interface DMMessage {
  id: string;
  from: "me" | "partner";
  text: string;
  day: number;
  /** 성인 DM으로 온 성기 사진(있으면 본문 대신 모자이크 사진으로 표시) */
  photoSize?: DickSize;
}

/** DM 대화 스레드(상대 1명과의 대화) */
export interface DMThread {
  id: string;
  partnerName: string;
  partnerHandle: string;
  attribute: AttributeId;
  isAdult: boolean;
  messages: DMMessage[];
  /** 안 읽은 새 메시지가 있는지 */
  unread: boolean;
  /**
   * 지금까지 읽은 메시지 수 — 스레드를 열 때 `messages.length`로 갱신된다.
   * 대화를 열면 UI가 이 지점(= 안 읽은 첫 메시지)이 화면 맨 위에 오도록 스크롤한다.
   * 구세이브엔 없다(그땐 '마지막 상대 말 뭉치의 첫 줄'로 어림한다).
   */
  readCount?: number;
  /**
   * 상대가 마지막으로 던진 화제 id(`DM_TOPICS`). 내 답장 선택지는 **이 화제에 대한 대답**에서만
   * 나온다 — 없으면 직전 상대 말과 내 말이 어긋난다(자세한 이유는 dmContent.ts의 DMTopic 주석).
   * 구세이브·화제를 아직 안 던진 스레드는 undefined이고, 그땐 맥락별 범용 풀로 떨어진다.
   */
  dmTopic?: string;
  /**
   * 스토리 DM 진행 상태(`data/dmStory.ts`). 있으면 이 스레드는 잡담 풀 대신 **스토리 분기**로
   * 답장한다 — 선택지는 현재 노드의 것이고, 고르면 다음 노드로 넘어간다.
   * 스토리가 끝나면 이 필드를 지워 평범한 DM으로 돌아간다.
   *
   * `pendingDay`가 있으면 그 노드의 말이 **아직 도착하지 않았다**("내일 보낼게요" 같은 약속).
   * 그날이 오면 time.onNewDay → deliverPendingStoryNodes가 intro를 넣고 이 필드를 지운다.
   * 그동안은 선택지도 직접 입력도 막힌다(systems/dm.ts의 isStoryPending 게이트).
   */
  story?: { id: string; node: string; pendingDay?: number };
  /** 이미 오프라인에서 만났는지(만남은 상대당 1회) */
  metOffline: boolean;
  /** 상대가 오프라인 만남을 제안했는지(제안해야만 만날 수 있음) */
  wantsToMeet: boolean;
  /**
   * 만남 제안이 온 날(일차). 만남은 이 날 하루만 유효 — 익일이 되면 '만나러 가기'가 비활성화된다.
   * (구세이브엔 없을 수 있어 optional; 없으면 만료 판정을 건너뛴다.)
   */
  meetProposedDay?: number;
  /** 성인 트윗으로 유입된 '모텔 제안' 스레드인지 */
  motel?: boolean;
  /** 모텔 스레드일 때, 어떤 성인 트윗에서 유입됐는지(플레이 종류 결정) */
  motelKind?: AdultKind;
  /** 티켓 양도 제안 스레드인지(콘서트/영화 GV) */
  ticketKind?: "concert" | "gv";
  /**
   * 팔로워 유입으로 생긴 일반 팬 DM 스레드인지.
   * 하루 팬 DM 유입량 제한(MAX_FAN_DM_PER_DAY)을 세는 데 쓴다 — 스토리성 DM
   * (크루/사바나/작가/터커 등)은 이 플래그가 없어 제한에 걸리지 않는다.
   * 구 세이브에는 없다(undefined = 팬 DM 아님으로 취급, 당일 카운트만 살짝 느슨해질 뿐 무해).
   */
  fan?: boolean;
  /** 성기 사진을 보낸 성인 스레드면 그 크기(만남 이벤트 분기에 사용) */
  genitalSize?: DickSize;
  /** 러닝크루 가입 권유 스레드인지(운동 트윗으로 유입) */
  crew?: boolean;
  /**
   * 성인 그룹방 초대 스레드인지(성인 트윗 좋아요로 유입).
   * 수락 시 매주 토 심야 '정기 모임' 약속이 잡힌다.
   */
  groupRoom?: boolean;
  /** 사바나 여캠(라이브방송) 제의 스레드인지(성인 트윗으로 유입) */
  savanna?: boolean;
  /** 플랫폼 작가 계약 제안 스레드인지(창작 트윗이 쌓이면 유입) */
  authorOffer?: boolean;
  /** momo 청부(킬러) 제의 스레드인지. ui가 수락/거절 버튼을 렌더한다(systems/killer). */
  momoOffer?: boolean;
  /** 칠남의 품앗이 동맹 제의 스레드인지. ui가 수락/거절 버튼을 렌더한다(systems/killer). */
  chilnamOffer?: boolean;
  /**
   * '금발의 신사'가 진홍안을 넘겨달라고 제안한 스레드인지(경매에서 진홍안 구매 시 유입).
   * ui는 이 플래그를 보고 넘겨줌/거절 버튼을 렌더하고 resolveEyeDeal을 호출한다.
   * 응답 후에도 스레드는 대화 기록으로 남는다(분기 상태는 state.auction.eyeDeal).
   */
  eyeDeal?: boolean;
  /**
   * '터커'가 연구실 조수를 부탁한 스레드인지(국가연금술사 취득 후 랜덤일에 유입).
   * ui는 이 플래그를 보고 수락/거절 버튼을 렌더하고 resolveLabOffer를 호출한다.
   * eyeDeal과 같은 구조 — 응답 후에도 스레드는 대화 기록으로 남는다(분기 상태는 state.lab.offer).
   */
  labOffer?: boolean;
  /** '까칠한외눈' 소원 가게 링크가 담긴 스레드인지(링크 진입 시 삭제) */
  wishLink?: boolean;
  /** '푸시타임' 링크가 담긴 스레드인지(링크 클릭 시 탭 해금) */
  pushLink?: boolean;
  /** '야밤'(성인 사이트) 링크가 담긴 스레드인지(링크 클릭 시 탭 해금) */
  yabamLink?: boolean;
  /** '불법 스탯 부스트상' 뒷거래 링크가 담긴 스레드인지(거래 후 삭제) */
  boostLink?: boolean;
  /** '의문의 심리테스트' 결과 링크가 담긴 스레드인지(결과 확인 시 삭제) */
  psychoLink?: boolean;
  /** 팬이 후원을 제안한 스레드면 그 정보 */
  donation?: { amount: number; claimed?: boolean };
  /** AV배우 제의 스레드인지(성인 트윗 누적 시 유입). ui가 수락/거절 버튼을 렌더한다 */
  avOffer?: boolean;
  /** 란제리 모델 전속 계약 제의 스레드인지(매력·음란 충분+성인 시 유입). ui가 계약 버튼을 렌더한다 */
  lingerie?: boolean;
  /** 코스프레 촬영 제의 스레드인지(애니덕 트윗 누적 시 유입, 전연령). ui가 촬영 버튼을 렌더한다 */
  cosplay?: boolean;
  /** 취업스터디 모임 가입 권유 스레드인지(불합격 결과 트윗 누적 시 유입, 전연령). ui가 가입 버튼을 렌더한다 */
  study?: boolean;
  /**
   * 사기/피싱 접선 스레드인지(코인 리딩방·다단계 등, 이스터에그 좋아요로 유입).
   * 이런 상대는 로맨스/친구가 아니라 사기꾼이므로 오프라인 만남 제안(maybePropose)을 하지 않는다.
   */
  scam?: boolean;
  /**
   * 다트 핀 글 작성자에게 쪽지를 보내 받은 도움 스레드인지, 그 원본 글 id.
   * 같은 글에 중복 쪽지를 막는 마커다(systems/dartpin.hasDartpinAuthorDM). 렌더는 일반 대화와 동일.
   */
  dartpinHelp?: string;
}

/** 카카오톡 메시지 한 줄 */
export interface KakaoMessage {
  id: string;
  from: "me" | "them";
  text: string;
  day: number;
}

/**
 * 카톡에 담긴 '만나서 놀자' 초대(만남을 완료한 상대가 보냄).
 * 수락하면 제안된 (day, slot)에 friend 약속이 등록된다.
 */
export interface KakaoInvite {
  /** 제안 날짜(일차) */
  day: number;
  /** 제안 시간대 슬롯 */
  slot: number;
  partnerName: string;
  attribute?: AttributeId;
  /** 이미 수락/거절했는지 */
  responded?: boolean;
}

/**
 * 카카오톡 대화(발신자 1명).
 * 이벤트/월세 리마인더 등이 우측 하단 토스트로 도착하고, 클릭하면 메시지창이 뜬다.
 */
export interface KakaoThread {
  id: string;
  /** 발신자 이름(예: 집주인) */
  sender: string;
  /** 프로필 색상 시드(없으면 이름 해시) */
  hue?: number;
  messages: KakaoMessage[];
  /** 아직 안 읽음 */
  unread: boolean;
  /** 우측 하단 토스트로 아직 알림이 떠 있어야 하는지 */
  toastPending: boolean;
  /** '만나서 놀자' 초대가 담긴 카톡이면 그 내용 */
  invite?: KakaoInvite;
  /** 대부업체의 대출 제안이 담긴 카톡이면 그 내용 */
  loanOffer?: KakaoLoanOffer;
  /** 배구부 코치 섭외 카톡이면 그 응답 상태(수락/거절하면 버튼이 사라진다) */
  coachOffer?: { responded: boolean };
  /** 기본 답장 대신 발신자가 지정한 답장 문구(단계별 독촉 등). 없으면 기본 문구 사용. */
  reply?: { me: string; them: string; label?: string };
}

/** 업무 메신저("너아무튼온") 업무 요청 메시지(재직 중 평일 저녁·심야·주말에 도착) */
export interface WorkMsg {
  id: string;
  day: number;
  slot: number;
  /** 업무 요청 본문(데이터 풀에서 선택) */
  text: string;
  /** 토스트 대기(app.ts가 소비) */
  toastPending: boolean;
  /** 수락 완료 */
  resolved: boolean;
}

/** 소지금이 마이너스일 때 오는 대부업체 대출 제안 */
export interface KakaoLoanOffer {
  /** 빌려주는 원금 */
  principal: number;
  /** 갚아야 할 금액(이자 포함) */
  repayAmount: number;
  /** 상환 기한(일 단위) */
  termDays: number;
  /** 이미 수락/거절했는지 */
  responded?: boolean;
}

/** 예정된 약속의 종류 */
export type AppointmentKind =
  | "crew"
  | "friend"
  | "event"
  | "ticketing"
  | "groupRoom"
  | "lingerie"
  | "study"
  | "esthetic"
  | "birthday";

/**
 * 미래에 예정된 약속. 해당 (day, slot)이 되면 '할지/말지' 팝업이 뜬다.
 * (과거의 행동 기록인 ScheduleEvent와 달리, 이건 앞으로 할 일이다.)
 */
export interface Appointment {
  id: string;
  day: number;
  slot: number;
  kind: AppointmentKind;
  title: string;
  /** friend 약속일 때 상대 이름 */
  partnerName?: string;
  /** 관계 캐릭터와의 만남 약속일 때, 그 캐릭터 id(도래 시 resolveMeet 대상). 있으면 관계 만남으로 처리한다. */
  charId?: string;
  /** 카톡에서 내가 제안 → 상대가 수락해 확정된 만남인지. 확정이면 당일 무조건 성사(바람맞음 없음). */
  confirmed?: boolean;
  attribute?: AttributeId;
  /** 행사 약속의 특별 진행 종류(예: 코믹콘) */
  variant?: EventVariant;
  /** ticketing 약속일 때, 성공 시 등록할 실제 행사 정보 */
  ticketFor?: {
    day: number;
    slot: number;
    title: string;
    attribute?: AttributeId;
    variant?: EventVariant;
  };
}

/** 회사 규모(뒤로 갈수록 야근 확률↑, 복지↑) */
export type CompanyTier = "micro" | "small" | "medium" | "large";

/**
 * 채용 직군(트랙) — 합격 판정에 쓰이는 스탯 조합이 이 값으로 갈린다.
 * - `office` 사무직: 어휘력·친화력·미용 (기존 단일 공식. **기본값**)
 * - `fitness` 운동직: 운동·친화력 (트레이너·필라테스·수영강사 등)
 * - `beauty` 뷰티직: 미용·친화력 (헤어·네일·피부관리 등)
 *
 * ⚠️ 값을 추가하면 `systems/employment.TRACK_WEIGHTS`와 `data/jobs.TRACK_LABELS`
 *    (둘 다 `Record<JobTrack, ...>`)를 함께 채워야 한다 — typecheck가 누락을 잡는다.
 * ⚠️ 트랙별 가중치 합은 반드시 1.0이어야 한다. 합이 1이 아니면 0~100 환산이 어긋나
 *    `TIERS[].requirement`(8/28/52/78)와 스케일이 안 맞는다(전원 합격/전원 불합격).
 */
export type JobTrack = "office" | "fitness" | "beauty";

/** 재직 정보('사람' 단위 — 계정과 무관) */
export interface Employment {
  /** 회사 이름 */
  company: string;
  tier: CompanyTier;
  /** 입사한 날(day). 근무는 익일부터 시작 */
  hiredDay: number;
  /** 성과 스탯(0~100, 100 도달 시 성과 레벨업) */
  performance: number;
  /** 성과 레벨(0부터). 오를수록 월급 상승 */
  perfLevel: number;
  /** 오늘 야근이 확정된 날(day). 저녁 블록도 근무. -1이면 없음 */
  overtimeDay: number;
  /** 마지막으로 월급을 준 '달 키'(연*12+월). -1이면 아직 없음 */
  lastSalaryMonth: number;
}

/**
 * AV배우 직업(성인). 성인 트윗 누적 시 DM 제의 → 수락하면 계약.
 * 매월 25일 정산(익월부터), 월 근무일 20일 미만이면 월급 반감.
 * 노콘 촬영 승락 누적마다 월급이 영구 가산된다.
 */
export interface AvJob {
  /** 계약한 날(day). 근무·정산은 익월부터 */
  joinedDay: number;
  /** 이번 달 심야 근무 일수(정산 시 0으로 리셋) */
  workDaysThisMonth: number;
  /** 마지막으로 근무한 day(하루 1회만 카운트). -1이면 없음 */
  lastWorkDay: number;
  /** 이번 달 노콘 촬영 승락 횟수 → 이번 달 월급 +30만/회. 월 정산 시 0으로 리셋(영구 아님). */
  condomlessThisMonth: number;
  /**
   * 계약 이후 **누적** 근무일. 월 리셋을 안 탄다 — 직업 레벨(`systems/jobLevels.ts`)의 근거다.
   * ⚠️ workDaysThisMonth와 함께 올려야 한다. 한쪽만 올리면 레벨이 멈추거나 월급이 어긋난다.
   */
  totalWorkDays: number;
  /** 마지막으로 월급을 준 '달 키'(monthKey). -1이면 없음 */
  lastSalaryMonth: number;
  /**
   * 성병 회복일(day). 노콘 촬영 시 낮은 확률로 감염 → 이 날까지 촬영 불가.
   * state.day가 이 값 이하면 아직 아픈 상태. -1이면 건강.
   */
  stdUntilDay: number;
}

/**
 * 이비에듀 강사직. 지식이 기준치를 넘으면 강사 신청으로 채용된다(겸직 불가).
 * 월급은 **이번 달 수업 횟수 × 회당 강사료**(지식·어휘력·개그 가중합)로 매월 15일 정산한다.
 * 레벨은 누적 수업 횟수에서 파생되고(`systems/jobLevels.ts`), 오를수록 월 필수 회차가 준다.
 */
export interface LecturerJob {
  /** 채용된 날(day) */
  hiredDay: number;
  /** 이번 달 진행한 수업 횟수. 정산(15일) 시 0으로 리셋 */
  lessonsThisMonth: number;
  /** 누적 수업 횟수 — 레벨 근거라 리셋하지 않는다 */
  totalLessons: number;
  /** 마지막으로 월급을 준 '달 키'(monthKey). -1이면 없음 */
  lastSalaryMonth: number;
}

/**
 * 택시 기사직.
 *
 * 다른 직업과 갈리는 축: **고정급이 없다.** 운행할 때마다 요금이 그 자리에서 들어온다
 * (회사 10일·강사 15일·AV 26일·작가 1일은 전부 월급제). 안 뛰면 수입이 0이다.
 */
export interface TaxiJob {
  /** 입사한 날(day) */
  hiredDay: number;
  /** 누적 운행 횟수 — 경력이자 표시용 */
  totalRides: number;
  /** 누적 운행 요금(원). 도감·통계 표시용 */
  totalEarned: number;
  /**
   * 승객 평점(0~100). 운행 중 승객 응대 선택으로 오르내리고 **요금 단가에 곱해진다**.
   * 초기값은 중립(TAXI_RATING_START).
   */
  rating: number;
}

/** 배구부 대회 성적(좋은 순) */
export type MeetResult = "champion" | "runnerup" | "semifinal" | "eliminated";

/**
 * 고등학교 배구부 코치직. 운동을 꾸준히 하면 카톡으로 섭외가 들어온다.
 *
 * - 근무는 **평일 낮 강제 출근**(회사원과 같은 취급 — `isCoachWorkNow`).
 * - 월급은 **고정급**이다. 다만 4·6·8·10월 대회 성적이 좋으면 인상분이 영구히 붙는다.
 * - 10월 전국체전 우승분은 **다음 해부터** 반영된다(`pendingRaise`/`pendingRaiseYear`).
 */
export interface CoachJob {
  /** 부임한 날(day) */
  hiredDay: number;
  /** 누적 훈련 지도 횟수 — 직업 레벨 근거라 리셋하지 않는다 */
  totalTrainings: number;
  /**
   * 팀 완성도 게이지(0~`COACH_STAT_TARGET`). **대회 성적을 가르는 값이자 화면에 보이는 스테이터스**다.
   * 훈련 지도 1회마다 판정(실패/성공/대성공)에 따라 다른 폭으로 오르고, **대회를 치르면 0으로 리셋**된다.
   * ⚠️ 코치 스킬은 이 값을 직접 올리지 않는다 — 훈련 1회의 상승폭에만 반영된다(작가 작업량과 같은 구조).
   */
  teamStat: number;
  /** 대회 성적으로 확정된 월급 인상 누계(원) */
  raise: number;
  /** 전국체전 우승으로 예약된 인상분(원). `pendingRaiseYear`가 되면 raise에 합류한다 */
  pendingRaise: number;
  /** pendingRaise가 반영되는 연도(그 해 첫 월급날에 합류). 없으면 -1 */
  pendingRaiseYear: number;
  /** 마지막으로 대회를 치른 달 키(monthKey) — 한 달에 두 번 열리지 않게 한다. -1이면 없음 */
  lastMeetMonth: number;
  /** 전국체전 우승 횟수 */
  championships: number;
  /** 마지막으로 월급을 준 '달 키'(monthKey). -1이면 없음 */
  lastSalaryMonth: number;
}

/** 킬러의 현재 주간 임무(없으면 null) */
export interface KillerAssignment {
  /** 타겟 id(data/killerTargets.ts) */
  targetId: string;
  /** 배정된 일요일 day */
  assignedDay: number;
  /** 이 day(다음 일요일)에 미완이면 실패로 판정된다 */
  deadlineDay: number;
  /**
   * 타겟이 결정되는 순간(배정 시) 만들어져 저장되는 타겟 트윗들(30개).
   * SNS 피드·검색·프로필이 이 스냅샷을 그대로 쓴다 — 매번 즉석 생성하지 않는다.
   */
  tweets: Tweet[];
}

/**
 * 킬러 직업(momo.com 서적요청 → DM 수락으로 시작). 기존 직업과 독립 트랙.
 * 매주 일요일 타겟 배정, 토요일까지 [작업하기]로 위치 입력해 처리. 실패 3회 누적 시 게임오버.
 * 한 번 active면 자발적 사퇴 없음.
 */
export interface KillerJob {
  active: boolean;
  /** 실패 누적(KILLER_MAX_FAILS 도달 시 본인이 처리됨) */
  fails: number;
  /** 완료(성공) 누적 */
  completed: number;
  /** 현재 임무. 배정 전/완료 후엔 null */
  assignment: KillerAssignment | null;
  /**
   * 나를 이 바닥에 끌어들인 연락책. 이후 타겟 배정·실패 통보 DM이 **전부 이쪽으로** 온다.
   * - `"momo"`: momo.com 서적요청(성인모드 전용 진입로). 반말·직설.
   * - `"doctor"`: 병원 진료예약(전연령 진입로). 존댓말·수술 은유로만 말한다.
   * 선택 필드인 건 구세이브 호환 때문이다 — 값이 없으면 momo로 취급한다.
   */
  recruiter?: "momo" | "doctor";
}

/** 대부업체에서 빌린 빚 */
export interface Loan {
  principal: number;
  /** 갚아야 할 금액 */
  repayAmount: number;
  /** 상환 마감일(day) */
  dueDay: number;
}

/**
 * 플레이어가 운영하는 SNS 계정.
 * 여러 개를 만들어 전환할 수 있으며, 각자 팔로워/타임라인/DM/해금속성을 따로 갖는다.
 * (행동력·정신력·스탯·소지금·시간은 '사람' 단위라 GameState 루트에 있다.)
 */
export interface PlayerAccount {
  id: string;
  name: string;
  handle: string;
  /** 이 계정의 주 성향 — 팔로우/게시글 성과의 기준 */
  attribute: AttributeId;
  followers: number;
  following: number;
  /** 이 계정의 타임라인 (최신이 앞). 성능·저장 보호를 위해 TIMELINE_MAX개로 잘린다 — 총 게시물 수는 postCount로 센다. */
  timeline: Tweet[];
  /** 지금까지 올린 게시물 총수(누적). 타임라인은 잘리므로 '게시물 수' 표시는 이 값을 쓴다. */
  postCount: number;
  /** 이 계정에서 트윗 작성이 해금된 속성 목록 */
  unlockedAttributes: AttributeId[];
  /** 그룹섹스 추구 트윗 종류가 해금됐는지(그룹 이벤트 후) */
  groupUnlocked: boolean;
  /**
   * 해금된 성인 트윗 종류 목록(sekt는 기본 포함).
   * meetup/punish/dom은 야밤 성인용품 리뷰로 해금되어 여기에 추가된다.
   * group은 별도로 groupUnlocked로 판정하므로 이 배열엔 넣지 않는다.
   */
  unlockedAdultKinds: AdultKind[];
  /** 마지막으로 트윗을 올린 날(day). 오래 안 올리면 팔로워가 준다. */
  lastTweetDay: number;
  /** 이 계정으로 주고받은 DM 스레드 */
  dms: DMThread[];
  /** 내가 팔로우한 계정들(팔로잉 피드 생성에 사용) */
  followingAccounts: Account[];
  /** 사기·논란 누적 경고(밴 위험) */
  strikes: number;
  /** 계정 정지 해제일(day). 이 날 전까지는 활동 정지. 0이면 정상 */
  suspendedUntilDay: number;
  /**
   * 관계 시스템 진행 상태(캐릭터 id → 진행). 계정별로 따로 추적한다.
   * 구세이브엔 없으므로 save.sanitize가 `{}`로 채운다.
   */
  relationships: Record<string, RelationshipProgress>;
  /** 도배 판정 기준 날짜(일차) — 계정별 1일 트윗 카운트. */
  dailyTweetDay: number;
  /** 오늘 이 계정으로 올린 트윗 수(도배 판정). 계정마다 따로 센다. */
  dailyTweetCount: number;
  // 게시 슬롯(일일 트윗 예산)은 계정별이 아니라 전 계정 공유다 → GameState.postSlotsDay/Used로 이관.
  /**
   * 트친(단짝) 핸들 목록. 같은 계정과 상호작용(좋아요/RT/인용/DM)을 임계치만큼 쌓으면 성사된다.
   * 트친 수만큼 모든 트윗 팔로워 증가분에 도달 배율이 붙는다. 계정별로 따로 관리.
   * 구세이브엔 없으므로 save.sanitize가 `[]`로 채운다.
   */
  tchins: string[];
  /** 트친 핸들 → 계정명. 카톡·일정 등 표시용(트친은 핸들만 저장하므로 이름을 따로 기억한다). 구세이브엔 없어 `{}`. */
  tchinNames: Record<string, string>;
  /** 트친 성사용 상호작용 카운터(핸들 → 누적 횟수). 구세이브엔 없어 sanitize가 `{}`로 채운다. */
  tchinProgress: Record<string, number>;
  /** 마지막으로 트친소(트친 소개) 트윗을 올린 날(day). 0이면 미사용. 주 1회 쿨다운 판정. */
  lastTchinsoDay: number;
}

/**
 * 관계 시스템 진행 상태(캐릭터별, PlayerAccount 단위).
 * - affinity: 호감도(트윗 매칭 +8 / 만남 성사 +20). 임계 30/60/90에서 arc가 열린다.
 * - stage: 완주한 arc 수(0~3). advanceRelStage가 arc 완주 시 올린다.
 * - bond: Arc2 선택으로 확정되는 관계(서사만 분기, 보상 동일).
 */
export interface RelationshipProgress {
  affinity: number;
  stage: 0 | 1 | 2 | 3;
  bond: "none" | "friend" | "lover";
  /** 만남 약속을 한 번이라도 성사한 적 있는지(카톡 '친구' 목록 노출 기준). 구세이브엔 없음. */
  met?: boolean;
}

/** 투자 시장 상태(자산별 현재가·전일가·보유량) */
export interface MarketState {
  prices: Record<string, number>;
  prevPrices: Record<string, number>;
  holdings: Record<string, number>;
  /**
   * 종목별 **보유분의 매수 원가 합계**(원). 평단가 = cost / holdings, 평가손익 = 평가액 - cost.
   * 이동평균법 — 매도하면 보유 비율만큼 원가도 함께 덜어낸다(systems/market.ts).
   * 구세이브엔 없다 → 로드 시 '현재가 × 보유량'으로 채운다(손익 0에서 다시 시작).
   */
  cost: Record<string, number>;
}

/** 플랫폼 작가 계약(창작 트윗이 쌓이면 제안이 온다) */
export interface AuthorContract {
  /** 계약한 날(day) */
  signedDay: number;
  /** 정산 완료한 개월 수 — 월급이 이에 비례한다 */
  monthsWorked: number;
  /** 이번 달 작업량 게이지(0~목표치). 매달 1일에 리셋된다 */
  workload: number;
  /**
   * 이번 달 '작업' 횟수 — **월급이 이 횟수에 비례한다**(게이지가 아니라 횟수다).
   * 게이지(workload)는 계약 유지 판정에만 쓰이고, 지급액은 이 값이 정한다. 월 정산 시 0으로 리셋.
   */
  worksThisMonth: number;
  /** 작업량 미달 누적 횟수(목표 도달 시 계약 해지) */
  missCount: number;
  /** 마지막으로 월 정산한 달(monthKey) — 중복 정산 방지 */
  lastSettledMonth: number;
  /** 성인물 작가 계약 여부. true면 작업량 게이지 성과 스탯에 음란도가 포함된다. */
  adult: boolean;
  /**
   * 데뷔 시 정한 작가 필명. **SNS 검색어와 대조되는 값**이라 계약마다 반드시 있다.
   * 이 이름으로 트윗을 검색하면 내 웹툰 독자 반응이 뜬다(systems/author.ts webtoonBuzzTweets).
   * 구세이브엔 없어서 로드 시 계정명으로 채운다(systems/save.ts).
   */
  penName: string;
}

/** 취업 지원 — 결과는 지원 익일에 피메일로 통보된다. */
export interface JobApplication {
  company: string;
  tier: CompanyTier;
  role: string;
  /** 지원 시 확정된 합격 여부(익일 메일로 공개) */
  hired: boolean;
  /** 결과 메일이 도착하는 날(day) */
  resultDay: number;
}

/** 자격증 시험 응시 — 결과는 3일 뒤 피메일로 통보된다. */
export interface ExamApplication {
  /** 응시한 자격증 id (CERTIFICATIONS 참조) */
  certId: string;
  /** 신청 시 확정된 합격 여부(3일 뒤 메일로 공개) */
  passed: boolean;
  /** 결과 메일이 도착하는 날(day) */
  resultDay: number;
}

/**
 * 광고 메일에 딸려오는 특가 오퍼.
 * 스팸(피싱)과 달리 진짜 혜택이며, 도착 당일까지만 유효하다.
 */
export interface AdOffer {
  /** 대상 ShopItem id (SHOP_ITEMS 또는 COSMETICS) */
  itemId: string;
  /** 할인율(0~1). 0.5 = 50% */
  rate: number;
  /** 이 날(포함)까지 유효. 도착 당일 한정이므로 = 메일의 day */
  expiresDay: number;
  /** 이미 이 오퍼로 구매했는지 */
  used?: boolean;
}

/** 피메일 수신함의 메일 한 통 */
export interface Email {
  id: string;
  from: string;
  subject: string;
  body: string;
  day: number;
  read: boolean;
  /** 합격 메일이면 채용 오퍼(출근/거절 버튼). 응답하면 사라진다. */
  jobOffer?: { company: string; tier: CompanyTier; role: string };
  /**
   * 채용 결과 메일(합격/불합격 둘 다)이면 그 결과 표식. ui가 '결과 트윗하기' 버튼을 렌더한다.
   * tweeted면 트윗 완료(메일당 1회 제한 — 불합격 farming 방지).
   */
  jobResult?: { company: string; hired: boolean; tweeted?: boolean };
  /**
   * 대회 결과 메일(입상/탈락)이면 그 표식. ui가 '결과 트윗하기' 버튼을 렌더한다(메일당 1회).
   */
  contestResult?: { name: string; won: boolean; tweeted?: boolean };
  /**
   * 이비에듀 강사 합격 메일이면 true — ui가 '출근한다/안 한다' 버튼을 렌더한다. 응답하면 사라진다.
   * ⚠️ jobOffer를 재사용하지 않는 건 의도다 — 그쪽 수락은 `employment`(회사 재직)을 만들지만
   *    강사는 `lecturerJob`으로 간다. 같은 필드에 태우면 수락 경로가 엉킨다.
   */
  lecturerOffer?: boolean;
  /** 스팸(피싱) 메일인지 — 클릭(열람) 시 낮은 확률로 계정 해킹 */
  spam?: boolean;
  /**
   * 광고 메일이면 50% 특가 오퍼(본문에 구매 버튼).
   * spam과 절대 동시에 세팅하지 않는다(스팸 열람 해킹 로직과 충돌).
   */
  adOffer?: AdOffer;
  /**
   * 서던피스 경매 안내 메일이면 true — 본문에 경매장 링크가 붙는다.
   * ⚠️ jobOffer/adOffer/spam과 절대 동시에 세팅하지 않는다(각각 채용 버튼·구매 버튼·해킹 판정과 충돌).
   * 열람 기간(auctionOpen)이 지난 뒤 링크를 누르면 '종료됨' 안내가 뜬다.
   */
  auctionLink?: true;
  /**
   * 에스테틱 정기권 광고 메일인지(꾸미기 활동 직후 확률로 도착).
   * ui가 '정기권 신청' 버튼을 렌더하고 applyEsthetic으로 평판 분기 처리한다.
   * jobOffer/adOffer/spam/auctionLink와 동시에 세팅하지 않는다(각각 다른 버튼과 충돌).
   */
  esthetic?: boolean;
}

/** 진홍안(crimson_eye) DM 분기 처리 상태 */
export type EyeDealState =
  | "none" // 아직 DM이 오지 않음(또는 진홍안 미구매)
  | "offered" // 금발의 신사가 제안했고 답을 기다리는 중
  | "given" // 넘겨줌 — 사례를 받았다
  | "refused" // 거절함 — EYE_STEAL_DELAY일 뒤 도난된다
  | "stolen"; // 도난당함(보상 없음)

/** 낡은 게임기(old_console) 리뷰 트윗 선택 상태 */
export type ConsoleReviewState =
  | "none" // 아직 9월 10일이 오지 않음(또는 게임기 미보유)
  | "pending" // 선택창을 띄워야 함(ui가 감지해 모달을 연다)
  | "posted" // 리뷰 트윗을 올림
  | "declined"; // 올리지 않기로 함

/** 서던피스 경매 진행 상태 */
export interface AuctionState {
  /** 안내 메일을 보낸 날(중복 발송 방지). 미발송이면 null */
  mailedDay: number | null;
  /** 구매한 물품 id 목록 */
  bought: string[];
  /** 진홍안 DM 분기 처리 상태 */
  eyeDeal: EyeDealState;
  /** 진홍안을 산 날 — 다음날 금발의 신사 DM이 온다. 미구매면 null */
  eyeBoughtDay: number | null;
  /** 진홍안 제안을 거절한 날 — EYE_STEAL_DELAY일 뒤 도난. 미거절이면 null */
  eyeRefusedDay: number | null;
  /** 낡은 게임기 리뷰 트윗(9월 10일) 선택 상태 */
  consoleReview: ConsoleReviewState;
}

/** 터커 연구실 조수 제안의 분기 상태 */
export type LabOfferState =
  | "none" // 아직 DM이 오지 않음
  | "offered" // DM이 왔고 답을 기다림(ui가 수락/거절 버튼을 렌더)
  | "accepted" // 수락 — 평일 저녁 강제 출근이 시작된다
  | "refused"; // 거절 — 라인 종료(재제안 없음)

/** 터커 연구실 퀘스트 진행 상태 */
export interface LabState {
  /** 조수 제안 분기 상태 */
  offer: LabOfferState;
  /**
   * 터커 DM이 도착할 날(일차). 국가연금술사 **합격 시점에 한 번만** 추첨해 확정 저장한다.
   * ⚠️ 매 프레임 재추첨하면 DM이 영원히 안 오거나 매일 온다 — 반드시 저장된 값을 쓴다.
   * 아직 합격하지 않았으면 null.
   */
  tuckerDmDay: number | null;
  /** 지금까지 출근한 횟수(0~LAB_TOTAL_SHIFTS) */
  shifts: number;
  /** 라인이 끝났는지(5회째 출근 → 터커 체포). true면 더 이상 강제 출근하지 않는다 */
  done: boolean;
}

/**
 * 게임당 1회로 제한되는 치트의 사용 여부.
 * true가 되면 다시 시도해도 `systems/cheat.ts`가 false를 반환한다(새 게임에서만 리셋).
 */
export interface CheatState {
  /** 명령 프롬프트 소지금 치트를 이미 썼는지 */
  money: boolean;
  /** 작업관리자 Cheat.exe를 이미 실행했는지 */
  cheatExe: boolean;
}

export interface PendingNews {
  tweetId: string;
  /** 원 트윗 본문 스냅샷(원 트윗이 타임라인 컷으로 사라져도 헤드라인 생성 가능) */
  tweetText: string;
  /** 떡상 증가분(2차 유입·손실 계산 기준) */
  gain: number;
  /** 왜곡 보도 여부(예약 시점 확정) */
  distorted: boolean;
}

/** 진행 중인 재능마켓 외주 1건(GIG_JOBS의 id로 원본 스펙과 join) */
export interface ActiveGig {
  id: string;
  progress: number;
  dueDay: number;
}

export interface GameState {
  version: number;

  /** 보유 계정 목록 */
  accounts: PlayerAccount[];
  /** 현재 활성 계정 id */
  activeAccountId: string;

  /** 성인물 해제(유저 전역 설정 — 계정별이 아니다) */
  adultMode: boolean;
  /** 성인물 보기 하위 설정: 강압/범죄(비합의) 성인 상황을 숨긴다. adultMode가 켜졌을 때만 의미. */
  adultNoCoercion: boolean;

  money: number;

  /** 게임 내 시간 */
  day: number; // 1일차부터
  slot: number; // 하루 안의 행동 슬롯(아침/점심/저녁/밤 등)

  /** 리소스 스탯('사람' 단위 공유) */
  resources: Record<ResourceStatId, number>;
  /** 세부 성장 스탯('사람' 단위 공유) */
  skills: Record<SkillStatId, number>;

  /**
   * 체력('사람' 단위). 리소스 4종과 달리 **상한이 가변**이라(운동으로 staminaMax↑)
   * resources 유니온이 아닌 top-level에 둔다(StatId exhaustive 스위치 파급 회피).
   * 낮으면 질병 위험. 폭염/한파로도 깎인다. 클램프는 stats.ts의 clampStamina(state, v).
   */
  stamina: number;
  /** 체력 한계치(현재 상한). 운동으로 오르며 STAMINA_MAX_CAP(999)이 하드 실링. ⚠️구세이브 폴백 반드시 200(0이면 clampStamina가 체력을 영구히 0으로 누름). */
  staminaMax: number;

  /**
   * 행동력 상한에 더해지는 보너스(기본 0). 행동력 상한 = MAX_RESOURCE + actionMaxBonus.
   *
   * ⚠️ 행동력은 리소스 4종 중 **유일하게 상한이 게임 중 변하는** 스탯이다(작업관리자 Cheat.exe).
   *    따라서 `state.resources.action`을 쓰는 모든 클램프는 `clampResource`(전역 100)가 아니라
   *    상태를 아는 `systems/stats.ts`의 `clampAction(state, v)`를 써야 한다.
   *    정신력·도덕성·평판은 상한이 고정 100이므로 계속 `clampResource`다 — 섞지 말 것.
   * 새 게임에선 0으로 리셋된다(치트는 '게임당 1회').
   */
  actionMaxBonus: number;

  /** 게임당 1회만 쓸 수 있는 치트의 사용 여부 */
  cheats: CheatState;

  /** 달력 스케줄 */
  schedule: ScheduleEvent[];

  /** 진행 중인 재능마켓 외주(수주 후 데드라인 안에 작업량을 채워야 하는 건들) */
  activeGigs: ActiveGig[];

  /**
   * 아르바이트 **종류별** 누적 횟수(할수록 그 알바의 일당 상승).
   * 키는 `OfflineActivity.partTime`에 선언된 알바 id(= 해당 활동의 `id`).
   *
   * ⚠️ 구세이브엔 `partTimeCount: number`(전 알바 합산 하나)였다 — 마이그레이션은 `systems/save.ts`.
   * ⚠️ 부분 Record다(`Partial`) — 아직 안 해본 알바는 키 자체가 없다. 읽을 땐 반드시
   *    `partTimeCountOf(state, id)` 셀렉터를 써라(`?? 0` 직접 쓰기 금지 — 셀렉터가 NaN 방어를 겸한다).
   */
  partTimeCounts: Partial<Record<string, number>>;

  /** 카카오톡 수신함(발신자별 대화) */
  kakao: KakaoThread[];
  /** 업무 메신저("너아무튼온") 업무 요청함(재직 중에만 도착) */
  workMsgs: WorkMsg[];
  /** 마지막으로 월세 리마인더 카톡을 보낸 '월세 납부일'(중복 방지). -1이면 아직 없음 */
  lastRentReminderDay: number;

  /** 러닝크루 가입 여부('사람' 단위 — 계정 무관) */
  crewJoined: boolean;
  /** 러닝크루 정기런 참석 누적 횟수(마일스톤 특별 이벤트 트리거). */
  crewRunCount: number;
  /** 그룹방 정기 모임 참석 누적 횟수(마일스톤 특별 이벤트 트리거). */
  groupNightCount: number;
  /** 불합격 결과 트윗 누적 수(취업스터디 권유 게이트용, '사람' 단위) */
  rejectionTweets: number;
  /** 취업스터디 모임 가입 여부('사람' 단위) — 가입 후 매주 월요일 낮 정기 모임이 유지된다 */
  studyJoined: boolean;
  /** 에스테틱 정기권 정품 회원 여부('사람' 단위, 평판≥50 가입 시) — 매주 방문·꾸미기 매력 1.5배 */
  estheticMember: boolean;
  /**
   * 에스테틱 사기 폐업 이벤트 발생 예정일(day). 평판<50으로 정기권을 결제하면 day+7로 설정되고,
   * 그 날 onNewDay가 폐업(돈 날림)을 폭로한 뒤 0으로 되돌린다. 0이면 진행 중 사기 없음.
   */
  estheticScamDay: number;
  /** 비공개 엘리트 러닝크루(SM 규율) 가입 여부 — 가입 후 정기런에 규율 시나리오가 랜덤 표출된다 */
  privateCrewJoined: boolean;
  /**
   * 성인 그룹방 가입 여부('사람' 단위).
   * true면 매주 토요일 심야 정기 모임 약속이 유지된다.
   */
  groupRoomJoined: boolean;
  /** 사바나 여캠(라이브방송) 계약 여부 — 매 심야에 방송 행동이 열린다 */
  savannaJoined: boolean;
  /** 란제리 모델 전속 계약 여부('사람' 단위) — 계약 후 매주 심야 정기 화보 촬영이 유지된다 */
  lingerieContract: boolean;
  /** 란제리 전속 계약 제의 DM을 이미 보냈는지(중복 제의 방지). 초기 false */
  lingerieOffered: boolean;
  /** 애니덕(anime) 트윗 누적 작성 수 — 코스프레 촬영 제의 트리거용(성인 무관) */
  animeTweetsPosted: number;
  /**
   * 갈래별 게시 누적(숙련도). 안 올린 갈래는 키가 없다.
   * 문턱·배율은 data/tweetMastery.ts가, state→배율 변환은 systems/followers.ts가 소유한다.
   */
  tweetMastery: Partial<Record<AttributeId, number>>;
  /** 마지막 코스프레 촬영 제의가 온 날(day). 0=아직 없음. 제의 간 최소 쿨다운 판정용. */
  lastCosplayDay: number;
  /** 유료 구독 채널 개설 여부 — 매월 구독 수익이 정산된다 */
  paidChannelJoined: boolean;
  /**
   * 트위터 프리미엄 구독 여부 — 팔로워 수익이 2배가 되고 매월 1일 구독료가 빠진다.
   * 구독료를 못 내면 그 자리에서 false로 돌아간다(systems/economy.settleMonthlyIncome).
   */
  premium: boolean;

  /** 앞으로 예정된 약속들(정기런·친구 만남). 당일이 되면 할지/말지 팝업이 뜬다. */
  appointments: Appointment[];

  /** 오늘 심야 트윗을 썼는지(다음날 수면 회복이 줄어듦) */
  lateTweetToday: boolean;

  /**
   * 연속 트윗 콤보 — 같은 갈래를 연달아 올린 횟수(다른 갈래를 올리면 1로 리셋).
   * 직전 트윗만 보므로 날짜·계정 전환과 무관하다. null=아직 한 건도 안 올림.
   */
  tweetStreak: { attr: AttributeId; count: number } | null;

  /** 마지막으로 부장님 아재개그로 개그(comedy)를 얻은 날(일차). -1이면 없음. 하루 1회 캡. */
  bossJokeDay: number;

  /** 마지막으로 EBS '오늘의 무료 강의'를 수강한 날(일차). -1이면 없음. 하루 1편 무료 캡. */
  ebsFreeWatchedDay: number;

  /** 마지막으로 '오늘 회사 얘기' 트윗을 올린 날(일차). -1이면 없음. 하루 1회 캡. */
  lastWorkTweetDay: number;

  /** 새 날 아침 딤팝업 대기 플래그. onNewDay에서 true, 팝업 닫을 때 false */
  dawnPending: boolean;

  /**
   * 질병 강제 팝업 대기 플래그(dawnPending 패턴). 체력이 바닥일 때 onNewDay의 rollDisease가
   * 확률적으로 true로 세팅한다. app.ts가 감지해 renderSickModal을 강제로 띄우고(닫기 없음),
   * resolveSickDay가 하루를 앓아 넘기며 false로 되돌린다. 아픈 날은 아무 활동도 못 한다.
   */
  sickPending: boolean;

  /**
   * 오늘 야근을 했는지. 회사 야근 판정(employment.rollOvertime)과
   * 너아무튼온 업무 요청 수락(workMessenger.acceptWorkMsg) **둘 다** 이 플래그를 세운다.
   * ⚠️ 하루에 둘 다 해도 야근 1일이다(횟수가 아니라 연속일수를 센다).
   * onNewDay의 settleOvertimeStrain이 정산하며 false로 되돌린다.
   */
  overtimeToday: boolean;
  /** 야근 연속일수. 야근 없는 하루가 지나면 0으로 끊긴다 */
  overtimeStreak: number;
  /**
   * 굶은 연속일수. 생활비를 못 낸 날 오르고, 낸 날 0으로 리셋된다.
   * ⚠️ 굶주림은 체력을 HUNGER_STAMINA_FLOOR(1) 아래로 깎지 않는다 — 단독 게임오버는 없다.
   */
  hungerStreak: number;

  /**
   * 자고 일어날 때 실제 회복된 행동력/정신력(클램프 후 델타, 상한이면 0).
   * onNewDay가 매일 갱신하고, dawnModal이 "행동력 +N · 정신력 +N 회복" 표시에 읽는다.
   */
  lastRestGain: { action: number; mental: number };

  /**
   * 취침 선택 팝업 대기 플래그. advanceTime이 저녁→심야(LATE_SLOT) 전환 시 true,
   * sleepModal의 모든 선택지가 false로 클리어한다. 무엇이 시간을 진행시켰든(트윗은 이제
   * 시간을 안 쓰므로 오프라인 활동·근무 등) 심야 진입이면 뜬다.
   */
  sleepPending: boolean;

  /** 고양이가 전원 버튼을 눌렀음(UI가 감지해 2초 블랙아웃 후 팝업을 띄우고, 닫을 때 false로 되돌린다). */
  catPowerPending: boolean;

  /**
   * 마지막으로 본 하루 최대 게시 슬롯 상한(maxPostSlots). 팔로워 티어를 넘으면 changeFollowers가 갱신한다.
   * 전역 필드(계정별 아님) — **전 계정 팔로워 합계** 기준으로 동기화한다.
   */
  lastMaxPostSlots: number;
  /** 게시 슬롯 소비 기준 날짜(일차) — 전 계정 공유(하루 지나면 리셋). */
  postSlotsDay: number;
  /** 오늘 소비한 게시 슬롯 수 — **전 계정 통합** 일일 트윗 예산. */
  postSlotsUsed: number;
  /**
   * 방금 게시 슬롯 상한이 늘었으면 그 새 값(pending 알림). 없으면 null.
   * changeFollowers가 증가 감지 시 세팅, ui(app.ts)가 안내 모달을 띄운 뒤 null로 클리어한다.
   */
  postSlotIncreasedTo: number | null;

  /**
   * 방금 트친이 된 핸들들(성사 토스트 대기열). systems/tchin이 성사 시 쌓고,
   * ui(app.ts)가 토스트로 알린 뒤 비운다(pendingAchievements와 동일 패턴).
   */
  pendingTchinToasts: string[];

  /**
   * 오하아사(아침 운세) 좋아요/RT로 누적된 로또 당첨 운(0~LOTTERY_LUCK_CAP).
   * lottery()가 꽝 경계를 낮추는 데 쓰고, 추첨 직후 0으로 리셋한다. 다른 데서 건드리지 말 것.
   */
  lotteryLuck: number;
  /** 괴담 계정 좋아요 → 그날 심야 방문 예약. onLateNight의 maybeHauntVisit이 소비한다. */
  hauntPending: boolean;
  /**
   * 괴담 방문이 '지금(심야)' 발동됐음. onLateNight에서 hauntPending이면 true.
   * ui(app.ts)가 감지해 괴담 모달을 띄우고, resolveHauntVisit이 false로 되돌린다(sleepPending과 공존).
   */
  hauntVisitNow: boolean;

  /** 재직 정보(없으면 무직) */
  employment: Employment | null;
  /** AV배우 계약(없으면 미계약). 성인 트윗 누적 시 DM 제의 수락으로 생성 */
  avJob: AvJob | null;
  /** AV배우 제의 DM을 이미 한 번 보냈는지(중복 제의 방지). 초기 false */
  avOffered: boolean;
  /** 이비에듀 강사직(없으면 미채용). 이비에듀 '강사 신청'으로 생성. 초기 null */
  lecturerJob: LecturerJob | null;
  /** 배구부 코치직(없으면 미부임). 운동 중 카톡 섭외 수락으로 생성. 초기 null */
  coachJob: CoachJob | null;
  /** 배구부 섭외 카톡을 이미 보냈는지(중복 제의 방지). 초기 false */
  coachOffered: boolean;
  /** 택시 기사직(없으면 미취업). 1종 보통 면허 보유 시 택시회사 지원으로 생성. 초기 null */
  taxiJob: TaxiJob | null;
  /**
   * 한 번이라도 해본 직업 id 목록(직업 도감 해금 근거). 초기 [].
   * ⚠️ 그만둬도 지우지 않는다 — 회사·AV·강사는 사직 시 상태가 통째로 사라지므로
   *    이 목록이 없으면 도감이 다시 잠긴다. 기록은 `systems/jobExperience.ts`가 한다.
   */
  jobsExperienced: string[];
  /** 킬러 직업(없으면 미취직). momo.com 서적요청 → DM 수락으로 생성. 초기 null */
  killerJob: KillerJob | null;
  /** momo 서적요청 제의 DM을 보낸 마지막 day(중복 제의 방지). 초기 -1 */
  momoOfferedDay: number;
  /** 칠남(동종업계 킬러)과 품앗이 동맹인지. 켜지면 작업하기에서 칠남이 정답 트윗을 짚어준다. 초기 false */
  chilnamAlly: boolean;
  /** 칠남에게 이미 품앗이 제의 DM을 보냈는지(중복 방지). 초기 false */
  chilnamOffered: boolean;
  /** 예언 계정 트윗에 좋아요를 눌러, 다음 날 예언이 실현되기로 예약됐는지. 초기 false */
  pendingProphecy: boolean;
  /** 실현된 예언 결과 문구(있으면 app이 토스트 후 비운다). 초기 null */
  pendingProphecyText: string | null;
  /** 니글니글 이번 '달' 출근 일수(월급날 NIGL_SHIFT_GOAL 미달이면 월급 반감 후 0으로 리셋). 초기 0 */
  niglShifts: number;
  /** 결과 대기 중인 취업 지원(익일 메일 통보). 없으면 null */
  pendingJobApp: JobApplication | null;
  /**
   * 결과 대기 중인 이비에듀 강사 지원(익일 메일 통보). 없으면 null.
   * ⚠️ `hired`는 **지원 시점에 확정**된다(pendingJobApp과 같은 규칙) — 결과 통보는 다시 판정하지 않는다.
   */
  pendingLecturerApp: { hired: boolean; resultDay: number } | null;
  /** 결과 대기 중인 네이놈 대회 신청(1주 뒤 메일 통보, 동시 1건). 없으면 null */
  pendingContest: { id: string; appliedDay: number } | null;
  /** 취득한 자격증 id 목록 */
  certifications: string[];
  /** 결과 대기 중인 **일반** 자격증 시험(동시 1건만). 없으면 null */
  pendingExam: ExamApplication | null;
  /**
   * 결과 대기 중인 **특별 시행**(Certification.onlyOn) 자격증 시험(동시 1건만). 없으면 null.
   *
   * 일반 시험과 슬롯을 나눈 이유: 특별 시행은 1년에 단 하루만 열린다(헌터 = 매년 1월 7일).
   * 단일 슬롯이면 1월 4~6일에 아무 자격증이나 신청해 둔 플레이어가 1월 7일 헌터 시험을
   * 놓치고 365일을 기다리게 된다 — 연 1회 기회에 비해 대가가 지나치다.
   * 슬롯을 나눠 '특별 1건 + 일반 1건' 동시 대기를 허용하되, 같은 시험의 중복 신청은 계속 막는다.
   */
  pendingSpecialExam: ExamApplication | null;
  /**
   * 서던피스 경매 진행 상태.
   * 항상 기본 객체로 존재한다(null 아님) — 계약서가 허용한 '기본 객체' 선택지.
   * 전 호출부의 널 가드를 없애 NaN·크래시 경로를 줄인다. 구세이브는 save.sanitize가 채운다.
   */
  auction: AuctionState;
  /**
   * 터커 연구실 퀘스트 진행 상태.
   * auction과 같이 항상 기본 객체로 존재한다(null 아님) — 호출부 널 가드를 없앤다.
   * 구세이브는 save.sanitize가 채운다.
   */
  lab: LabState;
  /** 피메일 수신함 */
  emails: Email[];
  /** 대부업체 빚(없으면 없음) */
  loan: Loan | null;
  /** 대출 제안 카톡을 이미 보냈는지(마이너스 지속 시 중복 방지) */
  loanOffered: boolean;
  /** 사채를 못 갚아 잡혀간 누적 횟수(3이면 엔딩) */
  loanDefaultStreak: number;
  /** 연속 월세 미납 횟수(3이면 퇴거) */
  unpaidRentStreak: number;
  /** 밀린 월세 누적액(원). 미납 시 이번 달 월세가 누적되어 다음 달에 함께 청구된다 */
  overdueRent: number;
  /** 마지막으로 트위터 수익을 정산한 달 키(monthKey). 매월 1일 1회 정산 중복 방지. -1이면 없음 */
  lastIncomeSettleMonth: number;
  /** 마지막으로 채용공고를 연 날(day). 취업 시도는 하루 1회. -1이면 없음 */
  lastJobBoardDay: number;
  /** 퇴사한 이전 직장명 목록(아직 잡플래닛 리뷰를 안 쓴 곳). 리뷰 1건당 무료 열람권 1장. */
  pastEmployers: string[];
  /** 잡플래닛 기업정보 무료 열람권(이전 직장 리뷰 작성으로 획득). */
  jobplanetCredits: number;
  /** 직플래닛에서 이미 정보를 열람한 업체명(영구 저장 — 재열람 무료). */
  jobplanetViewed: string[];

  /** 진행 중인 논란 시나리오 id(있으면 강제 팝업). null이면 없음 */
  pendingControversy: string | null;
  /** 투자 시장 상태 */
  market: MarketState;
  /** 구매한 쇼핑 아이템 id 목록 */
  ownedItems: string[];
  /** 참여한 굿즈 공구 중 배송 대기분(arriveDay 도달 시 ownedItems로 이동) */
  pendingGoods: { itemId: string; arriveDay: number }[];
  /** 도깨비 상점에 마지막으로 들어간 달(monthKey). 없으면 null. 월 1회 접속 제한용 */
  goblinShopMonth: number | null;
  /** '푸시타임' 탭이 해금됐는지(애니덕+성인+음란 DM 링크로 해금) */
  pushtimeUnlocked: boolean;
  /** '야밤'(성인 사이트) 탭이 해금됐는지(성인 트윗 누적 시 DM 링크로 해금) */
  yabamUnlocked: boolean;
  /** '너튜브' 탭이 해금됐는지(추천탭 광고 트윗 '바로가기'로 해금). 새 게임은 false */
  youtubeUnlocked: boolean;
  /** '미디북스' 탭이 해금됐는지(추천탭 광고 트윗 '바로가기'로 해금). 새 게임은 false */
  medibooksUnlocked: boolean;
  /** '증기'(스팀 패러디 게임 스토어) 탭이 해금됐는지(추천탭 광고 트윗 '바로가기'로 해금). 신규 기능이라 구세이브도 false */
  steamUnlocked: boolean;
  /** 증기에서 구매한 게임 id 목록(중복 구매 방지, 리뷰 자격 판정) */
  ownedGames: string[];
  /** 리뷰 트윗을 이미 올린 게임 id 목록(게임당 1회 리뷰) */
  reviewedGames: string[];
  /** 추천탭에 노출되는 광고 트윗 풀(매일 스폰, 상한 유지) */
  adTweets: Tweet[];
  /**
   * '다트 핀'(익명 게시판 사이트) **탭**이 해금됐는지 — 둘러보기 트윗의 링크를 눌러 해금.
   * 신규 기능이라 구세이브도 false(steamUnlocked와 같은 방향).
   * 이 플래그는 두 가지를 뜻한다:
   * ① 미해금일 때만 발견 트윗이 스폰된다(중복 유도 방지)
   * ② 해금 후엔 브라우저에 탭이 상시 남아 재방문할 수 있다 — 게시판이 매일 갱신되고
   *    힌트 글이 드물게(25%) 섞이므로 **재방문이 전제다.** 단발 진입으로 바꾸면 히든 힌트를
   *    영영 못 보고 기능이 죽는다(`systems/dartpin.ts` 헤더 참조).
   */
  dartpinUnlocked: boolean;
  /**
   * 다트 핀 게시판 스냅샷. 하루 단위로 갱신되며, 힌트 글이 드물게 섞인다.
   * 렌더마다 다시 굴리면 글을 열었다 나올 때 목록이 뒤바뀌므로 상태에 고정한다.
   */
  dartpinBoard: { day: number; postIds: string[] } | null;
  /**
   * 네이놈 실시간 검색어(실검) 스냅샷. 하루 단위로 갱신된다(다트핀 board와 같은 스냅샷 방식).
   * `ridden`은 오늘 이미 편승(부스트)한 트렌드 id — 트렌드당 1회/일 부스트 제한용.
   */
  trendBoard: { day: number; ids: string[]; ridden: string[] } | null;
  /**
   * 최근 반응(좋아요·악플·리트윗)한 카테고리 이력 — 신규 게시글 탐색 피드가 이쪽으로 편중된다
   * (에코챔버). 중복을 그대로 쌓아 두고 균등 `pick`으로 뽑으므로, 많이 반응한 카테고리일수록
   * 자주 뜬다(별도 가중치 계산 없음). 최근 `FEED_TASTE_MAX`개만 유지한다.
   */
  feedTaste: AttributeId[];
  /**
   * 비밀번호를 풀어 잠금을 해제한 d스토리 게시글 id 목록(`DSTORY_POSTS` 참조).
   * 본문 공개 여부와 IT 보상 중복 수령 방지를 **둘 다** 이 배열 하나로 판정한다
   * (별도 '보상 받음' 플래그를 두지 마라 — 두 출처가 어긋날 여지만 생긴다).
   */
  dstoryUnlockedPosts: string[];
  /** 심야에 취해 취중 트윗 팝업이 대기 중인지(ui/app이 감지해 블러+취중팝업). */
  drunkPending: boolean;
  /** 어젯밤 취중 트윗의 id — 다음날 아침 '이불킥' 팝업 대상. null이면 없음. */
  pendingRegretTweetId: string | null;
  /**
   * 떡상 트윗이 기사화 예약됐으면 그 스냅샷(다음날 아침 강제팝업). 없으면 null.
   * ui(newsModal)가 처리 후 null로 클리어한다.
   */
  pendingNews: PendingNews | null;
  /** 오늘 생일인 트친 핸들(미축하). onNewDay가 세팅, 축하 or 다음날에 클리어. null이면 없음. */
  pendingBirthday: string | null;
  /**
   * 메모장으로 편집·저장한 hosts 파일 내용. null이면 미편집(기본 HOSTS_LINES를 표시).
   * `127.0.0.1  goedam.kr` 매핑을 넣어 저장하면 주소창에서 goedam.kr로 괴담 사이트에 갈 수 있다
   * (판정은 systems/hosts.hostsHasGoedam). 세이브 대상(편집이 유지돼야 함).
   */
  hostsFile: string | null;
  /** 주소창 ⭐로 담은 북마크 사이트 id 목록(BookmarkableSiteId). 브라우저 북마크바에 표시. */
  bookmarks: string[];
  /** 성인 트윗 누적 작성 수(야밤 DM 트리거용) */
  adultTweetsPosted: number;
  /** 체벌(punish) 트윗 누적 작성 수(비공개 크루 권유 게이트용) */
  punishTweetsPosted: number;
  /** 야밤에서 구매한 성인용품 id 목록(중복 구매 방지) */
  yabamProductsOwned: string[];
  /** 감상한(본) 작품 id 목록 — 너튜브 애니 시청/미디북스 만화 감상. 2차창작 대상이 된다. */
  seenWorks: string[];
  /** 창작(1차/2차창작) 트윗 누적 수 — 20개 이상이면 작가 계약 제안이 뜰 수 있다 */
  creationTweetCount: number;
  /** 플랫폼 작가 계약(없으면 미계약) */
  authorContract: AuthorContract | null;
  /** 현재 주거 단계(0=3평 원룸). 단계가 오를수록 월세↑·일일 회복↑, 아파트 이상은 영구 스탯업 */
  housingTier: number;
  /** 구매한 복권(추첨일 대기). 없으면 null */
  lotto: { drawDay: number } | null;
  /** 파이어족 제안에서 '더 벌어야지'를 골라 계속 플레이하기로 했는지(재제안 방지) */
  fireDeclined: boolean;
  /** 이미 거절한 엔딩 제안 id 목록(데뷔·작가 등, 재제안 방지) */
  endingsDeclined: string[];
  /** 이미 발생한 계절/연말 이벤트 키 목록(크리스마스·새해·연말정산 등, 중복 방지) */
  seasonalFired: string[];
  /** 한 번 본(완료한) 만남 시나리오 id 목록 — 재추첨 시 제외해 반복을 막는다(전부 봤으면 폴백) */
  seenMeetings: string[];
  /** 성인 트윗을 한 번이라도 올린 적 있는지(성기 사진 DM 등 성인 이벤트 해금) */
  postedAdultEver: boolean;
  /**
   * 데려온 반려동물 보유 여부('사람' 단위 — 산책 이벤트로 획득).
   * 해당 동물을 데려와야 그 동물 주접 트윗(강아지계/고양이계)을 올릴 수 있다.
   */
  pets: { dog: boolean; cat: boolean };
  /** 산책 중 조우해 도감에 수집한 크리처 id 목록(data/creatures.ts의 CREATURES 참조) */
  creatures: string[];
  /**
   * 산책 중 발견해 다음 산책부터 갈 수 있는 장소 id 목록(data/walkPlaces.ts 참조).
   * ⚠️ 발견은 '정처 없이 돌아다니기'에서만 일어난다 — 특정 장소를 방문한 산책에선 안 뜬다.
   */
  walkPlaces: string[];
  /** 마켓걸리버에서 완성해 요리 도감에 등록한 레시피 id 목록(data/grocery.ts의 RECIPES 참조) */
  cookedDishes: string[];
  /** 누적 인방(라이브 방송) 횟수. 방송 진행 상태는 모달 지역 변수라 여기 없다 */
  streamCount: number;
  /**
   * 방송 타입별 최고 시청자 기록(data/livestream.ts의 STREAM_TYPES id가 키).
   * raceBests(마라톤)와 같은 패턴 — 기록한 타입만 키가 있다.
   * ⚠️ peak가 아니라 **최종 시청자**로 잡는다(peak는 모달 지역 변수라 systems가 모른다).
   */
  streamBests: Record<string, number>;
  /**
   * 방송 타입별 활동명(게임/수다/버튜버 각각 따로). 키가 없으면 아직 안 정한 것 —
   * 방송을 켜기 전에 반드시 정해야 한다(systems/livestream.ts canStream).
   * ⚠️ SNS 계정명이 이 이름과 같으면 그 계정이 **방송 전용 계정**이 되어
   *    방송 후기 트윗의 팔로워가 크게 붙는다(systems/livestream.ts dedicatedAccount).
   */
  streamNames: Record<string, string>;
  /** 오락실 인형뽑기로 도감에 등록한 인형 id 목록(data/arcade.ts의 DOLLS 참조) */
  dolls: string[];
  /**
   * 도감 1호기를 제외한 여분 재고(중복 뽑기분). 피망마켓 판매 대상.
   * ⚠️ 판매는 이 재고만 차감한다 — dolls(도감)는 절대 비우지 않는다.
   */
  dollStock: Record<string, number>;
  /** 오락실 농구 슛 최고 득점(한 판 30초 기준). 진행 상태는 씬 지역 변수라 여기 없다 */
  hoopBest: number;
  /** 결과 대기 중인 마라톤 대회 신청(대회일에 판정, 동시 1건). 없으면 null */
  pendingRace: { id: string; appliedDay: number } | null;
  /** 코스별 개인 최고 기록(분 단위, 낮을수록 좋다). 완주한 코스만 키가 있다. */
  raceBests: Record<string, number>;
  /**
   * 진행 중인 바디프로필 도전(없으면 미도전).
   * 운동으로 gauge를 100까지 채우면 성공, 정신력이 낮을 때 휴식·외출·산책에서
   * 고칼로리 유혹이 터지면 gauge가 깎이고 binges가 는다. 판정은 startDay + BODY_PROFILE_DAYS.
   */
  bodyProfile: { startDay: number; gauge: number; binges: number } | null;
  /** 이스터에그·특수 이벤트 추적 */
  eggs: EggState;

  /** 하루 1회 제한 등을 추적하는 플래그 */
  daily: {
    adWatchedDay: number; // 마지막으로 광고 본 일차 (-1이면 안 봄)
    bannerClaimedDay: number; // 네이놈 배너로 적립받은 일차 (-1이면 안 받음)
  };

  /**
   * 로그인 화면을 통과했는지. false면 app.ts가 로그인 화면만 렌더한다(모달·강제 팝업 일절 없음).
   * 새 게임은 false로 시작해 계정명·아이디를 입력받는다. "새 게임 시작"도 createInitialState를
   * replace하므로 자동으로 다시 로그인 화면을 탄다.
   * ⚠️ 구세이브(키 부재)는 **true**로 마이그레이션한다 — 진행 중인 세이브를 로그인 화면으로
   *    쫓아내면 기존 계정명이 덮인다. 판정은 save.ts의 loadGame에서 parsed 원본 기준으로 한다.
   */
  loggedIn: boolean;

  /** 게임 종료 사유(퇴거 등). null이면 진행 중 */
  gameOver: string | null;

  /** 달성한 도전과제 id 목록(data/achievements.ts의 ACHIEVEMENTS 참조) */
  achievements: string[];
  /** 달성 알림 대기 중인 도전과제 id 목록 — app이 토스트 후 비운다 */
  pendingAchievements: string[];

  /** 획득한 스탯 마일스톤 id(`skill:tier`) — 영구, 재지급 방지용 claimed 집합 */
  statMilestones: string[];
  /** 마일스톤 달성 알림 대기 id 목록 — app이 토스트 후 비운다(pendingAchievements와 동일 패턴) */
  pendingMilestones: string[];

  /** 일일/주간 도전과제 진행 상태(data/missions.ts + systems/missions.ts) */
  missions: MissionState;
  /** 방금 달성해 보상까지 지급된 도전과제 id 목록 — app이 토스트 후 비운다(pendingAchievements와 동일 패턴) */
  pendingMissions: string[];
}

/** 도전과제 한 건의 진행 상태(정의는 data/missions.ts의 id로 참조) */
export interface MissionInstance {
  id: string;
  progress: number;
  claimed: boolean;
}

/** 일일/주간 미션 세트 — day/week가 바뀌면 systems/missions.ensureMissions가 다시 굴린다 */
export interface MissionState {
  /** daily 세트를 굴린 일차 */
  day: number;
  /** weekly 세트를 굴린 주차(currentWeek) */
  week: number;
  daily: MissionInstance[];
  weekly: MissionInstance[];
}
