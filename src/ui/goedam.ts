import type { GameContext } from "./context";
import type { GoedamStory } from "@/data/goedam";
import { GOEDAM_SITE, GOEDAM_STORIES } from "@/data/goedam";
import { el, formatNumber } from "@/utils/dom";

/* ============================================================
 * 'goedam.kr' — 괴담 아카이브 사이트(오버레이).
 * hosts에 goedam.kr 매핑을 넣고 주소창에 입력해야 진입한다(browser.ts goedamSiteOpen).
 * 목록 → 글 클릭 → 본문. 순수 읽을거리(스탯 효과 없음).
 * ⚠️ 해금·진입 판정은 systems/hosts가 한다. 여기선 화면만 그린다.
 * ============================================================ */

function findStory(id: string | null): GoedamStory | undefined {
  return id ? GOEDAM_STORIES.find((s) => s.id === id) : undefined;
}

function header(): HTMLElement {
  return el(
    "header",
    { class: "gd__head" },
    el("div", { class: "gd__brand" }, GOEDAM_SITE.name),
    el("div", { class: "gd__tagline" }, GOEDAM_SITE.tagline),
  );
}

function listRow(ctx: GameContext, story: GoedamStory): HTMLElement {
  return el(
    "li",
    {
      class: "gd-item",
      onclick: () => {
        ctx.ui.goedamStoryId = story.id;
        ctx.refresh();
      },
    },
    el("div", { class: "gd-item__title" }, el("span", { class: "gd-item__ghost" }, "👁"), story.title),
    el("div", { class: "gd-item__teaser" }, story.teaser),
    el("div", { class: "gd-item__meta" }, `조회 ${formatNumber(story.views)}`),
  );
}

function listPage(ctx: GameContext): HTMLElement {
  return el(
    "div",
    { class: "gd__body" },
    el("div", { class: "gd__cat" }, "밤에만 열리는 이야기", el("span", { class: "gd__cat-num" }, `(${GOEDAM_STORIES.length})`)),
    el("ul", { class: "gd-list" }, ...GOEDAM_STORIES.map((s) => listRow(ctx, s))),
  );
}

function storyPage(ctx: GameContext, story: GoedamStory): HTMLElement {
  return el(
    "div",
    { class: "gd__body" },
    el(
      "article",
      { class: "gd-post" },
      el("h1", { class: "gd-post__title" }, story.title),
      el("div", { class: "gd-post__meta" }, `조회 ${formatNumber(story.views)}`),
      ...story.body.map((p) => el("p", { class: "gd-post__p" }, p)),
    ),
    el(
      "div",
      { class: "gd__foot" },
      el(
        "button",
        {
          class: "gd__list-btn",
          onclick: () => {
            ctx.ui.goedamStoryId = null;
            ctx.refresh();
          },
        },
        "목록",
      ),
    ),
  );
}

export function renderGoedam(ctx: GameContext): HTMLElement {
  const selected = findStory(ctx.ui.goedamStoryId);
  // 데이터에서 사라진 id는 목록으로 되돌린다(dstory와 같은 방어).
  if (ctx.ui.goedamStoryId && !selected) ctx.ui.goedamStoryId = null;

  return el(
    "div",
    { class: "gd" },
    header(),
    selected ? storyPage(ctx, selected) : listPage(ctx),
  );
}
