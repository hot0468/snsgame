import type { GameContext } from "./context";
import type { DartpinPost } from "@/data/dartpin";
import { ensureDartpinBoard, findDartpinPost, getDartpinBoard } from "@/systems/dartpin";
import { dateLabel } from "@/systems/time";
import { el, formatNumber } from "@/utils/dom";

/* ============================================================
 * 다트 핀(dartpin.com) — 익명 게시판(네이트 판 패러디).
 * 목록(제목·작성자·조회·추천) → 글 클릭 → 상세(본문·댓글) → 목록 복귀.
 * 촌스러운 2000년대 게시판 톤(테이블 목록·파란 링크 제목·빨간 브랜드).
 *
 * ⚠️ 게시판 편성(무슨 글이 며칠에 뜨는지)·힌트 확률은 전부 systems/dartpin이 정한다.
 *    여기서는 ensureDartpinBoard로 오늘자 편성을 보장하고 getDartpinBoard 결과를 그릴 뿐이다.
 *
 * ⚠️ **힌트 글(post.hint)을 시각적으로 구분하지 마라.** 아이콘·강조색·정렬 우선 전부 금지다.
 *    hint는 스폰 산정용 플래그지 표시용이 아니다 — 목록에서 일반 글과 똑같이 보여야
 *    드물게 발견하는 맛이 산다. (data/dartpin.ts의 주석과 같은 약속)
 * ============================================================ */

/** 상단 장식용 메뉴(클릭 불가) */
const GNB = ["뉴스", "판", "톡톡", "쇼핑", "만화", "TV연예"];
/** 게시판 장식용 탭 — 실제 목록은 항상 오늘자 '판'이다 */
const BOARD_TABS = ["톡커들의 선택", "오늘의 판", "이슈", "연예", "직장"];

/** 글 id로 안정적인 등록 시각 플레이버("14:07")를 만든다(표시용). */
function postTime(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const hh = String(h % 24).padStart(2, "0");
  const mm = String((h >> 5) % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function masthead(): HTMLElement {
  return el(
    "header",
    { class: "dp__mast" },
    el(
      "div",
      { class: "dp__mast-top" },
      el("span", { class: "dp__logo" }, "다트"),
      el("span", { class: "dp__logo-sub" }, "핀"),
      el("span", { class: "dp__mast-slogan" }, "익명으로 털어놓는 그곳"),
      el("span", { class: "dp__mast-login" }, "로그인"),
    ),
    el("nav", { class: "dp__gnb" }, ...GNB.map((m, i) =>
      el("span", { class: "dp__gnb-item" + (i === 1 ? " dp__gnb-item--on" : "") }, m),
    )),
  );
}

/* ===================== 목록 ===================== */

function openPost(ctx: GameContext, id: string): void {
  ctx.ui.dartpinPostId = id;
  ctx.refresh();
}

/**
 * 목록 한 줄.
 * ⚠️ post.hint 여부로 클래스·아이콘·순서를 바꾸지 않는다(위 파일 주석 참조).
 */
function boardRow(ctx: GameContext, post: DartpinPost, no: number): HTMLElement {
  const commentCount = post.comments.length;
  return el(
    "tr",
    { class: "dp-row", onclick: () => openPost(ctx, post.id) },
    el("td", { class: "dp-row__no" }, String(no)),
    el(
      "td",
      { class: "dp-row__title" },
      el("span", { class: "dp-row__link" }, post.title),
      commentCount > 0 ? el("span", { class: "dp-row__cnt" }, `[${commentCount}]`) : null,
    ),
    el("td", { class: "dp-row__author" }, post.author),
    el("td", { class: "dp-row__num" }, formatNumber(post.views)),
    el("td", { class: "dp-row__num" }, formatNumber(post.likes)),
  );
}

function boardPage(ctx: GameContext): HTMLElement {
  const state = ctx.store.getState();
  const posts = getDartpinBoard(state);

  const rows = posts.length
    ? posts.map((p, i) => boardRow(ctx, p, posts.length - i))
    : [
        el(
          "tr",
          {},
          el(
            "td",
            { class: "dp-empty", colspan: "5" },
            "오늘은 등록된 글이 없습니다.",
          ),
        ),
      ];

  return el(
    "div",
    { class: "dp__body" },
    el("div", { class: "dp__tabs" }, ...BOARD_TABS.map((t, i) =>
      el("span", { class: "dp__tab" + (i === 0 ? " dp__tab--on" : "") }, t),
    )),
    el(
      "div",
      { class: "dp__board-head" },
      el("span", { class: "dp__board-title" }, "톡커들의 선택"),
      el("span", { class: "dp__board-date" }, dateLabel(state.day)),
    ),
    el(
      "table",
      { class: "dp-table" },
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          el("th", { class: "dp-th dp-th--no" }, "번호"),
          el("th", { class: "dp-th" }, "제목"),
          el("th", { class: "dp-th dp-th--author" }, "작성자"),
          el("th", { class: "dp-th dp-th--num" }, "조회"),
          el("th", { class: "dp-th dp-th--num" }, "추천"),
        ),
      ),
      el("tbody", {}, ...rows),
    ),
    // 페이지네이션·글쓰기는 장식(클릭 불가)
    el(
      "div",
      { class: "dp__foot" },
      el(
        "div",
        { class: "dp__pager" },
        el("span", { class: "dp__page dp__page--on" }, "1"),
        ...["2", "3", "4", "5", "다음 >"].map((p) => el("span", { class: "dp__page" }, p)),
      ),
      el("span", { class: "dp__write" }, "글쓰기"),
    ),
  );
}

