# 개발자 도구 · d스토리 블로그 퍼즐 설계

작성일: 2026-07-17

## 개요

주소창에 설정(⋮) 버튼을 달고, 거기서 열리는 **가짜 크롬 개발자 도구** 팝업과,
IT 트윗으로 발견하는 **d스토리 블로그**(티스토리 패러디)를 잇는 히든 퍼즐을 추가한다.
블로그 게시글 2개는 각각 비밀번호로 잠겨 있고, 정답은 게임 안 다른 화면에 숨어 있다.
풀면 신설 **IT 스탯**이 크게 오른다.

## 플레이 흐름

```
SNS 탐색 → IT계 검색 → (낮은 확률) 링크 트윗
   "퍼블리싱하다 막막하신 분들, 여기 꼭 정독하세요!"
      │ 클릭
      ▼
d스토리 블로그(오버레이) — 게시글 2개, 둘 다 [잠김]
   ├ 글1  힌트 "F12"   → 주소창 ⋮ → 개발자 도구 → Console 탭  → pw:itchlrh!
   └ 글2  힌트 "IPv4"  → 시작메뉴 → 명령 프롬프트 → ipconfig → IPv4 주소
      │ 비밀번호 입력 성공
      ▼
본문 공개(HTML이란 무엇인가 / 자바스크립트의 역사 등 평범한 IT 지식) + IT 스탯 +80
```

### 오버레이인데 퍼즐이 성립하는 이유

d스토리는 소원 가게·도깨비 상점처럼 `ui.dstorySiteOpen` 플래그로 현재 탭 콘텐츠를
덮는 **단발 오버레이**다(탭을 옮기면 닫힌다). 정답을 찾으러 가야 하는데 사이트가
닫히면 곤란해 보이지만, 정답 소스 둘 다 **모달**이다:

- 개발자 도구 — `ctx.openModal`. `activeTab`을 안 건드림
- 명령 프롬프트 — 시작 메뉴에서 여는 모달. 역시 `activeTab`을 안 건드림

즉 오버레이 위에 모달이 뜨고, 모달을 닫으면 d스토리가 그대로 남아 있다.
설령 탭을 옮겨 닫혔더라도 **두 글을 다 풀기 전까지 링크 트윗은 계속 스폰**되므로
IT계 검색을 다시 하면 재진입할 수 있다.

## 계층별 변경

의존 방향 `data → systems → ui`를 지킨다.

### core

**`core/types.ts`**
- `SkillStatId`에 `"it"` 추가
- `SiteLinkId`에 `"dstory"` 추가 (현재 `"dartpin"` 단일 유니온)
- `GameState`에 `dstoryUnlockedPosts: string[]` 추가 — 비번을 푼 게시글 id 목록.
  IT 보상 중복 수령 방지에 그대로 쓰인다(별도 플래그 불필요).

**`core/state.ts`**
- `skills`에 `it: 0` 추가
- `dstoryUnlockedPosts: []` 추가

> 세이브 폴백은 손댈 필요 없다. `systems/save.ts:101`의
> `state.skills = { ...fresh.skills, ...state.skills }`가 신규 스킬 키를 자동 보강한다.
> `dstoryUnlockedPosts`는 `loadGame` 최상위 merge가 기본 `[]`를 넣지만,
> 구세이브가 배열이 아닐 여지를 막기 위해 `if (!Array.isArray(...)) = []` 한 줄을 넣는다
> (기존 `kakao`·`appointments`와 같은 패턴).

### data

**`data/stats.ts`**
- `SKILL_STATS`에 `it: { label: "IT", emoji: "", max: MAX_SKILL }` 추가

> 이 한 줄이면 스테이터스 팝업·Cheat.exe·도깨비 상점·경매·소원 가게가 전부 따라온다.
> 전 계층이 `SKILL_STAT_IDS` / `SKILL_STATS`를 순회하고 하드코딩하지 않기 때문이다.
> 스킬은 999 스케일(`MAX_SKILL`)이며 클램프는 `systems/stats.ts`의 `clampSkill`을 쓴다.

