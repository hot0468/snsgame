import type { GameContext } from "./context";
import { CREATURES } from "@/data/creatures";
import { RECIPES, ingredientById } from "@/data/grocery";
import { DOLLS } from "@/data/arcade";
import { DM_STORIES, chaptersFor } from "@/data/dmStory";
import { seenChapterCount, storyTriggerFor, type StoryTrigger } from "@/systems/dmStory";
import { el } from "@/utils/dom";

/**
 * 도감 화면 — 크리처·요리·인형을 탭 하나로 묶었다(업적 모달과 같은 ach-* 그릇).
 * 수집 판정은 전부 systems가 끝냈고(state.creatures / cookedDishes / dolls), 여기선 현황만 보여준다.
 * 미수집 항목은 이름·설명을 가리되 힌트(요리=재료 조합, 인형=등급)는 남긴다.
 */
export type DexTab = "creature" | "cooking" | "doll" | "dm";

/** 스토리 계정 목록(선언 순서대로, 핸들 중복 제거). 회차는 이 핸들로 묶인다. */
const STORY_HANDLES = [...new Set(DM_STORIES.map((s) => s.partnerHandle))];

/** 미해금 계정에 줄 힌트 — 어떤 행동이 그 계정의 DM을 여는지. */
const TRIGGER_HINT: Record<StoryTrigger, string> = {
  like: "트윗에 좋아요를 누르면 연락이 온다",
  retweet: "트윗을 리트윗하면 연락이 온다",
  follow: "팔로우하면 연락이 온다",
  engage: "반응을 여러 번 쌓으면 알아본다",
};

type DexRow = {
  got: boolean;
  emoji: string;
  name: string;
  desc: string;
  /** 인형 여분 재고처럼 이름 옆에 붙는 배지 */
  badge?: string;
};

const TABS: { id: DexTab; label: string; rows: (ctx: GameContext) => DexRow[] }[] = [
  {
    id: "creature",
    label: "🔍 크리처",
    rows: (ctx) => {
      const collected = new Set(ctx.store.getState().creatures);
      return CREATURES.map((c) => {
        const got = collected.has(c.id);
        return { got, emoji: got ? c.emoji : "❓", name: got ? c.name : "???", desc: got ? c.desc : "???" };
      });
    },
  },
  {
    id: "cooking",
    label: "🍳 요리",
    rows: (ctx) => {
      const cooked = new Set(ctx.store.getState().cookedDishes);
      return RECIPES.map((r) => {
        const got = cooked.has(r.id);
        const ings = r.ingredients
          .map((id) => {
            const ing = ingredientById(id);
            return ing ? `${ing.emoji} ${ing.name}` : id;
          })
          .join(" + ");
        // 미완성 요리도 재료 조합은 보여준다 — 그게 곧 레시피 힌트다.
        return { got, emoji: got ? r.emoji : "❓", name: got ? r.name : "???", desc: ings };
      });
    },
  },
  {
    id: "doll",
    label: "🧸 인형",
    rows: (ctx) => {
      const s = ctx.store.getState();
      const owned = new Set(s.dolls);
      return DOLLS.map((d) => {
        const got = owned.has(d.id);
        const stock = s.dollStock[d.id] ?? 0;
        const grade = d.rarity === "rare" ? "레어" : "일반";
        return {
          got,
          emoji: got ? d.emoji : "❓",
          name: got ? d.name : "???",
          desc: got ? d.desc : `${grade} 인형`,
          badge: stock > 0 ? `여분 ×${stock}` : undefined,
        };
      });
    },
  },
  {
    id: "dm",
    label: "💬 스토리 DM",
    rows: (ctx) => {
      const s = ctx.store.getState();
      return STORY_HANDLES.map((handle) => {
        const chapters = chaptersFor(handle);
        const seen = seenChapterCount(s, handle);
        const trigger = storyTriggerFor(handle);
        // 한 번도 안 만난 계정은 이름을 가리되 **여는 방법은 알려준다**. 힌트가 없으면
        // 하루 2칸짜리 고정 계정 노출에 전부 기대게 되어 이 콘텐츠가 사실상 안 보인다.
        return {
          got: seen === chapters.length,
          emoji: seen === 0 ? "❓" : seen === chapters.length ? "💌" : "✉️",
          name: seen === 0 ? "???" : chapters[0].partnerName,
          desc:
            seen === 0
              ? trigger
                ? TRIGGER_HINT[trigger]
                : "아직 만나지 못한 상대"
              : `@${handle}`,
          badge: `${seen}/${chapters.length}회차`,
        };
      });
    },
  },
];

export function renderDexModal(ctx: GameContext, initial: DexTab = "creature"): HTMLElement {
  const container = el("div", { class: "modal" });
  let active: DexTab = initial;

  function draw(): void {
    const tab = TABS.find((t) => t.id === active)!;
    const rows = tab.rows(ctx);
    const n = rows.filter((r) => r.got).length;
    const pct = rows.length > 0 ? Math.round((n / rows.length) * 100) : 0;

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, "📖 도감"),
        el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "div",
          { class: "feed__tabs life-tabs" },
          ...TABS.map((t) =>
            el(
              "div",
              {
                class: "feed__tab" + (t.id === active ? " feed__tab--active" : ""),
                onclick: () => {
                  active = t.id;
                  draw();
                },
              },
              el("span", { class: "feed__tab-label" }, t.label),
            ),
          ),
        ),
        el(
          "div",
          { class: "ach-progress" },
          el("span", { class: "ach-progress__count" }, `${n} / ${rows.length}`),
          el("div", { class: "bar" }, el("div", { class: "bar__fill", style: `width:${pct}%` })),
        ),
        el(
          "div",
          { class: "ach-list" },
          ...rows.map((r) =>
            el(
              "div",
              { class: "ach-row" + (r.got ? "" : " ach-row--locked") },
              el("span", { class: "ach-row__emoji" }, r.emoji),
              el(
                "div",
                { class: "ach-row__copy" },
                el(
                  "div",
                  { class: "ach-row__name" },
                  r.name,
                  r.badge ? el("span", { class: "inv-row__count" }, r.badge) : null,
                ),
                el("div", { class: "ach-row__desc" }, r.desc),
              ),
            ),
          ),
        ),
      ),
    );
  }

  draw();
  return container;
}
