# 팔로워 10만명 모으기 🐦

SNS로 팔로워 10만명을 모으는 것이 목표인 텍스트 기반 브라우저 게임.

## 실행

```bash
npm install
npm run dev       # 개발 서버 (http://localhost:5173)
npm run build     # 프로덕션 빌드 (dist/)
npm run typecheck # 타입 검사
```

## 화면 구성

- **인터넷 브라우저** (상단 탭) — 핵심은 트위터 유사 SNS 탭.
- **작업표시줄** (하단) — 왼쪽 윈도우 버튼(메뉴), 오른쪽 시계.
  - **메뉴**: 외출/휴식/공부/운동 등 오프라인 활동 + 게임 저장/불러오기.
  - **시계**: 달력형 스케줄 표(행동 이벤트 기록).
  - 시계 위 **스테이터스 팝업**: 행동력·정신력·도덕성, 상세 스탯 펼치기.
- **SNS 화면**: 좌측 프로필/액션(계정 탐색·신규 게시글·광고·성인물 해제), 중앙 타임라인.

## 폴더 구조 (모듈 경계)

```
src/
├─ core/        게임 상태·타입·반응형 스토어 (엔진)
│  ├─ types.ts    도메인 타입
│  ├─ state.ts    초기 상태·상수(목표치 등)
│  └─ store.ts    구독형 스토어
├─ data/        콘텐츠 정의 (밸런싱 시 여기만 수정)
│  ├─ attributes.ts  속성·궁합표
│  ├─ stats.ts       스탯 정의
│  ├─ tweets.ts      트윗 문구 템플릿
│  └─ accounts.ts    랜덤 계정/트윗 생성
├─ systems/     게임 규칙 (순수 로직, DOM 무관)
│  ├─ time.ts        시간·스케줄
│  ├─ followers.ts   팔로워/성과 계산
│  ├─ tweetSystem.ts 트윗 등록
│  ├─ exploreSystem.ts 탐색/팔로우/해금
│  ├─ offline.ts     오프라인 활동
│  ├─ ads.ts         광고
│  └─ save.ts        저장/불러오기 (localStorage)
├─ ui/          화면 (systems를 호출만)
│  ├─ app.ts         루트 렌더러
│  ├─ context.ts     UI 컨텍스트
│  ├─ browser.ts / taskbar.ts / startMenu.ts / calendar.ts / statusPopup.ts
│  ├─ components.ts   공용 위젯(스탯 바, 트윗 카드)
│  └─ sns/            SNS 메인·트윗 작성·탐색 모달
└─ utils/       난수·DOM 헬퍼
```

### 설계 원칙

- **data → systems → ui** 한 방향 의존. UI는 규칙을 직접 계산하지 않고 `systems`를 호출한다.
- 밸런스/콘텐츠 조정은 `data/`에서, 규칙 변경은 `systems/`에서, 화면은 `ui/`에서.
- 상태 변경은 항상 `store.dispatch`(UI에서는 `ctx.update`)를 통해서만.

## 현재 구현 상태 (v0.1 세팅)

기본 루프가 동작한다: 트윗 작성 → 팔로워 증감, 계정/게시글 탐색, 오프라인 활동으로 스탯·속성 해금,
광고로 소지금, 성인물 토글, 저장/불러오기, 스케줄 기록.

향후: 계정 이름 설정, 이벤트/퀘스트, 밸런스 조정, 세부 스탯의 오프라인 성장 다양화 등.
