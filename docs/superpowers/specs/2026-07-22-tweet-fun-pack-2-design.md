# 트윗 재미 팩 2 — 설계

> SNS 풍자 + 기존 시스템 재사용을 원칙으로, 3개 모듈(기사화·트친소·트친 생일)을 계층 정합성을 지키며 추가한다.

**승인된 핵심 결정:**
- A(기사화) = **양면**(정상 2차유입 / 왜곡 논란+선택지)
- B(트친소) = **능동**(내가 트친소 트윗을 올려 응답 계정의 트친 진행도 선채움)
- C(트친 생일) = **보너스만**(놓쳐도 무해), 달력 `appointments`에 등록

**의존:** A·B·C 상호 독립(병행 가능). 단 B·C는 모듈 D(트친, 기구현)의 `tchins`/`tchinProgress`/`bumpTchinProgress`를 재사용한다.

---

## 모듈 A · 내 트윗이 기사화 📰

### 목적
떡상에 후속 서사를 붙인다. 성공(떡상)에도 왜곡 보도라는 리스크가 얹혀 긴장감이 생긴다.

### 규칙
- **트리거**: 떡상(`isDdeoksang`) 발생 시 확률 `NEWS_CHANCE = 0.25`로 그날의 떡상 트윗을 기사화 후보로 예약한다.
  - 저장: `GameState.pendingNews: PendingNews | null`. `PendingNews = { tweetId, tweetText, gain, distorted }`.
  - `distorted`는 예약 시점에 확정(정상 60% / 왜곡 40%). 원문 텍스트는 스냅샷으로 담는다(원 트윗이 타임라인 컷으로 사라져도 헤드라인을 만들 수 있게 — `Tweet.quoted` 스냅샷 선례).
- **표시 시점**: **다음날 아침 강제팝업**. `app.ts`의 아침 팝업 체인(`dawnPending` → `pendingRegretTweetId` → …)에 `pendingNews`를 편입한다(`dawn` 다음, 이불킥 근처).
- **정상 보도(distorted=false)**: 언론사 패러디명 + "네티즌 A씨의 ○○가 화제" 헤드라인. 팝업 [확인]만.
  - 효과: 2차 유입 `+round(gain × NEWS_BOOST_RATE)`(`NEWS_BOOST_RATE = 0.5`), 평판 `+3`.
- **왜곡 보도(distorted=true)**: 문맥이 잘린 어그로 헤드라인. 즉석 선택지 2개.
  - **[해명 트윗]**: 무료 게시(슬롯·행동력 미소모)로 해명 트윗을 타임라인에 남긴다. 대개 손실 완화 + 동정 유입(`+round(gain × NEWS_CLARIFY_RATE)`, `0.2`), 평판 소폭 회복. 낮은 확률(`NEWS_BACKFIRE_CHANCE = 0.2`)로 "변명한다" 역풍(추가 팔로워 감소 + 논란).
  - **[무시]**: 팔로워 `-round(gain × NEWS_IGNORE_LOSS_RATE)`(`0.15`) + 논란 확률(`rollControversy`).
- **팝업이 상태를 해제**: 선택 시 `pendingNews = null`(다시 안 뜨게 — 콘솔리뷰 팝업 선례).

### 콘텐츠(`data/news.ts`)
- `NEWS_OUTLETS: string[]` — 언론사 패러디명(실존 금지). 예: "데일리트짹", "스포츠서울숲", "짹짹일보", "인터넷연예뉴스".
- `NEWS_HEADLINES_NORMAL: string[]` / `NEWS_HEADLINES_DISTORTED: string[]` — `{outlet}`·`{snippet}` 토큰을 끼우는 템플릿. snippet은 트윗 본문 앞부분 발췌.
- 밸런스 상수 전부 대문자 `export const`.

### 계층
- `data/news.ts`(문구·상수) → `systems/news.ts`(`maybeQueueNews`·`resolveNews`) → `ui/newsModal.ts`(팝업) + `app.ts`(체인 편입).

