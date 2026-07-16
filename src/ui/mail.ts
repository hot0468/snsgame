import type { GameContext } from "./context";
import type { AdOffer, Email } from "@/core/types";
import type { ShopItem } from "@/data/shop";
import { SKILL_STATS } from "@/data/stats";
import { adOfferItem, adOfferPrice, adOfferStatus, buyFromAdOffer } from "@/systems/adMail";
import { acceptJobOffer, declineJobOffer } from "@/systems/employment";
import { openSpamEmail } from "@/systems/spam";
import { dateLabel } from "@/systems/time";
import { el, formatNumber, mount } from "@/utils/dom";
import { confirmPurchase } from "./confirmModal";
import { icon } from "./icons";

/* ============================================================
 * 피메일 — 메일함(지메일 톤 리디자인).
 * 3영역 구조: 좌측 사이드바 / 상단 검색바 / 메일(리스트·본문).
 * 취업 지원 결과(합격/불합격)가 익일에 도착하고, 합격 메일에는
 * '출근한다 / 안 한다' 버튼이 있다. 스팸 메일은 열람 시 해킹 로직.
 *
 * 필터/별표/선택 상태는 저장 대상이 아닌 세션 휘발 상태이므로
 * module-level 변수로 관리한다(persist 불필요).
 * ============================================================ */

type MailView = "inbox" | "starred" | "spam" | "sent";
type MailTab = "primary" | "promotions" | "social" | "updates";

let activeView: MailView = "inbox";
let activeTab: MailTab = "primary";
let searchQuery = "";
const starredIds = new Set<string>();
const checkedIds = new Set<string>();

/** 게임 메일 → 카테고리 탭 분류. spam·adOffer→프로모션, jobOffer→업데이트, 그 외→기본. */
function categoryOf(mail: Email): MailTab {
  if (mail.spam) return "promotions";
  if (mail.adOffer) return "promotions";
  if (mail.jobOffer) return "updates";
  return "primary";
}

/** 오퍼 상품의 스탯 상승 문구. 스탯 상승이 없는 상품이면 null. */
function boostText(item: ShopItem): string | null {
  if (!item.skill || !item.boost) return null;
  return `${SKILL_STATS[item.skill].label} +${item.boost}`;
}

/** 할인율(0~1) → "50%" 표시용 */
function ratePct(offer: AdOffer): string {
  return `${Math.round(offer.rate * 100)}%`;
}

/** 본문 한 줄 미리보기 */
function previewOf(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 70 ? flat.slice(0, 70) + "…" : flat;
}

/** 현재 뷰/탭/검색어에 맞는 메일 목록을 계산한다. */
function visibleEmails(emails: readonly Email[]): Email[] {
  let list = emails.slice();
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter((m) => (m.from + " " + m.subject).toLowerCase().includes(q));
  }
  if (activeView === "starred") return list.filter((m) => starredIds.has(m.id));
  if (activeView === "spam") return list.filter((m) => m.spam);
  if (activeView === "sent") return [];
  // inbox → 카테고리 탭으로 한 번 더 거른다.
  return list.filter((m) => categoryOf(m) === activeTab);
}

function markRead(ctx: GameContext, id: string): void {
  ctx.update((s) => {
    const m = s.emails.find((e) => e.id === id);
    if (m) m.read = true;
  });
}

