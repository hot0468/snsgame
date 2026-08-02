import type { GameContext } from "./context";
import type { PushWork } from "@/data/pushtime";
import { PUSH_VIEW_COST, PUSH_WORKS } from "@/data/pushtime";
import { viewPushWork, visiblePushWorks } from "@/systems/pushtime";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/* ============================================================
 * 푸시타임 — 포스타임(포스타입 룩) 성인 콘텐츠 피드.
 * DM 링크로 해금. 실제 이미지 없이 모자이크 자리·암시적 제목만.
 * 3열: 좌 사이드바(장식) / 중앙 포스트 엔트리 피드 / 우 사이드바(장식).
 * 기능은 감상 결제(viewPushWork)뿐 — 나머지 nav·아이콘·구독 버튼은 전부 장식.
 * ============================================================ */

function hashInt(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}
function coverStyle(hue: number): string {
  return `background:linear-gradient(150deg, hsl(${hue}deg 40% 34%), hsl(${(hue + 30) % 360}deg 38% 20%))`;
}
/** 장식용 날짜(결정론) — 실제 게임 날짜 아님 */
function fauxDate(seed: string): string {
  const h = hashInt(seed);
  return `2026.${1 + (h % 12)}.${1 + (h % 27)}`;
}

/* ── 상단 바 ── */
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
      el("span", { class: "pt__search-ph" }, "검색어를 입력하세요"),
    ),
    el(
      "div",
      { class: "pt__mast-right" },
      el("button", { class: "pt__make" }, "+ 만들기"),
      el("span", { class: "pt__mast-ic", title: "선물" }, "🎁"),
      el(
        "span",
        { class: "pt__mast-ic pt__mast-ic--badge", title: "알림" },
        "🔔",
        el("span", { class: "pt__badge" }, "3"),
      ),
      el("span", { class: "pt__mast-ic", title: "메일" }, "✉"),
      el("span", { class: "pt__cash" }, `${formatNumber(s.money)}원`),
      el("span", { class: "pt__avatar", style: coverStyle(300) }),
    ),
  );
}

/* ── 좌측 사이드바(장식) ── */
const LEFT_NAV: [string, string][] = [
  ["🏠", "홈"],
  ["📡", "오픈 채널"],
  ["✍", "리퀘스트"],
  ["💬", "캐릭터톡"],
  ["🔖", "보관함"],
];

function leftbar(): HTMLElement {
  return el(
    "aside",
    { class: "pt__side pt__side--left" },
    el(
      "nav",
      { class: "pt__nav" },
      ...LEFT_NAV.map(([ic, label], i) =>
        el(
          "span",
          { class: "pt__nav-item" + (i === 0 ? " pt__nav-item--on" : "") },
          el("span", { class: "pt__nav-ic" }, ic),
          label,
        ),
      ),
    ),
    el(
      "div",
      { class: "pt__promo" },
      el("div", { class: "pt__promo-title" }, "프리미엄 가입하고"),
      el("div", { class: "pt__promo-title" }, "푸시타임을 더 완벽하게"),
      el("button", { class: "pt__promo-btn" }, "프리미엄 가입"),
    ),
    el(
      "div",
      { class: "pt__side-sec" },
      el("div", { class: "pt__side-h" }, "내 채널"),
      el("span", { class: "pt__side-row pt__side-row--add" }, "+ 채널 만들기"),
      el(
        "span",
        { class: "pt__side-row" },
        el("span", { class: "pt__side-thumb", style: coverStyle(330) }),
        "나의 밤 기록",
      ),
    ),
    el(
      "div",
      { class: "pt__side-sec" },
      el("div", { class: "pt__side-h" }, "구독·참여"),
      ...PUSH_WORKS.slice(0, 4).map((w) =>
        el(
          "span",
          { class: "pt__side-row" },
          el("span", { class: "pt__side-thumb", style: coverStyle(w.hue) }),
          w.circle,
        ),
      ),
    ),
  );
}

/* ── 포스트 엔트리(중앙 피드) ── */
function postEntry(ctx: GameContext, w: PushWork): HTMLElement {
  const category = w.tags[0] ?? "성인";
  return el(
    "article",
    { class: "pt-post" },
    el(
      "div",
      { class: "pt-post__head" },
      el("span", { class: "pt-post__avatar", style: coverStyle(w.hue) }),
      el(
        "div",
        { class: "pt-post__by" },
        el("span", { class: "pt-post__author" }, w.circle),
        el("span", { class: "pt-post__sub" }, `${fauxDate(w.id)} · ${category}`),
      ),
      el("button", { class: "pt-post__sub-btn" }, "구독"),
      el("span", { class: "pt-post__more" }, "⋯"),
    ),
    el("h3", { class: "pt-post__title" }, w.title),
    el("div", { class: "pt-post__tagline" }, w.tags.map((t) => "#" + t).join(" ")),
    el("p", { class: "pt-post__excerpt" }, w.excerpt),
    el(
      "div",
      { class: "pt-post__tags" },
      el("span", { class: "pt-post__tag" }, "#성인"),
      ...w.tags.map((t) => el("span", { class: "pt-post__tag" }, `#${t}`)),
    ),
    el(
      "div",
      { class: "pt-post__cover", style: coverStyle(w.hue), onclick: () => openViewModal(ctx, w) },
      el("span", { class: "pt-post__adult" }, "🔞 성인"),
      el(
        "div",
        { class: "pt-post__lock" },
        el("span", { class: "pt-post__lock-ic" }, "🔒"),
        el("span", {}, `열람 ${formatNumber(PUSH_VIEW_COST)}원`),
      ),
    ),
  );
}

function feed(ctx: GameContext): HTMLElement {
  return el(
    "main",
    { class: "pt__main" },
    el(
      "div",
      { class: "pt__tabs" },
      el("span", { class: "pt__tab pt__tab--on" }, "발견"),
      el("span", { class: "pt__tab" }, "구독·참여"),
    ),
    el(
      "p",
      { class: "pt__notice" },
      "19세 미만 이용 불가. 포스트를 결제하면 열람할 수 있어요. (음란·정신력↑, 도덕성↓)",
    ),
    // 취향 계열(minPervert)은 변태력이 열려야 목록에 뜬다(야밤과 같은 규칙).
    ...visiblePushWorks(ctx.store.getState()).map((w) => postEntry(ctx, w)),
  );
}

/* ── 우측 사이드바(장식) ── */
function miniPost(w: PushWork): HTMLElement {
  return el(
    "span",
    { class: "pt__mini" },
    el("span", { class: "pt__mini-thumb", style: coverStyle(w.hue) }),
    el(
      "span",
      { class: "pt__mini-body" },
      el("span", { class: "pt__mini-title" }, w.title),
      el("span", { class: "pt__mini-sub" }, `${w.circle} · ${fauxDate(w.id)}`),
    ),
  );
}

function rightbar(): HTMLElement {
  return el(
    "aside",
    { class: "pt__side pt__side--right" },
    el(
      "div",
      { class: "pt__side-sec" },
      el("div", { class: "pt__side-h" }, "최근 스크랩한 포스트"),
      ...PUSH_WORKS.slice(0, 3).map(miniPost),
    ),
    el(
      "div",
      { class: "pt__side-sec" },
      el("div", { class: "pt__side-h" }, "최근 본 포스트"),
      ...PUSH_WORKS.slice(3, 6).map(miniPost),
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
    el("div", { class: "pt__cols" }, leftbar(), feed(ctx), rightbar()),
  );
}
