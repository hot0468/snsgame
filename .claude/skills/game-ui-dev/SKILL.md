---
name: game-ui-dev
description: snsgame의 src/ui/ 화면·모달·컴포넌트와 src/styles/main.css를 구현·수정할 때 사용. SNS 화면·브라우저 탭·작업표시줄·모달·스테이터스 팝업 등 화면 요소를 추가/변경하거나, 스타일(CSS)을 손보거나, el/mount로 DOM을 조립하거나, GameContext(update/refresh/openModal/toast)를 다룰 때 반드시 이 스킬을 사용하라. "화면 만들어", "모달 추가", "버튼/탭", "레이아웃", "스타일/CSS", "UI 고쳐" 같은 요청에 트리거.
---

# 게임 UI 개발 (ui/ · styles/)

snsgame의 화면은 `src/ui/`에 있고, 프레임워크 없이 얇은 DOM 헬퍼로 조립한다. UI의 유일한 책임은 **"언제·어떻게 보여줄지"**다 — 규칙 계산은 `systems/`가 한다.

## 철칙: UI는 규칙을 계산하지 않는다
`data → systems → ui` 단방향. 팔로워 증감·성과·비용 같은 로직은 반드시 `systems/` 함수를 호출한다. UI에서 직접 수식을 짜기 시작하면 규칙이 두 곳에 갈라진다. 필요한 함수가 없으면 systems-engineer에게 만들어 달라고 한다.

## 렌더 모델: 전체 재렌더 (새 화면 만들기 전에 반드시 이해)

프레임워크가 없다. [app.ts](../../../src/ui/app.ts)는 `store.subscribe(() => render())`로 **상태가 바뀔 때마다 `root.replaceChildren(...)`로 화면을 통째로 다시 그린다.** 재조정(reconciliation)이 없으므로 **DOM에만 있던 휘발성 상태는 재렌더에 전부 날아간다** — 입력값·스크롤 위치·포커스·토글/펼침 상태·`<details>` 열림 등. 깜빡임·스크롤 리셋·입력 소실·재진입 버그가 **각각 따로 터진 뒤** 패치돼 왔다(app.ts 주석이 그 이력이다). 새 위젯에서 "재렌더에 상태가 사라진다"면 그건 버그가 아니라 이 모델의 정상 동작이다. **DOM에 상태를 두지 마라.** 규칙:

1. **휘발성 화면 상태는 `ctx.ui`(UIState)에 둔다, DOM이 아니라.** 트윗 펼침·반응 여부처럼 재렌더를 넘어 유지돼야 하는 건 UIState에 `Set`/필드로 둔다(`expandedTweets`·`reactedTweetIds` 선례). 바꾼 뒤 `ctx.refresh()`.
2. **모달은 `openModal`에 넘긴 함수 identity로 노드가 캐시된다** → 재렌더에도 내부 단계(선택→결과)가 보존된다. 새 모달도 이 패턴을 따르고, **매 렌더 새 화살표 함수를 만들어 넘기지 마라**(identity가 바뀌어 캐시가 깨지고 상태가 초기화된다). 강제 팝업은 app.ts의 우선순위 블록에 조건을 추가한다.
3. **입력 폼**(값을 유지해야 하는 화면)은 값을 UIState에 반영하거나 로그인 화면(`loginNode`)처럼 노드 캐시 대상으로 만든다. 안 그러면 재렌더에 타이핑이 날아간다.
4. **스크롤 보존**이 필요하면 값을 새로 짜지 말고 app.ts의 `SCROLL_SELECTORS`/`viewKey` 메커니즘에 셀렉터를 추가한다.
5. 이 모든 우회는 프레임워크였으면 공짜다. 지금은 바닐라이므로 **"전체 재렌더가 상태를 지운다"를 기본 전제로** 깔고 설계하라.
6. **길어지는 리스트는 전량 `.map` 금지 — 윈도잉하라.** 재조정이 없어 매 재렌더가 카드 전량을 새로 만든다. 플레이 시간에 비례해 자라는 리스트(내 트윗 피드 등)는 `arr.slice(0, ctx.ui.feedShown)`만 그리고, 남으면 `.feed__more`("더 보기") 버튼으로 `ctx.ui.feedShown += FEED_PAGE`(context.ts) 후 `ctx.refresh()`. 최신이 앞이면 새 항목은 슬라이스에 항상 포함돼 안 그려질 걱정이 없다. (데이터 자체의 상한은 systems의 `pushTimeline`/`TIMELINE_MAX`가 별도로 건다.)

## 새 화면을 어디에 붙일까 — 세 가지 그릇

새 화면을 만들기 전에 **어느 그릇인지 먼저 정하라.** 잘못 고르면 나중에 갈아엎어야 한다.

| 그릇 | 성격 | 붙이는 법 | 예 |
|------|------|----------|-----|
| **상시 탭** | 일상적으로 여닫는 사이트. **재방문이 전제** | `context.ts`의 `BrowserTabId` + `browser.ts`의 `TABS`·해금 플래그. urlbar는 `activeDef.url`이 자동 처리 | 너튜브·메디북스·증기·다트 핀 |
| **단발 오버레이 사이트** | 조건부로 잠깐 열리는 곳. 탭 목록엔 없다 | `ui.*SiteOpen` 플래그 + **`browser.ts` 3곳 전부**(탭 이동 시 닫기 / urlbar / 렌더 분기) | 도깨비상점(월 1회)·O넷·서던피스 경매 |
| **모달** | 데스크톱 앱·강제 화면·확인창 | `ctx.openModal(...)`. 작업표시줄 위에 뜨고, 함수 identity로 캐시돼 **재렌더에도 내부 상태가 보존**된다 | 작업 관리자·명령 프롬프트·근무·연구실 |

