import type { GameContext } from "./context";
import type { AttributeId, TweetKind } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { ATTRIBUTES } from "@/data/attributes";
import {
  meetSuccessChance,
  relCharsInKakao,
  relPendingArc,
  relStateOf,
} from "@/systems/relationship";
import { el } from "@/utils/dom";
import { avatar, icon } from "./icons";
import { renderRelEventModal } from "./relEventModal";
import { renderMeetChatModal } from "./meetChatModal";
import { renderBossChatModal } from "./bossChatModal";
import { canLaughToday } from "@/systems/bossJoke";
import { BOSS_NAME } from "@/data/bossJokes";

/** 관계 캐릭터가 좋아하는 트윗 유형 라벨(composeModal의 KIND_META와 동일). */
const KIND_LABEL: Record<TweetKind, string> = {
  plain: "무난",
  provoke: "자극",
  info: "정보",
  emotional: "감성",
};

/**
 * 카카오톡 친구 목록 룩앤필의 관계 시스템 화면(작업표시줄 가운데 카톡 버튼으로 연다).
 * 활성 계정에 해금된 계열의 관계 캐릭터만 노출한다 — 기존 시스템 카톡(집주인·월급 토스트)과는 별개.
 * ctx.update로 상태를 바꿔도 모달 노드는 함수 identity로 캐시돼 재렌더되지 않으므로,
 * appointmentModal처럼 컨테이너를 잡고 내부 render()로 직접 다시 그린다.
 * systems 호출은 무변경 — 카톡 감성의 레이아웃/스타일만 입힌다.
 */