---

## 모듈 B · 트친소 (능동 요청) 🤝

### 목적
사교 축. 트친망 성장을 가속하고, 플레이어가 능동적으로 인맥을 넓히는 행동을 제공한다.

### 규칙
- **진입**: SNS 홈 피드 상단(작성 영역 근처)에 **'트친소 올리기' 버튼** 1개 → 확인 모달(`ui/tchinsoModal.ts`) → 게시. **주 1회 쿨다운**(`TCHINSO_COOLDOWN_DAYS = 7`, 쿨다운 중이면 버튼 비활성 + 남은 일수 표시).
  - 저장: 활성 계정 `lastTchinsoDay: number`(0 = 미사용). 쿨다운 판정.
- **비용**: 일반 트윗과 동일(행동력 `TWEET_ACTION_COST` + 게시 슬롯 1). 트친소 트윗도 `pushTimeline`으로 타임라인에 남긴다(팔로워 효과는 미미 — 사교 목적).
- **응답**: 게시 시 응답 계정 `2~4명` 등장(기존 `makeRandomAccount` 재사용). 응답 수는 친화력 스탯이 가산(`base 2 + floor(friendliness/300)`, 상한 4).
  - 각 응답 계정의 `tchinProgress[handle]`를 `TCHINSO_PREFILL = 2~3`(랜덤)로 **선채움**. 이후 몇 번만 상호작용하면 트친 성사(임계 `TCHIN_THRESHOLD = 5`).
  - 이미 트친(`tchins.includes`)인 핸들은 스킵. 중복 응답 핸들도 스킵.
- **결과 표시**: 응답 계정 목록(이름·핸들·"트친 되기까지 N번 남음")을 토스트 또는 작은 결과 팝업으로 안내.

### 콘텐츠(`data/tchinso.ts`)
- `TCHINSO_TWEET_TEXT: string[]` — 트친소 올릴 때 내 트윗 문구 풀.
- `TCHINSO_REPLY_LINES: string[]` — 응답 계정의 "저요! 트친해요" 문구 풀.
- 상수: `TCHINSO_COOLDOWN_DAYS`, `TCHINSO_PREFILL_MIN/MAX`, `TCHINSO_RESP_MIN/MAX`.

### 계층
- `data/tchinso.ts` → `systems/tchin.ts` 확장(`postTchinso(state): TchinsoResult`, `canPostTchinso(state): boolean`) → `ui`(진입 버튼 + 결과 표시).

---

## 모듈 C · 트친 생일 🎂

### 목적
달력을 볼 이유를 만든다. 트친 관계에 온기와 리듬을 더한다.

### 규칙
- **등록**: 트친 성사 순간(`bumpTchinProgress`가 "became" 반환 시), 그 핸들의 **생일을 결정론적으로 산출**해 달력 `appointments`에 등록.
  - 생일 결정론: `hashInt(handle)`로 향후 30~120일 내 하루를 뽑는다(`START_DATE`/`day` 기반). 매 세션 재계산해도 같은 날.
  - 신규 `AppointmentKind` 멤버 `"birthday"` 추가 → **파급**: `types.ts` 유니온 + `ui/calendar.ts`의 `KIND_ICON` Record(exhaustive, 🎂/선물 아이콘) + 아이콘이 없으면 `ui/icons.ts`에 추가.
  - Appointment의 기존 `partnerName?` 필드에 **트친 핸들**을 담는다(축하 트윗이 대상 핸들을 알아야 함 — 신규 필드 없이 재사용).
  - **다음 도래 생일 1회만** 등록(YAGNI — 매년 반복 없음). 도래·처리 후 재등록하지 않는다.
