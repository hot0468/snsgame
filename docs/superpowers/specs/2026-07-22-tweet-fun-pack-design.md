# 트윗 재미 팩 — 설계 문서 (2026-07-22)

SNS(트위터) 이용/트윗 작성의 재미를 올리는 4개 모듈. 각 모듈은 독립적으로 구현·검증 가능하며,
공통으로 `data → systems → ui` 계층 경계를 지키고 밸런스 상수는 `data`에 둔다. 신규 저장 필드는
`systems/save.ts` 폴백을 추가한다.

승인된 핵심 결정: A=연출+소폭 보너스 / B=하이리스크(톤 매칭) / C=이불킥 이벤트 포함 / D=여러 명+도달 보너스.

---

## 모듈 A · 떡상 연출

**목적**: 대박 트윗의 손맛. 지금은 `+N 팔로워` 토스트로 끝나는 순간을 연출+보상으로 승격.

- **트리거(systems/followers 또는 tweetSystem)**: 한 트윗의 팔로워 증가분이 예외적으로 클 때.
  판정식: `delta >= max(DDEOKSANG_MIN, activeFollowers * DDEOKSANG_RATE)`.
  기본값: `DDEOKSANG_MIN = 300`, `DDEOKSANG_RATE = 0.05`. (data 상수)
- **보너스**: 떡상 확정 시 증가분의 `DDEOKSANG_BONUS_RATE`(기본 0.3)만큼 팔로워를 한 번 더 얹는다.
  보너스는 떡상 판정 이후 계산하되, 보너스로 다시 떡상 재귀 트리거하지 않는다(1회).
- **연출(ui)**: 전용 오버레이 `renderDdeoksang` — 좋아요·RT 숫자 카운트업 애니 + 폭죽 + "떡상 중 🔥" 배너.
  탭하거나 ~2.5초 후 닫힘. 게임 상태 변경 없음(연출만).
- **연결점**: `postTweet`·QRT 게시 결과에 `ddeoksang: boolean`(+연출용 표시 수치)을 실어 보내고,
  composeModal/QRT 호출부가 `ddeoksang`이면 토스트 대신(또는 직후) 오버레이를 띄운다.
- **도전과제**: '첫 떡상' 히든 도전과제 1개 추가(data/achievements).
- **계층**: core(WorkResult류 반환 확장) · data(상수·도전과제) · systems(판정·보너스) · ui(오버레이+css).

## 모듈 B · 인용 트윗(QRT) — 하이리스크

**목적**: 남 트윗과 상호작용. 둘러보기 피드가 '좋아요/악플'만 되던 걸 인용까지 확장.

- **진입(ui/sns)**: 둘러보기 피드(및 검색/홈)의 남 트윗 카드에 기존 반응 옆 **"인용" 버튼**.
  누르면 QRT 작성 모달: 내 코멘트 **톤 선택**(예: `agree` 동조 / `hype` 맞장구 / `snark` 츳코미).
- **판정(systems/tweetSystem 또는 신규 systems/quote)**: 인용 대상의 **인기**(likes+retweets)가 판돈.
  성공 여부는 **궁합**으로 정한다(둘러보기 트윗엔 명시적 톤 필드가 없으므로 '대상 톤'에 의존하지 않는다):
  `aff = getAffinity(내 계정 성향, 대상 계열)`.
  - **성공(aff ≥ 0)**: `팔로워 += round(대상인기 × QRT_HIT_RATE × (1 + aff보정))` (대박). 낮은 확률로 떡상까지.
  - **역풍(aff < 0)**: **알티 역풍** — `팔로워 -= round(대상인기 × QRT_RATIO_RATE)` +
    `controversy` 발생 확률 가산(기존 `systems/controversy` 재사용).
  - **톤 선택은 배율·리스크를 조절**한다(대상 톤 매칭이 아니라 내 태도): `hype`=고보상·고위험,
    `agree`=안전(보상·리스크 완화), `snark`=논란 확률↑·보상↑. 성공/역풍의 뼈대는 궁합이 정한다.
  - 기본값: `QRT_HIT_RATE=0.15`, `QRT_RATIO_RATE=0.08`. (data 상수, 밸런스 조정)
- **결과물(core/types)**: 내 타임라인에 원문이 **인용 카드로 박힌 QRT 트윗** 생성.
  `Tweet.quoted?: { authorName; authorHandle; text; attribute }` 필드 추가(스냅샷 — 원문 id 참조 아님, 세이브 안정).
- **비용**: 행동력·게시슬롯은 일반 트윗과 동일(`TWEET_ACTION_COST`, canPostBySlot).
- **계층**: core(Tweet.quoted) · data(QRT 톤·코멘트 문구 풀) · systems(판정·논란 연결) · ui(인용 버튼·QRT 모달·인용 카드 렌더+css).

## 모듈 C · 심야 취중 트윗 + 이불킥

**목적**: 이 게임 특유의 하이리스크 개그. 심야에 취해 블라인드로 트윗 → 다음날 수습/방치.