function emailRow(ctx: GameContext, mail: Email): HTMLElement {
  const selected = ctx.ui.mailSelectedId === mail.id;
  const isStarred = starredIds.has(mail.id);
  const isChecked = checkedIds.has(mail.id);

  const check = el(
    "span",
    {
      class: "mail-row__check" + (isChecked ? " mail-row__check--on" : ""),
      title: "선택",
      onclick: (e: Event) => {
        e.stopPropagation();
        if (checkedIds.has(mail.id)) checkedIds.delete(mail.id);
        else checkedIds.add(mail.id);
        ctx.refresh();
      },
    },
    isChecked ? "✓" : "",
  );

  const star = el(
    "span",
    {
      class: "mail-star" + (isStarred ? " mail-star--on" : ""),
      title: isStarred ? "별표 해제" : "별표",
      onclick: (e: Event) => {
        e.stopPropagation();
        if (starredIds.has(mail.id)) starredIds.delete(mail.id);
        else starredIds.add(mail.id);
        ctx.refresh();
      },
    },
    icon("star", { size: 15 }),
  );

  return el(
    "div",
    {
      class:
        "mail-row" +
        (selected ? " mail-row--on" : "") +
        (isChecked ? " mail-row--checked" : "") +
        (mail.read ? "" : " mail-row--unread"),
      role: "button",
      onclick: () => {
        const wasUnread = !mail.read;
        markRead(ctx, mail.id);
        ctx.ui.mailSelectedId = mail.id;
        // 스팸 메일을 처음 클릭(열람)하면 낮은 확률로 계정 해킹
        if (mail.spam && wasUnread) {
          let hacked = false;
          let loss = 0;
          ctx.update((s) => {
            const r = openSpamEmail(s, mail.id);
            hacked = r.hacked;
            loss = r.followerLoss;
          });
          if (hacked) {
            ctx.toast(`⚠️ 스팸 링크에 당했다! 계정이 해킹돼 팔로워 -${loss}`);
          }
        }
        ctx.refresh();
      },
    },
    check,
    star,
    el(
      "span",
      { class: "mail-row__from" },
      mail.spam ? el("span", { class: "mail-spam-tag" }, "스팸") : null,
      // 스팸(붉은 경고)과 달리 특가 태그는 초록 '혜택' 톤 — 열어볼 메일임을 알린다.
      mail.adOffer ? el("span", { class: "mail-deal-tag" }, ratePct(mail.adOffer)) : null,
      mail.from,
    ),
    el(
      "span",
      { class: "mail-row__text" },
      el("span", { class: "mail-row__subject" }, mail.subject),
      el("span", { class: "mail-row__preview" }, ` — ${previewOf(mail.body)}`),
    ),
    el("span", { class: "mail-row__date" }, dateLabel(mail.day)),
  );
}

function emptyMessage(): string {
  if (searchQuery.trim()) return "검색 결과가 없어요.";
  if (activeView === "sent") return "보낸 메일이 없어요.";
  if (activeView === "starred") return "별표 표시한 메일이 없어요.";
  if (activeView === "spam") return "스팸 메일이 없어요.";
  if (activeTab === "social") return "소셜 메일이 없어요.";
  if (activeTab === "promotions") return "프로모션 메일이 없어요.";
  if (activeTab === "updates") return "업데이트 메일이 없어요.";
  return "받은 메일이 없어요.";
}

/** 버튼 상태별 라벨 — 판정은 systems의 adOfferStatus()를 그대로 따른다. */
const OFFER_BTN_LABEL: Record<ReturnType<typeof adOfferStatus>, string> = {
  ok: "구매하기",
  used: "구매 완료",
  expired: "기간 만료",
  owned: "보유 중",
  poor: "소지금 부족",
};

