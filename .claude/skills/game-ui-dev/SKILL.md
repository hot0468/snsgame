---
name: game-ui-dev
description: snsgame의 src/ui/ 화면·모달·컴포넌트와 src/styles/main.css를 구현·수정할 때 사용. SNS 화면·브라우저 탭·작업표시줄·모달·스테이터스 팝업 등 화면 요소를 추가/변경하거나, 스타일(CSS)을 손보거나, el/mount로 DOM을 조립하거나, GameContext(update/refresh/openModal/toast)를 다룰 때 반드시 이 스킬을 사용하라. "화면 만들어", "모달 추가", "버튼/탭", "레이아웃", "스타일/CSS", "UI 고쳐" 같은 요청에 트리거.
---

# 게임 UI 개발 (ui/ · styles/)

snsgame의 화면은 `src/ui/`에 있고, 프레임워크 없이 얇은 DOM 헬퍼로 조립한다. UI의 유일한 책임은 **"언제·어떻게 보여줄지"**다 — 규칙 계산은 `systems/`가 한다.

## 철칙: UI는 규칙을 계산하지 않는다
`data → systems → ui` 단방향. 팔로워 증감·성과·비용 같은 로직은 반드시 `systems/` 함수를 호출한다. UI에서 직접 수식을 짜기 시작하면 규칙이 두 곳에 갈라진다. 필요한 함수가 없으면 systems-engineer에게 만들어 달라고 한다.

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

## CSS (`styles/main.css`, 대용량)

- **재사용 우선.** 새 클래스를 만들기 전 `main.css`에서 유사 클래스를 grep한다. 버튼·카드·바 등 공용 위젯은 `ui/components.ts`에 이미 있을 수 있다.
- 색·간격·폰트는 기존 변수/패턴을 따른다. 임의의 새 색을 도입하지 말 것.
- SNS 관련은 `ui/sns/`에 화면별로 나뉘어 있으니 해당 위치에 맞춰 추가한다.

## 검증
- 작성 후 `npm run typecheck`.
- systems 함수를 호출한다면 **인자 개수·반환 shape**을 실제 시그니처와 대조한다(경계면 버그 주원인). 불확실하면 systems-engineer에게 확인.
- 표시하는 데이터 필드가 실제 GameState/UIState에 존재하는지 확인한다.

## 파일 지도

| 영역 | 파일 |
|------|------|
| 루트 렌더·컨텍스트 | `ui/app.ts`, `ui/context.ts` |
| 브라우저/탭/작업표시줄 | `ui/browser.ts`, `ui/taskbar.ts`, `ui/startMenu.ts` |
| SNS 화면 | `ui/sns/snsView.ts`, `ui/sns/snsPages.ts`, `ui/sns/composeModal.ts` 등 |
| 공용 위젯 | `ui/components.ts`, `ui/icons.ts` |
| 각종 모달 | `ui/*Modal.ts` (event/gacha/loan/offline 등) |
| 달력·스테이터스 | `ui/calendar.ts`, `ui/statusPopup.ts` |
| 포털·유튜브·상점 | `ui/portal.ts`, `ui/youtube.ts`, `ui/shop.ts` 등 |
