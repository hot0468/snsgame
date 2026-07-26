# 브라우저 북마크바 Implementation Plan

> **For agentic workers:** 솔로 순차 실행. 체크박스(`- [ ]`)로 진행 추적.

**Goal:** 재진입 자유 오버레이 사이트(O넷·EBS·재능마켓·직플래닛·괴담)를 주소창의 ⭐로 북마크하고, 주소창 바로 아래 상시 북마크바에서 한 번에 다시 열 수 있게 한다.

**Architecture:** 오버레이는 이미 `ui.*SiteOpen` 플래그 + URL을 가진다. 북마크 대상 5개를 레지스트리로 고정하고, 흩어진 "오버레이 다 닫고 하나 켜기"를 `closeOverlays(ctx)`/`openBookmarkSite(ctx,id)` 헬퍼로 통합해 주소창 ⭐·북마크바·기존 진입로가 재사용한다. 북마크 목록은 `GameState.bookmarks: string[]`로 영구 저장.

**Tech Stack:** TS + Vite. `core→systems→ui` 단방향. el/mount DOM 헬퍼.

## Global Constraints

- 북마크 대상(고정) — 두 종류:
  - **오버레이형 5개**(`kind:"overlay"`, `${id}SiteOpen`): `onet`(o-net.go.kr)·`ebs`(ebs.co.kr)·`gig`(talentmarket.kr)·`jobplanet`(jobplanet.work)·`goedam`(GOEDAM_URL).
  - **탭형 2개**(`kind:"tab"`, `activeTab` 전환, id가 BrowserTabId): `yabam`(yabam.click)·`stocks`(hanaro-invest.com).
  - **제외:** 소원가게·도깨비상점·니글니글·경매·d스토리·방문기록.
- `goedam`은 hosts 매핑(`hostsHasGoedam`)이 있어야 열린다 — 북마크 클릭도 이 가드를 지킨다.
- `bookmarks`는 `string[]`로 core에 저장(유니온 타입은 ui 레이어에만 둔다 — core 순수 유지).
- 북마크바는 브라우저 화면에 **항상** 노출(비면 안내 문구).
- 커밋 메시지 말미 Co-Authored-By 라인.

---

### Task 1: 상태 필드 `bookmarks`

**Files:**
- Modify: `src/core/types.ts` (GameState에 필드 추가)
- Modify: `src/core/state.ts` (`createInitialState`)
- Modify: `src/systems/save.ts` (`sanitize` 폴백)

- [ ] **Step 1: 타입** — `GameState` 인터페이스에 추가(적당한 위치, 예: `hostsFile` 근처 UI/브라우저 관련 필드 곁):

```ts
  /** 주소창 ⭐로 담은 북마크 사이트 id 목록(BookmarkableSiteId). 브라우저 북마크바에 표시. */
  bookmarks: string[];
```

- [ ] **Step 2: 초기값** — `createInitialState`에 `bookmarks: [],` 추가(예: `hostsFile: null,` 근처).

- [ ] **Step 3: sanitize 폴백** — `save.ts` sanitize의 배열 보강 구역에:

```ts
  if (!Array.isArray(state.bookmarks)) state.bookmarks = [];
```

- [ ] **Step 4: typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

---

### Task 2: 사이트 레지스트리 + 오픈 헬퍼 (browser.ts)

**Files:**
- Modify: `src/ui/browser.ts`

**Interfaces:**
- Produces: `BookmarkableSiteId`, `BOOKMARKABLE_SITES`, `closeOverlays(ctx)`, `openBookmarkSite(ctx, id)`, `currentBookmarkableId(ctx)`

- [ ] **Step 1: 레지스트리 + 헬퍼 추가** — browser.ts 상단(다른 상수/헬퍼 곁, GOEDAM_URL import 아래)에:

```ts
/** 북마크 가능한(자유 재진입) 오버레이 사이트. flag는 UIState의 `${id}SiteOpen`. */
export type BookmarkableSiteId = "onet" | "ebs" | "gig" | "jobplanet" | "goedam";

export const BOOKMARKABLE_SITES: { id: BookmarkableSiteId; label: string; url: string }[] = [
  { id: "onet", label: "O넷", url: "o-net.go.kr" },
  { id: "ebs", label: "EBS", url: "ebs.co.kr" },
  { id: "gig", label: "재능마켓", url: "talentmarket.kr" },
  { id: "jobplanet", label: "직플래닛", url: "jobplanet.work" },
  { id: "goedam", label: "괴담", url: GOEDAM_URL },
];

/** 단발 오버레이를 전부 닫는다(주소창/탭전환/북마크 진입 공통). */
export function closeOverlays(ctx: GameContext): void {
  ctx.ui.wishSiteOpen = false;
  ctx.ui.goblinSiteOpen = false;
  ctx.ui.onetSiteOpen = false;
  ctx.ui.ebsSiteOpen = false;
  ctx.ui.gigSiteOpen = false;
  ctx.ui.jobplanetSiteOpen = false;
  ctx.ui.auctionSiteOpen = false;
  ctx.ui.dstorySiteOpen = false;
  ctx.ui.historySiteOpen = false;
  ctx.ui.niglSiteOpen = false;
  ctx.ui.goedamSiteOpen = false;
}

/** 현재 열려 있는 북마크 대상 사이트 id(없으면 null). */
export function currentBookmarkableId(ctx: GameContext): BookmarkableSiteId | null {
  if (ctx.ui.onetSiteOpen) return "onet";
  if (ctx.ui.ebsSiteOpen) return "ebs";
  if (ctx.ui.gigSiteOpen) return "gig";
  if (ctx.ui.jobplanetSiteOpen) return "jobplanet";
  if (ctx.ui.goedamSiteOpen) return "goedam";
  return null;
}

/** 북마크/주소창에서 사이트 오버레이를 연다. 진입 가드가 있는 사이트는 여기서 처리. */
export function openBookmarkSite(ctx: GameContext, id: BookmarkableSiteId): void {
  if (id === "goedam" && !hostsHasGoedam(ctx.store.getState())) {
    ctx.toast("페이지를 찾을 수 없습니다");
    return;
  }
  closeOverlays(ctx);
  if (id === "onet") ctx.ui.onetSiteOpen = true;
  else if (id === "ebs") ctx.ui.ebsSiteOpen = true;
  else if (id === "gig") ctx.ui.gigSiteOpen = true;
  else if (id === "jobplanet") ctx.ui.jobplanetSiteOpen = true;
  else if (id === "goedam") { ctx.ui.goedamSiteOpen = true; ctx.ui.goedamStoryId = null; }
  ctx.refresh();
}
```

> `GameContext`·`hostsHasGoedam`·`GOEDAM_URL`은 browser.ts에 이미 import/정의돼 있다(현재 코드가 사용 중). 없으면 해당 import 추가.

- [ ] **Step 2: 기존 onkeydown의 인라인 closeOverlays 제거·치환** — urlbar input onkeydown(현재 라인 449~462)의 지역 `const closeOverlays = () => {...}` 정의를 삭제하고, 본문의 `closeOverlays()` 호출을 `closeOverlays(ctx)`로 바꾼다. (goedam 분기의 `closeOverlays(); ctx.ui.goedamSiteOpen = true; ...`는 그대로 두거나 `openBookmarkSite(ctx,"goedam")`로 치환 가능 — 최소 변경을 위해 호출부만 `closeOverlays(ctx)`로.)

- [ ] **Step 3: typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

---

### Task 3: 주소창 ⭐ 토글 + 북마크바 렌더 (browser.ts)

**Files:**
- Modify: `src/ui/browser.ts`

**Interfaces:**
- Consumes: Task 2의 레지스트리·헬퍼, `state.bookmarks`

- [ ] **Step 1: ⭐ 버튼** — urlbar(현재 라인 435~485)의 `icon("refresh", {size:14})`와 `urlbarMenu(ctx)` 사이에 별표를 넣는다. urlbar `el(...)` 인자 목록에:

```ts
    ...(function () {
      const bmId = currentBookmarkableId(ctx);
      if (!bmId) return [];
      const marked = ctx.store.getState().bookmarks.includes(bmId);
      return [
        el("button", {
          class: "urlbar__star" + (marked ? " is-on" : ""),
          title: marked ? "북마크 제거" : "북마크 추가",
          onclick: () => {
            ctx.update((d) => {
              const i = d.bookmarks.indexOf(bmId);
              if (i >= 0) d.bookmarks.splice(i, 1);
              else d.bookmarks.push(bmId);
            });
          },
        }, marked ? "★" : "☆"),
      ];
    })(),
```

- [ ] **Step 2: 북마크바 렌더 함수** — browser.ts에 추가:

```ts
/** 주소창 아래 상시 북마크바. 비어 있으면 안내 문구. */
function bookmarkBar(ctx: GameContext): HTMLElement {
  const bms = ctx.store.getState().bookmarks;
  const items = bms
    .map((id) => BOOKMARKABLE_SITES.find((s) => s.id === id))
    .filter((s): s is (typeof BOOKMARKABLE_SITES)[number] => !!s)
    .map((site) =>
      el("button", {
        class: "bookmark",
        title: site.url,
        onclick: () => openBookmarkSite(ctx, site.id),
      }, site.label),
    );
  return el(
    "div",
    { class: "browser__bookmarkbar" },
    ...(items.length
      ? items
      : [el("span", { class: "bookmarkbar__hint" }, "⭐로 자주 가는 사이트를 북마크하세요")]),
  );
}
```

- [ ] **Step 3: 북마크바 삽입** — urlbar와 `browser__content` 사이에 `bookmarkBar(ctx)`를 넣는다. browser.ts에서 urlbar·content를 조립해 반환하는 지점을 찾아(예: `el("div",{class:"browser__chrome"}, urlbar, ...)` 또는 최종 return의 자식 배열) urlbar 다음에 `bookmarkBar(ctx)`를 추가한다.

Run(삽입 지점 확인): `grep -n "urlbar\|browser__content\|browser__chrome" src/ui/browser.ts`

- [ ] **Step 4: typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

---

### Task 4: CSS

**Files:**
- Modify: `src/styles/main.css`

- [ ] **Step 1: 유사 클래스 확인** — `grep -n "browser__urlbar\|urlbar__\|browser__content" src/styles/main.css`로 주변 규칙·변수(색/높이)를 파악.

- [ ] **Step 2: 스타일 추가** — `.browser__urlbar` 규칙 근처에:

```css
.urlbar__star {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  padding: 2px 4px;
  color: var(--text-muted);
}
.urlbar__star.is-on { color: #f5c518; }

.browser__bookmarkbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-window);
  overflow-x: auto;
  min-height: 30px;
}
.bookmark {
  border: 1px solid var(--border);
  background: var(--bg-soft, transparent);
  border-radius: 8px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.bookmark:hover { background: var(--accent-soft, rgba(0,0,0,0.05)); }
.bookmarkbar__hint {
  font-size: 11px;
  color: var(--text-muted);
}
```

> 색 변수(`--bg-window`·`--border`·`--ink`·`--text-muted`)는 Step 1 grep으로 실제 존재하는 이름을 확인해 맞춘다. 없으면 인접 규칙이 쓰는 변수로 교체.

- [ ] **Step 3: build**

Run: `npm run build`
Expected: PASS

---

### Task 5: 통합 QA + 브라우저 확인

- [ ] **Step 1** — `npx tsc --noEmit` · `npm run build` · `npx vitest run --pool=forks`(회귀 그린).
- [ ] **Step 2: 경계면** — `bookmarks`가 세이브 라운드트립·sanitize 폴백에 포함; `openBookmarkSite`가 goedam 가드 유지; ⭐가 북마크 대상 사이트에서만 노출.
- [ ] **Step 3: game-run(최소 스크린샷)** — (1) 북마크바 빈 상태 안내 문구, (2) O넷/EBS 열고 ⭐ 눌러 북마크 후 바에 알약 노출, (3) 다른 탭에서 북마크 클릭 시 그 사이트 오버레이 열림. 2~3장.

---

## 설계 근거 (스펙 겸)

- **왜 오버레이만 대상인가:** 북마크는 "다시 연다"가 전제. 재진입 불가(소원가게)·1회성(d스토리)·기간限(경매)은 담아도 헛클릭이 된다. 자유 재진입 5개만.
- **왜 string[]인가:** core는 UI 오버레이 유니온을 몰라도 된다. 저장은 id 문자열, 유효성은 렌더 시 `BOOKMARKABLE_SITES.find`로 필터(구세이브·삭제 대비).
- **리팩터 범위:** 인라인 `closeOverlays`만 모듈로 승격해 신규 코드와 공유. ⋮메뉴·탭전환의 기존 close 블록은 동작 검증돼 있어 이번엔 안 건드림(회귀 위험 회피).

## 비목표(YAGNI)
- 북마크 순서 변경(드래그)·폴더·이름변경. 파비콘 아이콘(텍스트 알약으로 충분).
- 북마크바 접기/펼치기.