/** 광고 메일 본문의 상품 오퍼 카드 */
function offerCard(ctx: GameContext, mail: Email, offer: AdOffer): HTMLElement | null {
  const item = adOfferItem(offer);
  // 상품 id가 유실된 오퍼(구버전 세이브 등)는 카드를 그리지 않는다.
  if (!item) return null;

  const s = ctx.store.getState();
  const price = adOfferPrice(s, offer, item);
  const status = adOfferStatus(s, mail);
  const boost = boostText(item);
  const pct = ratePct(offer);

  const buy = (): void => {
    confirmPurchase(ctx, {
      itemName: item.name,
      priceText: `${formatNumber(price)}원`,
      message:
        `정가 ${formatNumber(item.price)}원 → ${pct} 특가 ${formatNumber(price)}원.\n` +
        `이 특가는 ${dateLabel(offer.expiresDay)}이 지나면 사라져요. 구매하시겠습니까?`,
      onConfirm: () => {
        let ok = false;
        ctx.update((st) => {
          ok = buyFromAdOffer(st, mail.id);
        });
        if (ok) {
          ctx.toast(
            boost
              ? `${item.name} 특가 구매 완료! ${boost}`
              : `${item.name} 특가 구매 완료!`,
          );
        } else {
          ctx.toast("구매하지 못했어요");
        }
      },
    });
  };

  return el(
    "div",
    { class: "mail-offer" },
    el(
      "div",
      { class: "mail-offer__head" },
      el("span", { class: "mail-offer__badge" }, `${pct} 특가`),
      el("span", { class: "mail-offer__head-text" }, "회원님만을 위한 단독 쿠폰"),
    ),
    el(
      "div",
      { class: "mail-offer__body" },
      el(
        "div",
        { class: "mail-offer__info" },
        el("div", { class: "mail-offer__name" }, item.name),
        item.desc ? el("div", { class: "mail-offer__desc" }, item.desc) : null,
        el(
          "div",
          { class: "mail-offer__prices" },
          el("s", { class: "mail-offer__origin" }, `${formatNumber(item.price)}원`),
          el("span", { class: "mail-offer__deal" }, `${formatNumber(price)}원`),
        ),
        boost ? el("div", { class: "mail-offer__stat" }, boost) : null,
      ),
      el(
        "button",
        {
          class: "btn mail-offer__buy",
          disabled: status !== "ok",
          onclick: () => {
            if (status === "ok") buy();
          },
        },
        OFFER_BTN_LABEL[status],
      ),
    ),
    el(
      "div",
      { class: "mail-offer__expiry" },
      icon("clock", { size: 13 }),
      el(
        "span",
        {},
        `${dateLabel(offer.expiresDay)} 24시 만료 — 오늘이 지나면 이 쿠폰은 사라져요.`,
      ),
    ),
  );
}

function emailView(ctx: GameContext, mail: Email | null): HTMLElement {
  if (!mail) {
    return el(
      "div",
      { class: "mail__view mail__view--empty" },
      el("div", { class: "mail__view-icon" }, icon("mail", { size: 40 })),
      el("div", { class: "empty" }, "메일을 선택하세요."),
    );
  }
  const offer = mail.jobOffer;
  return el(
    "div",
    { class: "mail__view" },
    el("div", { class: "mail__subject" }, mail.subject),
    el(
      "div",
      { class: "mail__meta" },
      el("span", { class: "mail__from" }, mail.from),
      el("span", { class: "mail__date" }, dateLabel(mail.day)),
    ),
    mail.spam
      ? el(
          "div",
          { class: "mail__spam-warn" },
          "⚠️ 스팸/피싱 의심 메일입니다. 본문의 링크를 누르거나 정보를 입력하지 마세요.",
        )
      : null,
    el("div", { class: "mail__content" }, mail.body),
    mail.adOffer ? offerCard(ctx, mail, mail.adOffer) : null,
    // 서던피스 초대장: 본문 아래 경매장 링크. 열람 기간 종료 여부는 경매장(systems)이 판정하므로
    // 여기서는 항상 링크를 띄우고 진입만 시킨다.
    mail.auctionLink
      ? el(
          "div",
          { class: "mail__actions mail__actions--link" },
          el(
            "button",
            {
              class: "btn mail-auction-link",
              onclick: () => {
                ctx.ui.auctionSiteOpen = true;
                ctx.refresh();
              },
            },
            "🔗 southernpeace.auction/private 입장하기",
          ),
        )
      : null,
    offer
      ? el(
          "div",
          { class: "mail__actions" },
          el(
            "button",
            {
              class: "btn btn--ghost",
              onclick: () => {
                ctx.update((s) => declineJobOffer(s, mail.id));
                ctx.toast(`${offer.company} 입사를 거절했어요`);
                ctx.refresh();
              },
            },
            "안 한다",
          ),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                ctx.update((s) => acceptJobOffer(s, mail.id));
                ctx.toast(`${offer.company} 입사 결정! 다음 근무일부터 출근해요`);
                ctx.refresh();
              },
            },
            "출근한다",
          ),
        )
      : null,
  );
}