**`data/dstory.ts`** (신규)
- `DSTORY_URL = "dstory.tistory.com"` — 주소창 표시용
- **정답 상수 2개** — 개발자 도구·cmd와 게시글이 공유하는 단일 출처:
  - `DEVTOOLS_CONSOLE_PW = "itchlrh!"` — 개발자 도구 Console 탭이 출력하고, 글1의 정답
  - `LOCAL_IPV4 = "192.168.0.17"` — cmd `ipconfig`가 출력하고, 글2의 정답
- `DSTORY_POSTS: DstoryPost[]` — 게시글 2개
  ```ts
  interface DstoryPost {
    id: string;
    title: string;
    date: string;      // 고정 표시용 날짜
    hint: string;      // 잠김 화면의 "비밀번호 힌트"
    password: string;  // 정답(위 상수 참조)
    body: string[];    // 문단 배열
  }
  ```
  - 글1: 힌트 `"F12"`, 정답 `DEVTOOLS_CONSOLE_PW`, 본문 = HTML이란 무엇인가
  - 글2: 힌트 `"IPv4"`, 정답 `LOCAL_IPV4`, 본문 = 자바스크립트의 역사
  - 본문은 **평범한 IT 지식 글**이다. 퍼즐의 보상은 IT 스탯이지 본문의 반전이 아니다.
- `DSTORY_TWEET_TEMPLATES` — 링크 트윗 문구(작성자명·핸들·본문).
  본문에 URL을 넣지 않는다 — 링크는 `Tweet.siteLink`로 붙고 UI가 따로 렌더한다.

### systems

**`systems/dstory.ts`** (신규) — `systems/dartpin.ts`를 형태의 참고로 삼되, 탭이 아니라
오버레이라는 점이 다르다.
- `DSTORY_TWEET_CHANCE = 0.2` — IT계 검색 결과에 링크 트윗이 섞일 확률
- `DSTORY_IT_GAIN = 80` — 게시글 하나를 풀 때 오르는 IT 스탯.
  근거: 도서관 오프라인 활동이 지식 +25, Cheat.exe가 전 스킬 +100(999 스케일).
  히든 퍼즐 보상이므로 그 사이에 둔다. 2글 다 풀면 +160.
- `isDstoryTweet(tweet): boolean` — `tweet.siteLink === "dstory"`
- `makeDstoryTweet(state): Tweet` — `siteLink: "dstory"`. **`adPromo`를 붙이지 않는다**
  (광고 라벨이 붙는 순간 톤이 죽는다 — `systems/dartpin.ts` 헤더의 근거가 그대로 적용된다)
- `isDstoryDone(state): boolean` — 두 글 다 풀었는지. 링크 트윗 스폰 중단 조건
- `tryUnlockDstoryPost(state, postId, input): boolean`
  - 입력을 `trim()`한 뒤 정답과 비교한다. 글1은 대소문자 무시, 글2(IP)는 그대로 비교
  - 이미 푼 글이면 상태를 바꾸지 않고 `true`를 돌려준다(잠김 화면으로 돌아갈 일이 없다)
  - 처음 푼 경우에만 `dstoryUnlockedPosts.push(postId)` + `clampSkill`로 IT `+DSTORY_IT_GAIN`
  - 시간·행동력을 소모하지 않는다(히든 퍼즐이지 행동이 아니다)

**`systems/exploreSystem.ts`**
- `searchTweetsByCategory(state, attr)`에서 `attr === "it"` && `!isDstoryDone(state)`일 때
  `chance(DSTORY_TWEET_CHANCE)`로 3칸 중 한 칸을 `makeDstoryTweet`으로 교체한다.
- `exploreTweets`(둘러보기 피드)는 **건드리지 않는다** — 링크 트윗은 IT계 검색 결과에만 뜬다.

### ui

**`ui/context.ts`**
- `UIState`에 추가:
  - `settingsMenuOpen: boolean` — 주소창 ⋮ 팝오버 열림 여부
  - `dstorySiteOpen: boolean` — d스토리 오버레이 열림 여부
  - `dstoryPostId: string | null` — 열어본 게시글 id(null이면 목록)
- `createUIState()`에 각각 `false` / `false` / `null` 초기화

**`ui/browser.ts`**
- 주소창(`browser__urlbar`) 새로고침 아이콘 **오른쪽**에 ⋮ 버튼 추가.
  클릭 시 `ui.settingsMenuOpen` 토글 후 `refresh()`.
