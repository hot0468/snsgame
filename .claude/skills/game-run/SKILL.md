---
name: game-run
description: snsgame을 실제 브라우저로 띄우고 클릭해서 화면을 눈으로 확인할 때 사용. "게임 실행", "앱 띄워", "스크린샷", "화면 확인", "직접 눌러봐", "실제로 돼?" 요청이나, UI·CSS를 고친 뒤 typecheck·build만으로는 확인할 수 없는 것(여백·정렬·색·레이아웃·클릭 흐름)을 검증할 때 반드시 이 스킬을 사용하라. data/systems 순수 로직 검증은 이 스킬이 아니라 esbuild 헤드리스 실행으로 한다.
---

# 게임 실행·구동 (브라우저)

Vite + TypeScript 브라우저 게임이다. **typecheck와 build가 통과해도 화면이 의도대로 보인다는 보장은 없다.** CSS·레이아웃·클릭 흐름은 실제로 띄워서 눌러봐야 안다.

## 이 스킬을 쓰지 않아도 되는 경우

`data`/`systems`의 **순수 로직**은 브라우저가 필요 없다. esbuild로 번들해 node로 돌리는 게 훨씬 빠르다:

```bash
node_modules/.bin/esbuild <t>.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=<o>.mjs && node <o>.mjs
```

`localStorage`가 필요하면 `globalThis.localStorage`를 Map으로 폴리필하면 진짜 `loadGame()`도 호출된다.

브라우저는 **화면을 봐야 할 때만** 쓴다.

## 준비 (한 번만)

프로젝트에 playwright도 chromium-cli도 없다. **설치하지 마라** — `package.json`을 오염시킨다.
시스템에 깔린 크롬에 `puppeteer-core`로 붙인다(브라우저 다운로드 없음):

```bash
mkdir -p "$SCRATCH/driver" && cd "$SCRATCH/driver"
npm init -y >/dev/null && npm install puppeteer-core --silent
```

`$SCRATCH`는 세션 스크래치패드 경로다. 크롬 위치:
`C:/Program Files/Google/Chrome/Application/chrome.exe` (없으면 Edge: `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`)

## 실행

```bash
npm run dev      # 백그라운드로. http://localhost:5173/
```

그 다음 `driver.mjs`(이 디렉터리에 있다)를 스크래치패드에 복사해 쓴다. 화면 이름과 클릭 대상만 바꾸면 된다.

## ★ 이 게임을 몰면 반드시 걸리는 것들

이 4개를 모르면 드라이버가 조용히 헛돈다. 전부 실제로 겪은 것이다.

### 1. 로그인 화면이 모든 것을 가로막는다
첫 화면이 로그인이다(`loggedIn: false`). **저장본이 있으면 로그인을 건너뛴다** — 그래서 깨끗한 상태로 보려면 반드시:

```js
await page.goto(URL, { waitUntil: "networkidle2" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle2" });
```

그리고 로그인을 통과해야 게임 화면이 나온다: input 2개(계정명·아이디)에 타이핑 → `로그인` 버튼. 아이디는 **영문·숫자·밑줄만** 받는다(한글을 넣으면 거부당해 화면이 안 넘어간다).

### 2. `body.innerText`로 모달을 판별하지 마라
페이지 전체(사이드바·타임라인·광고·스테이터스)를 다 긁어와서 모달이 열렸는지 알 수 없다. **모달 안으로 스코프를 좁혀라:**

```js
await page.$eval(".modal", (el) => el.innerText);
```

### 3. "게시하기" 버튼은 두 개다
좌측 네비에 하나, 타임라인 컴포저에 하나. `find`로 잡으면 네비 것이 걸린다. 둘 다 작성 모달을 열지만, 특정 버튼을 노려야 하면 컨테이너로 좁혀라.

### 4. 초기 계정은 카테고리가 `일상` 하나뿐이다
`unlockedAttributes`가 `["daily"]`로 시작한다. 작성 모달 1단계에 칩이 하나만 뜬다 — 버그가 아니다. 성인 카테고리를 보려면 좌측 "성인물 보기" 토글을 켜야 한다(`state.adultMode`, 유저 전역).

## 화면까지 가는 경로

| 목적지 | 경로 |
|---|---|
| 게임 화면 | localStorage 비우기 → 로그인(계정명·아이디) → `로그인` |
| 트윗 작성 1단계 | `게시하기` → 모달 "어떤 글을 쓸까?" |
| 트윗 작성 2단계 | 1단계에서 `.modal .chip` 클릭 → `다음` |
| 내 프로필 | 좌측 하단 계정 pill — `document.querySelector(".nav-account").click()` |
| 성인 카테고리 | 좌측 "성인물 보기" 토글 — `document.querySelector(".nav-toggle .toggle__switch").click()` |

**좌측 네비는 라벨과 클릭 대상이 어긋난다. `clickByText`로 못 잡는다:**
- 계정 pill: `<button>`이지만 라벨이 "계정명+핸들+팔로워"라 정확 일치가 안 된다.
- 성인물 토글: 텍스트를 가진 건 `<span class="nav-toggle__text">`이고, **실제 버튼(`.toggle__switch`)은 텍스트가 비어 있다**(`aria-label`만 있음).

둘 다 셀렉터로 직접 잡아라. 토글이 켜지면 스위치 색이 바뀌고 `성인물 보기 ON` 토스트가 뜬다.

## 눈으로 봐라

**스크린샷을 찍었으면 반드시 Read로 열어서 봐라.** 빈 화면·깨진 레이아웃은 실행 로그가 아니라 그림에만 나온다. 텍스트 덤프가 그럴듯하다고 화면이 멀쩡한 게 아니다.

요소 하나만 확인할 땐 전체 화면보다 크롭이 판독하기 쉽다:

```js
const card = await page.$(".profile");
await card.screenshot({ path: `${OUT}/profile.png` });
```

CSS 수치를 확인해야 하면 브라우저에서 직접 읽는 게 확실하다:

```js
await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector(".compose-step"));
  return { paddingTop: cs.paddingTop, textAlign: cs.textAlign };
});
```

## 뒷정리

- **내가 띄운** dev 서버는 반드시 정지하라(백그라운드로 띄웠으면 TaskStop).
  이미 떠 있던 서버(사용자나 다른 세션이 띄운 것)는 **건드리지 마라.**
- 드라이버·스크린샷은 스크래치패드에만. **프로젝트에 남기지 마라.**

## 흔한 실수

| 증상 | 원인 |
|---|---|
| 로그인 화면이 안 뜸 | 저장본이 있다. `localStorage.clear()` 후 reload. |
| 로그인이 안 넘어감 | 아이디에 한글·공백. 영문·숫자·밑줄만 된다. |
| 모달이 안 열린 것 같음 | `body.innerText`로 봐서 그렇다. `.modal`로 좁혀라. |
| 클릭했는데 반응 없음 | `paint()`/렌더가 비동기. `setTimeout` 400~700ms 준다. |
| 페이지가 하얗다 | `page.on("pageerror")`를 붙여 콘솔 에러를 봐라. |