**판단 기준은 재방문 빈도다.** 매일 갱신되는 콘텐츠를 드물게 훑어야 하는 화면을 단발 오버레이로 만들면, 한 번 보고 기능이 죽는다.

⚠️ 단발 오버레이는 **`browser.ts` 3곳을 전부** 고쳐야 한다 — 하나라도 빠지면 탭을 옮겨도 안 닫히거나 주소창이 안 바뀐다. 탭 방식은 이 문제가 아예 없다.

⚠️ **정한 뒤 주석을 사실과 맞춰라.** 실제로 "사이트"로 설계했다가 탭으로 구현하면서 주석 4건이 거짓으로 남은 적이 있다. 이 저장소는 주석을 계약처럼 쓴다.

## 광고냐 아니냐 — 트윗에 링크를 붙일 때

`adPromo`가 붙은 트윗은 `snsView.ts`의 `adTweetCard`가 그리고 **"광고" 라벨을 무조건 붙인다.** 일반인이 링크를 공유하는 트윗이면 그 경로를 타면 안 된다 — `Tweet.siteLink` + 일반 카드(`reactableCard`)에 링크 미리보기를 얹는다. 톤이 죽는 걸 라벨 하나가 결정한다.

## DOM 조립: `el()` / `mount()` (`utils/dom.ts`)

```ts
el("button", { class: "btn", onclick: () => ctx.toast("클릭!") }, "라벨")
```

- **특수 키:** `class` → className, `html` → innerHTML, `on*`(onclick 등) → 이벤트 리스너. 나머지는 setAttribute.
- **자식:** `el(tag, attrs, ...children)`. `false`/`null`/`undefined` 자식은 자동 무시 → `조건 && el(...)` 패턴 가능.
- **교체 렌더:** `mount(container, ...children)`가 컨테이너를 비우고 새로 채운다.
- **숫자 포맷:** `formatNumber(n)` → "1,000" (ko-KR).
- 문자열 `html`을 남발하지 말고 요소 조립을 선호한다(XSS·이스케이프 안전).

## 상태 변경: `GameContext` (`ui/context.ts`)

모든 컴포넌트는 `ctx: GameContext`를 받는다. 핵심 메서드:

| 용도 | 호출 |
|------|------|
| 게임 상태 변경(+재렌더) | `ctx.update(draft => { ... })` — dispatch 래핑 |
| UI 전용 상태 변경(+재렌더) | `ctx.ui.xxx = ...; ctx.refresh()` |
| 모달 열기/닫기 | `ctx.openModal(render)` / `ctx.closeModal()` |
| 토스트 | `ctx.toast("메시지")` |
| 행동 후 이벤트 시도 | `ctx.afterAction("tweet" \| "offline" \| ...)` |

- **반드시 `ctx.update`/`ctx.refresh`를 통해 바꾼다.** 스토어를 우회해 상태를 직접 mutate하면 구독자(재렌더)가 안 돈다.
- `ctx.ui`(UIState)는 게임 저장 대상이 아닌 **휘발성 화면 상태**(현재 탭·열린 모달·펼침 집합 등)다. 게임 진행 데이터는 `ctx.update`로 GameState에 넣는다. 둘을 헷갈리지 말 것.
- 행동 직후(트윗·외출 등) 랜덤 이벤트를 띄우려면 `ctx.afterAction(trigger)`를 호출한다 — 다른 모달이 떠 있으면 알아서 건너뛴다.

## 모달 패턴

`ctx.openModal(ctx => HTMLElement)`에 렌더 함수를 넘긴다. 기존 모달 하나(예: `ui/eventModal.ts`, `ui/gachaModal.ts`, `ui/sns/composeModal.ts`)를 참고 패턴으로 삼아 헤더·본문·버튼 구조와 닫기 규약(`ctx.closeModal()`)을 맞춘다.

## CSS (`styles/main.css`, 약 1.2만 줄 — 통째 Read 절대 금지)

- **Grep으로 클래스명을 찾고 그 정의 ±30줄만 Read(offset/limit)하라.** 통째로 읽으면 한 번에 수만 토큰이다.
- **재사용 우선.** 새 클래스를 만들기 전 `main.css`에서 유사 클래스를 grep한다. 버튼·카드·바 등 공용 위젯은 `ui/components.ts`에 이미 있을 수 있다.
- 색·간격·폰트는 기존 변수/패턴을 따른다. 임의의 새 색을 도입하지 말 것.
- SNS 관련은 `ui/sns/`에 화면별로 나뉘어 있으니 해당 위치에 맞춰 추가한다.

## 검증
- 작성 후 `npm run typecheck`.
- systems 함수를 호출한다면 **인자 개수·반환 shape**을 실제 시그니처와 대조한다(경계면 버그 주원인). 불확실하면 systems-engineer에게 확인.
- 표시하는 데이터 필드가 실제 GameState/UIState에 존재하는지 확인한다.

## 파일 지도 (비자명한 진입점)

파일 위치의 **공통 규약(화면=`ui/{기능}.ts`, 모달=`ui/{기능}Modal.ts`)은 `CLAUDE.md`의 파일 지도**를 따른다. 규약만으론 못 찾는 것만 둔다:

| 영역 | 진입점 |
|------|------|
| 루트 렌더·컨텍스트 | `ui/app.ts`, `ui/context.ts` (모든 화면이 여기서 마운트) |
| SNS 화면 | `ui/sns/` 하위(`snsView.ts`·`snsPages.ts`·`composeModal.ts` 등 — 루트가 아님) |
| 브라우저 셸(탭·작업표시줄) | `ui/browser.ts`, `ui/taskbar.ts`, `ui/startMenu.ts` |
| 공용 위젯·아이콘 | `ui/components.ts`, `ui/icons.ts` |