export function renderKakaoListView(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal kklist-modal" });

  // 카톡의 섹션 접기(∨) — 휘발성 로컬 상태, 모달 닫으면 리셋.
  let eventsCollapsed = false;
  let friendsCollapsed = false;
  // 뷰: 'friends'=친구(만난 사람)만 / 'new'=알 수도 있는 사람(아직 안 만난 사람, 여기서 첫 만남 약속).
  let view: "friends" | "new" = "friends";

  function sectionHeader(label: string, collapsed: boolean, onToggle: () => void): HTMLElement {
    return el(
      "button",
      { class: "kklist__section", onclick: onToggle },
      el("span", { class: "kklist__section-label" }, label),
      icon("chevron", {
        size: 16,
        className: collapsed ? "kklist__chev kklist__chev--up" : "kklist__chev",
      }),
    );
  }

  function eventRow(charId: string, name: string): HTMLElement {
    return el(
      "div",
      { class: "kklist__row" },
      el(
        "span",
        { class: "kklist__ava" },
        avatar(name, 44),
        el("span", { class: "kklist__dot" }),
      ),
      el(
        "div",
        { class: "kklist__main" },
        el("span", { class: "kklist__name" }, name),
        el("span", { class: "kklist__sub" }, "새 이벤트가 도착했어요"),
      ),
      el(
        "button",
        {
          class: "kklist__pill kklist__pill--accent",
          onclick: () => ctx.openModal((c) => renderRelEventModal(c, charId)),
        },
        "이벤트 보기",
      ),
    );
  }

  function friendRow(
    charId: string,
    name: string,
    gender: "m" | "f",
    attribute: AttributeId,
    likedKind: TweetKind,
    hasAppt: boolean,
    chance: number,
  ): HTMLElement {
    const state = ctx.store.getState();
    const rel = relStateOf(state, charId);
    const attrLabel = ATTRIBUTES[attribute]?.label ?? attribute;
    const pct = Math.min(rel.affinity / 90, 1) * 100;
    const bondTag =
      rel.bond === "lover"
        ? el("span", { class: "kklist__bond kklist__bond--lover" }, "연인")
        : rel.bond === "friend"
          ? el("span", { class: "kklist__bond" }, "친구")
          : null;
    const stageText =
      rel.stage >= 3 ? "관계 완주 · 선물 받음" : `만남 이야기 ${rel.stage}/3`;

    return el(
      "div",
      { class: "kklist__row" },
      el("span", { class: "kklist__ava" }, avatar(name, 44)),
      el(
        "div",
        { class: "kklist__main" },
        el(
          "span",
          { class: "kklist__nameline" },
          el("span", { class: "kklist__name" }, name),
          el("span", { class: "kklist__sex" }, gender === "m" ? "♂" : "♀"),
          bondTag,
        ),
        el("span", { class: "kklist__sub" }, `${attrLabel} · ${KIND_LABEL[likedKind]}선호 · ${stageText}`),
        el(
          "div",
          { class: "kklist__aff" },
          el(
            "div",
            { class: "bar bar--sm" },
            el("div", { class: "bar__fill--skill", style: `width:${pct}%;height:100%` }),
          ),
          el("span", { class: "kklist__affval" }, `호감도 ${rel.affinity}`),
        ),
      ),
      el(
        "button",
        {
          class: "kklist__pill",
          disabled: hasAppt,
          title: hasAppt ? "약속을 잡았어요" : `만남 수락 확률 ${chance}%`,
          onclick: () => {
            if (hasAppt) return;
            ctx.openModal((c) => renderMeetChatModal(c, charId, name, attribute));
          },
        },
        hasAppt ? "약속 잡힘" : "만남 약속",
      ),
    );
  }

  /** 부장님 — 로스터와 무관한 고정 특수 친구. 아재개그 챗은 하루 1번(개그 보상도 1일 1회 캡과 같은 게이트). */
  function bossRow(): HTMLElement {
    const canChat = canLaughToday(ctx.store.getState());
    return el(
      "div",
      { class: "kklist__row" },
      el("span", { class: "kklist__ava" }, avatar(BOSS_NAME, 44)),
      el(
        "div",
        { class: "kklist__main" },
        el(
          "span",
          { class: "kklist__nameline" },
          el("span", { class: "kklist__name" }, BOSS_NAME),
          el("span", { class: "kklist__sex" }, "♂"),
        ),
        el("span", { class: "kklist__sub" }, "회사 · 아재개그 장인"),
      ),
      el(
        "button",
        {
          class: "kklist__pill",
          disabled: !canChat,
          title: canChat ? "부장님 아재개그로 개그 스탯을 얻어요" : "오늘은 이미 부장님과 카톡했어요",
          onclick: () => {
            if (canChat) ctx.openModal((c) => renderBossChatModal(c));
          },
        },
        canChat ? "카톡하기" : "오늘 완료",
      ),
    );
  }

  function render(): void {
    const state = ctx.store.getState();
    const chars = relCharsInKakao(state);
    const chance = Math.round(meetSuccessChance(state) * 100);
    const me = getActiveAccount(state);
    // 새 이벤트(관계 이벤트)는 '만난 사람'에게만 — 안 만난 사람은 '알 수도 있는 사람'에만 뜬다.
    const pendingChars = chars.filter(
      (c) => relStateOf(state, c.id).met && relPendingArc(state, c.id) !== null,
    );

    // 내 프로필 행(맨 위)
    const meRow = el(
      "div",
      { class: "kklist__me" },
      avatar(me.name, 52),
      el(
        "div",
        { class: "kklist__me-text" },
        el("span", { class: "kklist__me-name" }, me.name),
        el("span", { class: "kklist__me-handle" }, `@${me.handle}`),
      ),
    );

    // 만남을 성사한 사람만 '친구'로, 아직 안 만난(호감도만 쌓인) 사람은 '새로운 인연'으로 가른다.
    const metChars = chars.filter((c) => relStateOf(state, c.id).met);
    const newChars = chars.filter((c) => !relStateOf(state, c.id).met);

    const friendGroup = (list: typeof chars): HTMLElement =>
      el(
        "div",
        { class: "kklist__group" },
        ...list.map((char) => {
          const hasAppt = state.appointments.some((a) => a.charId === char.id);
          return friendRow(
            char.id,
            char.nickname,
            char.gender,
            char.attribute,
            char.likedKind,
            hasAppt,
            chance,
          );
        }),
      );

    const friendSection = (
      label: string,
      list: typeof chars,
      collapsed: boolean,
      toggle: () => void,
    ): HTMLElement | null =>
      list.length === 0
        ? null
        : el("div", {}, sectionHeader(label, collapsed, toggle), collapsed ? null : friendGroup(list));

    // '알 수도 있는 사람' 뷰: 아직 안 만난 사람만 — 여기서 '만남 약속'으로 첫 만남을 잡는다.
    // 만난 사람은 자동으로 '친구' 뷰로 넘어가 이 목록에서 사라진다.
    const newBody =
      newChars.length === 0
        ? el(
            "div",
            { class: "kklist__empty" },
            "지금은 새로 알게 된 사람이 없어요.\n관심 계열 트윗을 올려 호감도를 쌓으면 여기 떠요.",
          )
        : el("div", { class: "kklist" }, friendGroup(newChars));

    // '친구' 뷰: 만남을 성사한 사람만(+ 새 이벤트). 트윗만으로는 여기 안 뜬다.
    const friendsBody =
      metChars.length === 0 && pendingChars.length === 0
        ? el(
            "div",
            { class: "kklist__empty" },
            "아직 만난 친구가 없어요.\n'알 수도 있는 사람'에서 만남 약속을 잡아보세요.",
          )
        : el(
            "div",
            { class: "kklist" },
            // 새 이벤트 섹션(카톡의 '생일인 친구' 자리)
            pendingChars.length > 0
              ? el(
                  "div",
                  {},
                  sectionHeader(
                    `새 이벤트 ${pendingChars.length}`,
                    eventsCollapsed,
                    () => {
                      eventsCollapsed = !eventsCollapsed;
                      render();
                    },
                  ),
                  eventsCollapsed
                    ? null
                    : el(
                        "div",
                        { class: "kklist__group" },
                        ...pendingChars.map((c) => eventRow(c.id, c.nickname)),
                      ),
                )
              : null,
            // 친구(만남을 성사한 사람만)
            friendSection(`친구 ${metChars.length}`, metChars, friendsCollapsed, () => {
              friendsCollapsed = !friendsCollapsed;
              render();
            }),
          );

    const body = view === "new" ? newBody : friendsBody;

    container.replaceChildren(
      el(
        "div",
        { class: "kklist__topbar" },
        el("span", { class: "kklist__title" }, view === "new" ? "알 수도 있는 사람" : "친구"),
        el(
          "span",
          { class: "kklist__topicons" },
          // 친구 ↔ 알 수도 있는 사람 전환. 새로 알게 된 사람 수를 뱃지로 보여준다.
          el(
            "button",
            {
              class: "kklist__pill",
              onclick: () => {
                view = view === "new" ? "friends" : "new";
                render();
              },
            },
            view === "new"
              ? "친구 목록"
              : newChars.length > 0
                ? `알 수도 있는 사람 ${newChars.length}`
                : "알 수도 있는 사람",
          ),
          el("button", { class: "kklist__close", onclick: () => ctx.closeModal() }, "✕"),
        ),
      ),
      el(
        "div",
        { class: "kklist__panel" },
        meRow,
        // 부장님은 로스터 무관 고정 친구 — '친구' 뷰에서만 노출.
        view === "friends" ? el("div", { class: "kklist__group" }, bossRow()) : null,
        body,
      ),
    );
  }

  render();
  return container;
}
