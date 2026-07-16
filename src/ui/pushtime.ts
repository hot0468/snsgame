import type { GameContext } from "./context";
import type { PushWork } from "@/data/pushtime";
import { PUSH_VIEW_COST, PUSH_WORKS } from "@/data/pushtime";
import { viewPushWork } from "@/systems/pushtime";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/* ============================================================
 * 푸시타임 — 포스타입 스타일 성인 콘텐츠 피드.
 * DM 링크로 해금. 실제 이미지 없이 모자이크 자리·암시적 제목만.
 * ============================================================ */

function hashInt(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}
function coverStyle(hue: number): string {
  return `background:linear-gradient(150deg, hsl(${hue}deg 40% 34%), hsl(${(hue + 30) % 360}deg 38% 20%))`;
}

/* ── 마스트헤드/카테고리(장식) ── */
const CHIPS = ["추천", "구독", "최신", "랭킹", "이벤트"];

function masthead(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  return el(
    "header",
    { class: "pt__mast" },
    el("span", { class: "pt__logo" }, "푸시타임"),
    el(
      "div",
      { class: "pt__search" },
      icon("search", { size: 15 }),
      el("span", { class: "pt__search-ph" }, "작품·태그 검색"),
    ),
    el(
      "div",
      { class: "pt__mast-right" },
      el("span", { class: "pt__cash" }, `${formatNumber(s.money)}원`),
      el("span", { class: "pt__login" }, "내 서재"),
    ),
  );
}

function chips(): HTMLElement {
  return el(
    "div",
    { class: "pt__chips" },
    ...CHIPS.map((c, i) => el("span", { class: "pt__chip" + (i === 0 ? " pt__chip--on" : "") }, c)),
  );
}

/* ── 포스트 카드 ── */
function postCard(ctx: GameContext, w: PushWork): HTMLElement {
  const h = hashInt(w.id);
  const likes = 120 + (h % 4200);
  const comments = 3 + (h % 180);
  return el(
    "article",
    { class: "pt-card", onclick: () => openViewModal(ctx, w) },
    el(
      "div",
      { class: "pt-card__cover", style: coverStyle(w.hue) },
      el("span", { class: "pt-card__adult" }, "🔞 성인"),
      el(
        "div",
        { class: "pt-card__lock" },
        el("span", { class: "pt-card__lock-ic" }, "🔒"),
        el("span", {}, "성인 인증 필요"),
      ),
    ),
    el(
      "div",
      { class: "pt-card__body" },
      el("div", { class: "pt-card__title" }, w.title),
      el(
        "div",
        { class: "pt-card__creator" },
        el("span", { class: "pt-card__avatar", style: coverStyle(w.hue) }),
        `@${w.circle}`,
      ),
      el("div", { class: "pt-card__excerpt" }, w.excerpt),
      el(
        "div",
        { class: "pt-card__tags" },
        ...w.tags.map((t) => el("span", { class: "pt-card__tag" }, `#${t}`)),
      ),
      el(
        "div",
        { class: "pt-card__meta" },
        el("span", {}, `♥ ${formatNumber(likes)}`),
        el("span", {}, `💬 ${formatNumber(comments)}`),
        el("span", { class: "pt-card__price" }, `${formatNumber(PUSH_VIEW_COST)}원`),
      ),
    ),
  );
}

/* ── 감상(결제) 팝업 ── */
function openViewModal(ctx: GameContext, work: PushWork): void {
  const affordable = ctx.store.getState().money >= PUSH_VIEW_COST;
  ctx.openModal((c) =>
    el(
      "div",
      { class: "modal" },
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, "🔞 푸시타임"),
        el("button", { class: "popup__close", onclick: () => c.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el("p", { style: "font-size:15px;font-weight:800;margin:0 0 4px" }, `『${work.title}』`),
        el(
          "p",
          { style: "font-size:12.5px;color:var(--text-muted);margin:0 0 6px" },
          `@${work.circle} · ${work.tags.map((t) => "#" + t).join(" ")}`,
        ),
        el(
          "p",
          { style: "font-size:13.5px;line-height:1.6;margin:0 0 14px" },
          "이 포스트는 유료 성인 콘텐츠입니다. 결제하고 열람하시겠어요?",
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el("button", { class: "btn btn--ghost", onclick: () => c.closeModal() }, "닫기"),
          el(
            "button",
            {
              class: "btn" + (affordable ? "" : " btn--ghost"),
              disabled: !affordable,
              onclick: () => {
                if (!affordable) {
                  c.toast(`잔고가 부족해요 (필요 ${formatNumber(PUSH_VIEW_COST)}원)`);
                  return;
                }
                let msg = "";
                c.update((s) => {
                  msg = viewPushWork(s, work)?.message ?? "";
                });
                c.closeModal();
                if (msg) c.toast(msg);
              },
            },
            `결제하고 열람 (${formatNumber(PUSH_VIEW_COST)}원)`,
          ),
        ),
      ),
    ),
  );
}

export function renderPushtime(ctx: GameContext): HTMLElement {
  return el(
    "div",
    { class: "pt" },
    masthead(ctx),
    el(
      "div",
      { class: "pt__body" },
      chips(),
      el(
        "p",
        { class: "compose-hint", style: "margin:0 4px 12px" },
        "19세 미만 이용 불가. 포스트를 결제하면 열람할 수 있어요. (음란·정신력↑, 도덕성↓)",
      ),
      el("div", { class: "pt__feed" }, ...PUSH_WORKS.map((w) => postCard(ctx, w))),
    ),
  );
}