/** 사이드바 라벨 항목 */
function labelItem(
  ctx: GameContext,
  key: MailView,
  text: string,
  iconName: Parameters<typeof icon>[0],
  count: number,
): HTMLElement {
  return el(
    "button",
    {
      class: "mail-label" + (activeView === key ? " mail-label--on" : ""),
      onclick: () => {
        activeView = key;
        if (key === "inbox") activeTab = "primary";
        ctx.refresh();
      },
    },
    icon(iconName, { size: 17 }),
    el("span", { class: "mail-label__text" }, text),
    count > 0 ? el("span", { class: "mail-label__badge" }, String(count)) : null,
  );
}

/** 카테고리 탭 */
function tabItem(
  ctx: GameContext,
  key: MailTab,
  text: string,
  iconName: Parameters<typeof icon>[0],
): HTMLElement {
  return el(
    "button",
    {
      class: "mail-tab" + (activeTab === key ? " mail-tab--on" : ""),
      onclick: () => {
        activeTab = key;
        ctx.refresh();
      },
    },
    icon(iconName, { size: 16 }),
    el("span", {}, text),
  );
}

export function renderMail(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const emails = s.emails;
  const selected = emails.find((e) => e.id === ctx.ui.mailSelectedId) ?? null;
  const spamCount = emails.filter((e) => e.spam).length;

  // ----- 리스트 영역(검색 입력 시 이 컨테이너만 다시 그린다) -----
  const listBox = el("div", { class: "mail__list" });
  const paintList = (): void => {
    const fresh = ctx.store.getState().emails;
    const shown = visibleEmails(fresh);
    if (shown.length) {
      mount(listBox, ...shown.map((m) => emailRow(ctx, m)));
    } else {
      mount(listBox, el("div", { class: "empty mail__empty" }, emptyMessage()));
    }
  };
  paintList();

  // ----- 검색 입력(포커스 유지를 위해 전체 refresh 대신 리스트만 갱신) -----
  const searchInput = el("input", {
    class: "mail-search__field",
    type: "text",
    placeholder: "메일 검색",
    value: searchQuery,
    oninput: (e: Event) => {
      searchQuery = (e.currentTarget as HTMLInputElement).value;
      paintList();
    },
  });

  // ----- 카테고리 탭(받은편지함에서만 노출) -----
  const tabs =
    activeView === "inbox"
      ? el(
          "div",
          { class: "mail-tabs" },
          tabItem(ctx, "primary", "기본", "mail"),
          tabItem(ctx, "promotions", "프로모션", "megaphone"),
          tabItem(ctx, "social", "소셜", "comment"),
          tabItem(ctx, "updates", "업데이트", "article"),
        )
      : null;

  return el(
    "div",
    { class: "mail" },
    // 상단 마스트/검색바
    el(
      "header",
      { class: "mail__mast" },
      el("span", { class: "mail__logo" }, icon("mail", { size: 20 }), "피메일"),
      el(
        "label",
        { class: "mail-search" },
        icon("search", { size: 17 }),
        searchInput,
        searchQuery
          ? el(
              "button",
              {
                class: "mail-search__clear",
                title: "지우기",
                onclick: () => {
                  searchQuery = "";
                  ctx.refresh();
                },
              },
              icon("x", { size: 15 }),
            )
          : null,
      ),
    ),
    // 본문: 사이드바 | (탭+리스트 | 뷰)
    el(
      "div",
      { class: "mail__body" },
      el(
        "aside",
        { class: "mail-sidebar" },
        el(
          "button",
          {
            class: "mail-compose",
            onclick: () => ctx.toast("메일 쓰기 기능은 준비 중이에요"),
          },
          icon("pen", { size: 18 }),
          "편지쓰기",
        ),
        el(
          "nav",
          { class: "mail-labels" },
          labelItem(ctx, "inbox", "받은편지함", "mail", emails.length),
          labelItem(ctx, "starred", "별표편지함", "star", starredIds.size),
          labelItem(ctx, "spam", "스팸", "shield", spamCount),
          labelItem(ctx, "sent", "보낸편지함", "article", 0),
        ),
      ),
      el(
        "div",
        { class: "mail__panes" },
        el("div", { class: "mail__listwrap" }, tabs, listBox),
        emailView(ctx, selected),
      ),
    ),
  );
}