- 열려 있으면 그 아래 팝오버를 띄운다. 항목 **1개**: `개발자 도구  F12`
  (크롬 메뉴처럼 오른쪽에 단축키를 흐리게 표기)
  - 클릭 → `settingsMenuOpen = false`, `ctx.openModal(renderDevtools)`
  - 팝오버 바깥 클릭 시 닫힘
- 탭 클릭 핸들러의 단발 사이트 리셋 목록에 `ctx.ui.dstorySiteOpen = false` 추가
- 주소창 url 표시 분기에 `dstorySiteOpen → DSTORY_URL` 추가
- 콘텐츠 렌더 분기에 `dstorySiteOpen → renderDstory(ctx)` 추가
  (기존 `wishSiteOpen`/`goblinSiteOpen`/`onetSiteOpen`/`auctionSiteOpen`과 나란히)

**`ui/devtools.ts`** (신규) — 크롬 개발자 도구 풍 모달.
- **게임 상태를 읽지도 쓰지도 않는다.** 내용은 전부 고정 — 언제 열어도 똑같이 보인다.
- 상단 탭바 4개: `Elements` / `Console` / `Sources` / `Network`.
  탭 전환은 모달 안의 로컬 변수 + DOM 교체로 처리한다(게임 상태·재렌더 무관).
  기본 선택은 `Elements` — Console을 기본으로 열면 비밀번호가 공짜로 보인다.
- 탭별 고정 내용:
  - **Elements** — 들여쓰기된 가짜 DOM 트리(`<html>`/`<head>`/`<body>` … ), 문법 하이라이팅 색
  - **Console** — 가짜 로그 몇 줄 사이에 `pw:itchlrh!`를 섞는다.
    맨 위/맨 아래가 아니라 중간에 둔다(한 줄만 덩그러니 있으면 티가 난다).
    경고/에러 줄은 크롬처럼 노란/빨간 배경으로 구분한다.
  - **Sources** — 좌측 파일 트리 + 우측 줄번호 붙은 코드 조각
  - **Network** — 요청 테이블(Name/Status/Type/Size/Time)
- 헤더는 기존 `winTitlebar`(cmd가 쓰는 것)를 재사용해 닫기를 붙인다.

> Performance/Memory/Application 탭은 만들지 않는다. 아무도 안 눌러볼 가짜 패널을
> 3개 더 그리는 일이고, 퍼즐에도 톤에도 기여하지 않는다.

**`ui/dstory.ts`** (신규) — 티스토리 풍 블로그 오버레이.
- 블로그 헤더(제목 "d스토리", 부제)
- `dstoryPostId === null`이면 **글 목록** — 제목·날짜·잠김 자물쇠 표시.
  이미 푼 글은 자물쇠 없이 표시한다.
- 글을 고르면 `dstoryPostId` 설정 후 `refresh()`
- 글 상세:
  - `dstoryUnlockedPosts`에 없으면 **잠김 화면** — "보호되어 있는 글입니다",
    비밀번호 input + 확인 버튼 + `비밀번호 힌트: {post.hint}`
    - 확인 → `ctx.update((s) => ok = tryUnlockDstoryPost(s, id, input.value))`
    - 성공 → `ctx.toast("IT +80")`, 상태 변경으로 자동 재렌더되며 본문이 보인다
    - 실패 → `ctx.toast("비밀번호가 맞지 않습니다")`, 입력값 유지
    - Enter 키도 확인 버튼과 동일하게 동작
  - 풀었으면 **본문**(문단 배열 렌더) + 목록으로 돌아가는 링크

**`ui/sns/snsPages.ts`**
- `dstoryLinkCard(ctx)` 추가 — `dartpinLinkCard`와 같은 자리(본문 아래·액션 바 위),
  같은 `tweet-link` 클래스를 재사용한다.
  - 클릭 → `ctx.ui.dstorySiteOpen = true`, `ctx.ui.dstoryPostId = null`, `refresh()`
  - **탭을 바꾸지 않는다** — 현재 탭(SNS) 콘텐츠를 덮는 오버레이다
  - `unlockDartpin` 같은 해금 호출이 없다. 오버레이는 상태에 남지 않는다
- `reactableCard`의 `isDartpinTweet` 분기 옆에 `isDstoryTweet` 분기 추가