- **당일 알림**: 생일 당일 아침(또는 `onNewDay`) 카톡 알림("오늘 @○○ 생일이래요! 🎂").
  - 알림/트친 화면에서 **[축하 트윗 보내기]** → 자동 축하 문구로 **무료 게시**(슬롯 미소모 — 축하가 부담이 되면 안 됨).
  - 보상: 보너스 팔로워(`BIRTHDAY_BONUS = randInt`) + 그 트친의 **답례 리트윗 확정 발동**(`maybeSpawnTchinBoost`의 확정판 재사용).
- **놓쳐도 무해**: 축하를 안 보내도 페널티 없음. 약속은 도래일이 지나면 자연 소멸(`dropAppointment`/만료 로직 재사용). 트친 관계는 유지.

### 콘텐츠(`data/birthday.ts` — 신규 파일)
- `BIRTHDAY_KAKAO_LINES`, `BIRTHDAY_TWEET_LINES`(축하 자동 문구), `BIRTHDAY_MIN_DAYS/MAX_DAYS`, `BIRTHDAY_BONUS_MIN/MAX`.

### 계층
- `data`(문구·상수) → `systems/tchin.ts` 확장(`scheduleBirthday`·`sendBirthdayTweet`) + `systems/appointments.ts`(kind 확장) → `ui/calendar.ts`(아이콘) + 카톡 알림 + [축하] 버튼.

---

## 공통 규약 (전 모듈)

- **저장 하위호환**: 신규 persist 필드(`pendingNews`, 계정 `lastTchinsoDay`, `birthday` appointment)는 전부 `createInitialState` 기본값 + `save.sanitize` 폴백. 구세이브는 `pendingNews=null`·`lastTchinsoDay=0`으로 시작.
- **`AppointmentKind` 확장 파급**: 유니온을 넓히면 `KIND_ICON`(exhaustive Record)이 컴파일 에러로 강제한다 — 함께 채운다. 다른 `Record<AppointmentKind,...>` 있으면 동일.
- **게시 트윗은 반드시 `pushTimeline`**(해명·트친소·축하 트윗 모두). `timeline.unshift` 직접 호출 금지.
- **결정론**: 생일 날짜는 `hashInt` 시드(핸들). `Math.random` 금지 — 재렌더/재세션에 안 바뀌게.
- **밸런스 수치 전부 `data/`에 대문자 상수.** 실존 인물/상표 패러디 금지, 한국어 창작 톤.
- **강제팝업 상태 해제**: `pendingNews`는 팝업 선택이 반드시 `null`로 클리어(안 하면 매 렌더 재팝업).

## 테스트 (vitest 순수 로직)

- **A**: `maybeQueueNews`가 떡상 아니면 미예약; 예약 시 스냅샷·distorted 확정. `resolveNews("clarify"/"ignore")` 분기별 팔로워 델타 부호·`pendingNews=null`.
- **B**: `canPostTchinso` 쿨다운(같은 주 재게시 불가). `postTchinso`가 응답 핸들의 `tchinProgress`를 선채움하고, 이미 트친인 핸들은 스킵. 응답 수 상한.
- **C**: `scheduleBirthday`가 `appointments`에 `kind:"birthday"` 1건 등록(결정론 — 같은 핸들 같은 날). `sendBirthdayTweet`가 무료 게시(슬롯 미소모) + 보너스 팔로워 + 약속 소멸.

## 파일 요약

**신규**: `data/news.ts`, `data/tchinso.ts`, `data/birthday.ts`, `systems/news.ts`, `ui/newsModal.ts`, `ui/tchinsoModal.ts`.
**수정**: `core/types.ts`(PendingNews·AppointmentKind·계정 lastTchinsoDay), `core/state.ts`, `systems/save.ts`, `systems/tchin.ts`(트친소·생일), `systems/appointments.ts`(kind), `systems/tweetSystem.ts`(떡상→maybeQueueNews 훅), `ui/app.ts`(뉴스 팝업 체인), `ui/calendar.ts`(생일 아이콘), `ui/sns/snsView.ts`(트친소 버튼 + 생일 알림/버튼), `styles/main.css`, `__tests__/tweetFunPack2.test.ts`.