/* ===================== 상세 ===================== */

function goList(ctx: GameContext): void {
  ctx.ui.dartpinPostId = null;
  ctx.refresh();
}

function commentRow(c: { author: string; text: string }, i: number): HTMLElement {
  return el(
    "div",
    { class: "dp-cmt" },
    el(
      "div",
      { class: "dp-cmt__head" },
      el("span", { class: "dp-cmt__author" }, c.author),
      el("span", { class: "dp-cmt__meta" }, postTime(`${c.author}${i}${c.text.length}`)),
    ),
    el("p", { class: "dp-cmt__text" }, c.text),
  );
}

function postPage(ctx: GameContext, post: DartpinPost): HTMLElement {
  const state = ctx.store.getState();
  return el(
    "div",
    { class: "dp__body" },
    el(
      "article",
      { class: "dp-post" },
      el("h1", { class: "dp-post__title" }, post.title),
      el(
        "div",
        { class: "dp-post__meta" },
        el("span", { class: "dp-post__author" }, post.author),
        el("span", {}, `${dateLabel(state.day)} ${postTime(post.id)}`),
        el("span", {}, `조회 ${formatNumber(post.views)}`),
        el("span", {}, `추천 ${formatNumber(post.likes)}`),
      ),
      // 본문의 줄바꿈은 CSS(white-space: pre-wrap)로 살린다(html 주입 금지).
      el("div", { class: "dp-post__body" }, post.body),
      // 추천/비추천은 장식 — 게임 규칙에 영향이 없다.
      el(
        "div",
        { class: "dp-post__vote" },
        el(
          "span",
          { class: "dp-vote" },
          el("span", { class: "dp-vote__label" }, "추천"),
          el("span", { class: "dp-vote__num" }, formatNumber(post.likes)),
        ),
        el(
          "span",
          { class: "dp-vote dp-vote--down" },
          el("span", { class: "dp-vote__label" }, "비추천"),
          el("span", { class: "dp-vote__num" }, formatNumber(Math.floor(post.likes / 9))),
        ),
      ),
    ),
    el(
      "section",
      { class: "dp-cmts" },
      el(
        "div",
        { class: "dp-cmts__head" },
        "댓글 ",
        el("span", { class: "dp-cmts__count" }, String(post.comments.length)),
      ),
      ...(post.comments.length
        ? post.comments.map((c, i) => commentRow(c, i))
        : [el("div", { class: "dp-empty" }, "아직 댓글이 없습니다.")]),
    ),
    el(
      "div",
      { class: "dp__foot" },
      el("button", { class: "dp__list-btn", onclick: () => goList(ctx) }, "목록"),
    ),
  );
}

/* ===================== 진입점 ===================== */

export function renderDartpin(ctx: GameContext): HTMLElement {
  const state = ctx.store.getState();
  // 오늘자 게시판 편성 보장. 이미 오늘 것이면 update를 호출하지 않는다 —
  // 조건 없이 dispatch하면 재렌더 → dispatch 무한 루프가 된다(ensureAdTweetsSeeded와 같은 패턴).
  if (!state.dartpinBoard || state.dartpinBoard.day !== state.day) {
    ctx.update((s) => ensureDartpinBoard(s));
  }

  // 어제 열어둔 글 id가 오늘 편성에 없거나 데이터에서 사라졌을 수 있다 → 목록으로 되돌린다.
  const selected = ctx.ui.dartpinPostId ? findDartpinPost(ctx.ui.dartpinPostId) : undefined;
  if (ctx.ui.dartpinPostId && !selected) ctx.ui.dartpinPostId = null;

  return el(
    "div",
    { class: "dp" },
    masthead(),
    selected ? postPage(ctx, selected) : boardPage(ctx),
  );
}