- **트리거(systems/time.onLateNight 또는 app 강제팝업 체인)**: 심야 진입 시 `DRUNK_CHANCE`(기본 0.15)로 발동.
  이미 취중 대기중이거나 다른 강제 이벤트 중이면 스킵. app.ts 강제팝업 우선순위에 편입(괴담/취침 근처).
- **흐름(ui)**:
  1. "술을 마셨다 🍶" 알림 → 앱 루트에 **블러**(css `filter: blur`) 적용.
  2. **취중 트윗 팝업**: 랜덤 취중 문구가 이미 정해져 있으나 **블러로 안 읽힘**. 버튼은 **[등록]** 하나뿐(블라인드 게시).
  3. 등록 → 취중 트윗이 타임라인에 게시(초고분산 결과) → **다음날로 진행 + 블러 해제**.
- **결과(systems)**: 취중 트윗 팔로워 효과는 **초고분산**(대박 or 흑역사/논란). 논란은 기존 controversy 경유.
- **이불킥(다음날 아침, app 강제팝업)**: 어젯밤 글이 또렷이 보이는 `renderMorningRegret` 팝업 —
  - **[삭제(수습)]**: 글 내림 → 그 트윗으로 얻은 팔로워 반납, 대신 논란·박제 리스크 제거.
  - **[방치(박제)]**: 그대로 둠 → 대박이면 이득 유지, 흑역사면 논란/박제 확률 잔존.
- **상태(core/types)**: `drunkPending: boolean`(취중 팝업 대기), `pendingRegretTweetId: string | null`(이불킥 대상).
  세이브 폴백 추가. 회피 선택지는 없음(강제 — 승인된 흐름).
- **계층**: core(상태 2필드) · data(취중 문구 풀) · systems(취중 발동·게시·이불킥 삭제/방치) · ui(블러·취중팝업·이불킥팝업+css).

## 모듈 D · 트친(단짝) — 여러 명 + 도달 보너스

**목적**: 사회적 온기 + 성장 축. 트친이 많을수록 기본 도달이 올라간다.

- **획득(systems)**: 특정 계정과의 상호작용(좋아요/악플/인용/DM)이 누적돼 임계(`TCHIN_THRESHOLD`, 기본 5)를
  넘으면 그 계정이 **트친**이 된다. 여러 명 누적 가능. 상호작용 카운트는 계정(핸들)별로 센다.
  - 저장: `tchins: string[]`(트친 핸들 목록) + `tchinProgress: Record<handle, number>`(상호작용 카운터). 활성 계정 소속.
- **혜택(패시브)**: 트친 수만큼 **기본 도달↑** — 모든 트윗 팔로워 증가분에 `1 + min(tchins.length, TCHIN_CAP) × TCHIN_REACH`.
  기본값: `TCHIN_REACH=0.03`, `TCHIN_CAP=8`(상한 +24%). (data 상수)
- **혜택(액티브)**: 트윗 게시 후 낮은 확률로 트친 1명이 내 최근 트윗을 **리트윗으로 띄워줌**(보너스 팔로워)
  또는 응원 DM 1회. (기존 리트윗/DM 구조 재사용 — 모듈 B의 quoted에 의존하지 않아 D는 독립 구현 가능.)
- **성사 알림(ui)**: 트친이 된 순간 토스트/작은 배너. 트친 목록은 프로필/사이드 어딘가에 표시(과하지 않게).
- **계층**: core(tchins·tchinProgress) · data(트친 후보 문구·상수) · systems(성사·도달 배율·인용RT 스폰) · ui(성사 알림·목록).

---

## 공통 사항

- **밸런스 상수**는 전부 `data`에 둔다(위 대문자 상수들). 규칙 변경은 `systems`, 화면은 `ui`.
- **신규 저장 필드**(Tweet.quoted, drunkPending, pendingRegretTweetId, tchins, tchinProgress)는
  `createInitialState` 기본값 + `systems/save.ts sanitize` 폴백을 반드시 추가한다.
- **연출 오버레이/블러**는 게임 상태를 바꾸지 않는다(순수 표시). 상태 변경은 `ctx.update`만.
- **의존 순서**: 모듈 A는 QRT·취중도 재사용하므로 **A(떡상 판정/연출) 먼저**, 그 위에 B·C·D.
  B/C/D는 서로 독립이라 병행 가능.

## 테스트/검증

- 각 모듈 구현 후 `npm run typecheck` + `npm run build` + `npm test`.
- 순수 로직 회귀 테스트(vitest) 추가 대상: 떡상 판정식, QRT 성공/역풍 분기, 트친 성사·도달 배율,
  취중 게시·이불킥 삭제/방치 결과. (DOM 없는 systems 함수 위주)
- UI(연출·블러·팝업)는 typecheck/build로 잡히지 않으므로, 필요 시 game-run으로 눈 확인(단, 서버 기동은 사용자 승인 후).

## 스코프 밖(YAGNI)

- 트친의 오프라인 만남/연애 라인(기존 관계 시스템과 중복 — 넣지 않음).
- QRT의 QRT(중첩 인용), 인용 스레드, 취중 트윗 회피 선택지(승인 흐름상 강제).
- 떡상 랭킹/기록 페이지(연출·보너스로 충분).
