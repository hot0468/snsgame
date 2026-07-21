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
          title: hasAppt ? "약속을 잡았어요" : `만남 성사 확률 ${chance}%`,
          onclick: () => {
            if (hasAppt) return;
            ctx.openModal((c) => renderMeetChatModal(c, charId, name, attribute));
          },
        },
        hasAppt ? "약속 잡힘" : "만남 약속",
      ),
    );
  }

  /** 부장님 — 로스터와 무관한 고정 특수 친구. 항상 노출, 클릭 시 아재개그 챗. */
  function bossRow(): HTMLElement {
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
          onclick: () => ctx.openModal((c) => renderBossChatModal(c)),
        },
        "카톡하기",
      ),
    );
  }

  function render(): void {
    const state = ctx.store.getState();
    const chars = relCharsInKakao(state);
    const chance = Math.round(meetSuccessChance(state) * 100);
    const me = getActiveAccount(state);
    const pendingChars = chars.filter((c) => relPendingArc(state, c.id) !== null);

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

    const body =
      chars.length === 0
        ? el(
            "div",
            { class: "kklist__empty" },
            "아직 카톡할 친구가 없어요.\n계열을 해금하고 트윗으로 호감도를 쌓아보세요.",
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
                        ...pendingChars.map((c) => eventRow(c.id, c.name)),
                      ),
                )
              : null,
            // 친구 섹션
            sectionHeader(`친구 ${chars.length}`, friendsCollapsed, () => {
              friendsCollapsed = !friendsCollapsed;
              render();
            }),
            friendsCollapsed
              ? null
              : el(
                  "div",
                  { class: "kklist__group" },
                  ...chars.map((char) => {
                    const hasAppt = state.appointments.some((a) => a.charId === char.id);
                    return friendRow(
                      char.id,
                      char.name,
                      char.gender,
                      char.attribute,
                      char.likedKind,
                      hasAppt,
                      chance,
                    );
                  }),
                ),
          );

    container.replaceChildren(
      el(
        "div",
        { class: "kklist__topbar" },
        el("span", { class: "kklist__title" }, "친구"),
        el(
          "span",
          { class: "kklist__topicons" },
          icon("search", { size: 18, className: "kklist__topicon" }),
          el("button", { class: "kklist__close", onclick: () => ctx.closeModal() }, "✕"),
        ),
      ),
      el(
        "div",
        { class: "kklist__panel" },
        meRow,
        el("div", { class: "kklist__group" }, bossRow()),
        body,
      ),
    );
  }

  render();
  return container;
}