**`ui/cmd.ts`**
- `ipconfig` 명령 추가. 진짜 윈도우 출력 형태를 흉내낸다:
  ```
  Windows IP 구성

  이더넷 어댑터 이더넷:

     연결별 DNS 접미사. . . . :
     링크-로컬 IPv6 주소 . . . : fe80::1c3a:9d21:5b7e:3f42%12
     IPv4 주소 . . . . . . . . : 192.168.0.17
     서브넷 마스크 . . . . . . : 255.255.255.0
     기본 게이트웨이 . . . . . : 192.168.0.1
  ```
  IPv4 값은 `data/dstory.ts`의 `LOCAL_IPV4`를 import해서 쓴다 — 하드코딩 금지.
- **`HELP_LINES`에 넣지 않는다.** 실제 cmd에서도 `ipconfig`는 외부 명령이라 `help`
  목록에 뜨지 않고, 힌트가 "IPv4"인 이상 명령 이름은 플레이어가 알아내야 할 몫이다.
  (기존 소지금 치트를 help에서 숨긴 것과 같은 원칙)

**`ui/app.ts`**
- `createApp` 안에서 `window.addEventListener("keydown")`으로 F12를 잡아 개발자 도구
  모달을 연다. `main.ts`가 아니라 여기다 — `ctx.openModal`을 그대로 쓸 수 있다.
  힌트가 "F12"인데 F12를 눌러 아무 일도 없으면 앞뒤가 맞지 않는다.
- `preventDefault()`를 호출하지만 **브라우저가 진짜 개발자 도구를 여는 걸 막지 못할 수
  있다**(F12는 브라우저 예약 단축키다). 구현 중 `game-run` 스킬로 실제 확인한다.
  막지 못하더라도 퍼즐은 깨지지 않는다 — 힌트 "F12"는 ⋮ 메뉴의 `개발자 도구  F12`
  항목으로도 해결되고, 그쪽이 정규 경로다.

**`styles/main.css`**
- `.urlbar__menu` / `.settings-popover` — ⋮ 버튼과 팝오버
- `.devtools` 계열 — 크롬 개발자 도구 다크 패널(탭바·Elements 트리·Console 줄·Network 표).
  기존 `.modal--win`(cmd가 쓰는 창 스타일)을 베이스로 얹는다.
- `.dstory` 계열 — 티스토리 풍 밝은 블로그(헤더·글 목록·잠김 카드·본문)
- `.tweet-link`는 **재사용**한다(다트 핀이 쓰는 그것). 새로 만들지 않는다.

## 검증

**`src/__tests__/dstory.test.ts`** (신규)
- `tryUnlockDstoryPost` 정답 → `true`, `dstoryUnlockedPosts`에 id 추가, IT `+80`
- 오답 → `false`, 상태 무변화(IT 그대로, 목록 그대로)
- 같은 글 두 번 풀기 → IT가 두 번 오르지 않는다(중복 수령 방지)
- 글1 정답은 대소문자·앞뒤 공백을 관대하게 받는다
- `LOCAL_IPV4`가 cmd `ipconfig` 출력 문자열에 포함된다(정답 소스 일치)
- `isDstoryDone`이 두 글 다 풀었을 때만 `true`

**`npm test` · `npm run typecheck` · `npm run build`** 통과.

**`game-run` 스킬로 눈으로 확인** — typecheck·build로는 잡히지 않는 것들:
- ⋮ 버튼이 새로고침 아이콘 옆에 정렬돼 보이는가, 팝오버가 잘리지 않는가
- 개발자 도구가 크롬처럼 보이는가, Console에서 `pw:itchlrh!`가 읽히는가
- F12 키가 진짜 브라우저 개발자 도구를 여는가(위 위험 확인)
- d스토리 오버레이 위에 cmd 모달이 뜨고, 닫으면 오버레이가 남아 있는가 ← **퍼즐의 전제**
- IT계 검색을 반복하면 링크 트윗이 실제로 뜨는가

## 명시적으로 하지 않는 것

- 개발자 도구 탭 7개 전부 구현 — 4개만
- 개발자 도구를 게임 상태와 연동(진짜 DOM 표시 등) — 전부 고정 가짜
- d스토리를 브라우저 탭으로 승격 — 단발 오버레이(사용자 확정)
- 링크 트윗을 둘러보기 피드에도 노출 — IT계 검색 결과에만(사용자 확정)
- d스토리 게시글 3개 이상 — 2개
