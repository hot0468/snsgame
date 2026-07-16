import type { GameContext } from "./context";
import type { DstoryPost } from "@/data/dstory";
import { DSTORY_POSTS } from "@/data/dstory";
import { DSTORY_IT_GAIN, findDstoryPost, tryUnlockDstoryPost } from "@/systems/dstory";
import { el } from "@/utils/dom";

/* ============================================================
 * 'd스토리'(dstory.tistory.com) — 개인 기술 블로그(티스토리 패러디) 오버레이.
 * 목록 → 글 클릭 → (잠김이면) 비밀번호 화면 → 풀면 본문.
 *
 * ⚠️ 해금 판정·IT 보상은 전부 systems/dstory가 한다. 여기서 비밀번호를 비교하거나
 *    스탯을 더하지 마라 — tryUnlockDstoryPost의 반환값(boolean)만 보고 문구를 고른다.
 *
 * ⚠️ 이 화면은 **탭이 아니라 오버레이**다(browser.ts의 dstorySiteOpen). 정답을 찾으러
 *    개발자 도구·명령 프롬프트를 여는 동안에도 닫히면 안 된다 — 둘 다 모달이라
 *    activeTab을 안 건드려 자연히 성립한다. **모달을 여는 경로에 오버레이를 닫는
 *    코드를 넣지 마라. 그게 퍼즐의 전제다.**
 * ============================================================ */

/** 장식용 블로그 메뉴(클릭 불가) */
const GNB = ["홈", "태그", "방명록", "관리"];

/**
 * 잠김 화면에 입력 중이던 비밀번호.
 *
 * ⚠️ 모듈 스코프인 이유: 오답 토스트(ctx.toast)가 전체 재렌더를 돌려 input 노드를
 *    새로 만든다 — 로컬 변수로는 입력값이 매번 날아간다("실패 시 입력값 유지"가 설계다).
 *    글을 옮기거나 풀면 비운다.
 */
let pendingPw = "";

function goList(ctx: GameContext): void {
  ctx.ui.dstoryPostId = null;
  pendingPw = "";
  ctx.refresh();
}

function openPost(ctx: GameContext, id: string): void {
  ctx.ui.dstoryPostId = id;
  pendingPw = "";
  ctx.refresh();
}

function header(): HTMLElement {
  return el(
    "header",
    { class: "ds__head" },
    el("div", { class: "ds__brand" }, "d스토리"),
    el("div", { class: "ds__tagline" }, "웹 개발 공부 기록 · 삽질과 정리"),
    el(
      "nav",
      { class: "ds__gnb" },
      ...GNB.map((m, i) => el("span", { class: "ds__gnb-item" + (i === 0 ? " ds__gnb-item--on" : "") }, m)),
    ),
  );
}

/* ===================== 목록 ===================== */

function listRow(ctx: GameContext, post: DstoryPost, unlocked: boolean): HTMLElement {
  return el(
    "li",
    { class: "ds-item", onclick: () => openPost(ctx, post.id) },
    el(
      "div",
      { class: "ds-item__title" },
      // 잠긴 글에만 자물쇠 — 푼 글은 평범한 제목으로 보인다.
      !unlocked ? el("span", { class: "ds-item__lock" }, "🔒") : null,
      post.title,
    ),
    el("div", { class: "ds-item__date" }, post.date),
  );
}

function listPage(ctx: GameContext): HTMLElement {
  const unlockedIds = ctx.store.getState().dstoryUnlockedPosts;
  return el(
    "div",
    { class: "ds__body" },
    el("div", { class: "ds__cat" }, "분류 전체보기", el("span", { class: "ds__cat-num" }, `(${DSTORY_POSTS.length})`)),
    el(
      "ul",
      { class: "ds-list" },
      ...DSTORY_POSTS.map((p) => listRow(ctx, p, unlockedIds.includes(p.id))),
    ),
  );
}

/* ===================== 잠김 화면 ===================== */

function lockedPage(ctx: GameContext, post: DstoryPost): HTMLElement {
  const input = el("input", {
    class: "ds-lock__input",
    type: "password",
    placeholder: "비밀번호",
    value: pendingPw,
    autocomplete: "off",
    // 재렌더에도 살아남게 모듈 변수에 받아 둔다(위 pendingPw 주석 참조).
    oninput: (e: Event) => {
      pendingPw = (e.target as HTMLInputElement).value;
    },
  }) as HTMLInputElement;

  const submit = (): void => {
    let ok = false;
    ctx.update((s) => {
      ok = tryUnlockDstoryPost(s, post.id, input.value);
    });
    if (ok) {
      // 상태가 바뀌었으므로 store 구독이 알아서 본문으로 다시 그린다.
      pendingPw = "";
      ctx.toast(`IT +${DSTORY_IT_GAIN}`);
    } else {
      ctx.toast("비밀번호가 맞지 않습니다");
    }
  };

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") submit();
  });

  return el(
    "div",
    { class: "ds__body" },
    el(
      "div",
      { class: "ds-lock" },
      el("div", { class: "ds-lock__icon" }, "🔒"),
      el("div", { class: "ds-lock__title" }, "보호되어 있는 글입니다"),
      el("div", { class: "ds-lock__desc" }, "이 글을 보려면 비밀번호를 입력하세요."),
      el(
        "div",
        { class: "ds-lock__row" },
        input,
        el("button", { class: "ds-lock__btn", onclick: submit }, "확인"),
      ),
      el("div", { class: "ds-lock__hint" }, "비밀번호 힌트: ", el("b", {}, post.hint)),
    ),
    el(
      "div",
      { class: "ds__foot" },
      el("button", { class: "ds__list-btn", onclick: () => goList(ctx) }, "목록"),
    ),
  );
}

/* ===================== 본문 ===================== */

function postPage(ctx: GameContext, post: DstoryPost): HTMLElement {
  return el(
    "div",
    { class: "ds__body" },
    el(
      "article",
      { class: "ds-post" },
      el("h1", { class: "ds-post__title" }, post.title),
      el("div", { class: "ds-post__date" }, post.date),
      // 문단 배열을 그대로 <p>로 — html 주입 없이 요소로 조립한다.
      ...post.body.map((p) => el("p", { class: "ds-post__p" }, p)),
    ),
    el(
      "div",
      { class: "ds__foot" },
      el("button", { class: "ds__list-btn", onclick: () => goList(ctx) }, "목록"),
    ),
  );
}

/* ===================== 진입점 ===================== */

export function renderDstory(ctx: GameContext): HTMLElement {
  const state = ctx.store.getState();
  // 데이터에서 사라진 글 id가 남아 있을 수 있다 → 목록으로 되돌린다(dartpin과 같은 패턴).
  const selected = ctx.ui.dstoryPostId ? findDstoryPost(ctx.ui.dstoryPostId) : undefined;
  if (ctx.ui.dstoryPostId && !selected) ctx.ui.dstoryPostId = null;

  const unlocked = selected ? state.dstoryUnlockedPosts.includes(selected.id) : false;

  return el(
    "div",
    { class: "ds" },
    header(),
    !selected ? listPage(ctx) : unlocked ? postPage(ctx, selected) : lockedPage(ctx, selected),
  );
}
