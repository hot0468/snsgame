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
  | "adult"; // 성인계

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
  /** dailyTweetCount 기준 날짜(일차) */
  dailyTweetDay: number;
  /** 오늘 올린 트윗 수(도배 판정) */
  dailyTweetCount: number;
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
  | "lewd" // 음란
  | "game"; // 게임

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
  /** 이 트윗에 달린 멘션(답글) — 내 트윗일 때 생성 */
  replies?: TweetReply[];
  /** 행사 안내 트윗이면 그 정보(참여하기 버튼 노출) */
  event?: TweetEvent;
  /** 첨부된 사진/영상(자리만, 클릭 시 설명 팝업) */
  media?: TweetMedia;
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
}

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
  /** 이미 오프라인에서 만났는지(만남은 상대당 1회) */
  metOffline: boolean;
  /** 상대가 오프라인 만남을 제안했는지(제안해야만 만날 수 있음) */
  wantsToMeet: boolean;
  /** 성인 트윗으로 유입된 '모텔 제안' 스레드인지 */
  motel?: boolean;
  /** 모텔 스레드일 때, 어떤 성인 트윗에서 유입됐는지(플레이 종류 결정) */
  motelKind?: AdultKind;
  /** 티켓 양도 제안 스레드인지(콘서트/영화 GV) */
  ticketKind?: "concert" | "gv";
  /** 성기 사진을 보낸 성인 스레드면 그 크기(만남 이벤트 분기에 사용) */
  genitalSize?: DickSize;
  /** 러닝크루 가입 권유 스레드인지(운동 트윗으로 유입) */
  crew?: boolean;
  /** 사바나 여캠(라이브방송) 제의 스레드인지(성인 트윗으로 유입) */
  savanna?: boolean;
  /** 플랫폼 작가 계약 제안 스레드인지(창작 트윗이 쌓이면 유입) */
  authorOffer?: boolean;
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
  /** 팬이 후원을 제안한 스레드면 그 정보 */
  donation?: { amount: number; claimed?: boolean };
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
export type AppointmentKind = "crew" | "friend" | "event" | "ticketing";

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
  /** 이 계정의 타임라인 (최신이 앞) */
  timeline: Tweet[];
  /** 이 계정에서 트윗 작성이 해금된 속성 목록 */
  unlockedAttributes: AttributeId[];
  /** 이 계정의 성인물 해제 토글 */
  adultMode: boolean;
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
}

/** 투자 시장 상태(자산별 현재가·전일가·보유량) */
export interface MarketState {
  prices: Record<string, number>;
  prevPrices: Record<string, number>;
  holdings: Record<string, number>;
}

/** 플랫폼 작가 계약(창작 트윗이 쌓이면 제안이 온다) */
export interface AuthorContract {
  /** 계약한 날(day) */
  signedDay: number;
  /** 정산 완료한 개월 수 — 월급이 이에 비례한다 */
  monthsWorked: number;
  /** 이번 달 작업량 게이지(0~목표치). 매달 1일에 리셋된다 */
  workload: number;
  /** 작업량 미달 누적 횟수(목표 도달 시 계약 해지) */
  missCount: number;
  /** 마지막으로 월 정산한 달(monthKey) — 중복 정산 방지 */
  lastSettledMonth: number;
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

export interface GameState {
  version: number;

  /** 보유 계정 목록 */
  accounts: PlayerAccount[];
  /** 현재 활성 계정 id */
  activeAccountId: string;

  money: number;

  /** 게임 내 시간 */
  day: number; // 1일차부터
  slot: number; // 하루 안의 행동 슬롯(아침/점심/저녁/밤 등)

  /** 리소스 스탯('사람' 단위 공유) */
  resources: Record<ResourceStatId, number>;
  /** 세부 성장 스탯('사람' 단위 공유) */
  skills: Record<SkillStatId, number>;

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

  /** 아르바이트 누적 횟수(할수록 급여 상승) */
  partTimeCount: number;

  /** 카카오톡 수신함(발신자별 대화) */
  kakao: KakaoThread[];
  /** 마지막으로 월세 리마인더 카톡을 보낸 '월세 납부일'(중복 방지). -1이면 아직 없음 */
  lastRentReminderDay: number;

  /** 러닝크루 가입 여부('사람' 단위 — 계정 무관) */
  crewJoined: boolean;
  /** 사바나 여캠(라이브방송) 계약 여부 — 매 심야에 방송 행동이 열린다 */
  savannaJoined: boolean;
  /** 유료 구독 채널 개설 여부 — 매월 구독 수익이 정산된다 */
  paidChannelJoined: boolean;

  /** 앞으로 예정된 약속들(정기런·친구 만남). 당일이 되면 할지/말지 팝업이 뜬다. */
  appointments: Appointment[];

  /** 오늘 심야 트윗을 썼는지(다음날 수면 회복이 줄어듦) */
  lateTweetToday: boolean;

  /** 새 날 아침 딤팝업 대기 플래그. onNewDay에서 true, 팝업 닫을 때 false */
  dawnPending: boolean;

  /** 고양이가 전원 버튼을 눌렀음(UI가 감지해 2초 블랙아웃 후 팝업을 띄우고, 닫을 때 false로 되돌린다). */
  catPowerPending: boolean;

  /** 재직 정보(없으면 무직) */
  employment: Employment | null;
  /** 결과 대기 중인 취업 지원(익일 메일 통보). 없으면 null */
  pendingJobApp: JobApplication | null;
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
  /** 연속 월세 미납 횟수(3이면 퇴거) */
  unpaidRentStreak: number;
  /** 밀린 월세 누적액(원). 미납 시 이번 달 월세가 누적되어 다음 달에 함께 청구된다 */
  overdueRent: number;
  /** 마지막으로 트위터 수익을 정산한 달 키(monthKey). 매월 1일 1회 정산 중복 방지. -1이면 없음 */
  lastIncomeSettleMonth: number;
  /** 마지막으로 채용공고를 연 날(day). 취업 시도는 하루 1회. -1이면 없음 */
  lastJobBoardDay: number;

  /** 진행 중인 논란 시나리오 id(있으면 강제 팝업). null이면 없음 */
  pendingControversy: string | null;
  /** 투자 시장 상태 */
  market: MarketState;
  /** 구매한 쇼핑 아이템 id 목록 */
  ownedItems: string[];
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
  /** 성인 트윗 누적 작성 수(야밤 DM 트리거용) */
  adultTweetsPosted: number;
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
  /** 성인 트윗을 한 번이라도 올린 적 있는지(성기 사진 DM 등 성인 이벤트 해금) */
  postedAdultEver: boolean;
  /**
   * 데려온 반려동물 보유 여부('사람' 단위 — 산책 이벤트로 획득).
   * 해당 동물을 데려와야 그 동물 주접 트윗(강아지계/고양이계)을 올릴 수 있다.
   */
  pets: { dog: boolean; cat: boolean };
  /** 이스터에그·특수 이벤트 추적 */
  eggs: EggState;

  /** 하루 1회 제한 등을 추적하는 플래그 */
  daily: {
    adWatchedDay: number; // 마지막으로 광고 본 일차 (-1이면 안 봄)
    bannerClaimedDay: number; // 네이놈 배너로 적립받은 일차 (-1이면 안 받음)
  };

  /** 게임 종료 사유(퇴거 등). null이면 진행 중 */
  gameOver: string | null;
}
