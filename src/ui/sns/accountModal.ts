import type { GameContext } from "@/ui/context";
import { getActiveAccount } from "@/core/state";
import {
  canCreateAccount,
  createNewAccount,
  deleteAccount,
  renameAccount,
  switchAccount,
} from "@/systems/accountSystem";
import { el, formatNumber } from "@/utils/dom";
import { avatar } from "@/ui/icons";

/**
 * 계정 관리 창: 보유 계정 전환/삭제 + 새 계정 만들기.
 */
export function renderAccountModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  // 새 계정 입력 상태
  let newName = "";
  let newHandle = "";
  // 개명 편집 상태(계정명만, 핸들은 불변) — 편집 중인 계정 id와 입력값
  let editingId: string | null = null;
  let editName = "";

  function paint(): void {
    const state = ctx.store.getState();
    const active = getActiveAccount(state);

    const accountRows = state.accounts.map((acc) => {
      const isActive = acc.id === active.id;
      const editing = editingId === acc.id;

      // 좌측: 이름(편집 중이면 계정명 입력) + 핸들·팔로워(핸들은 변경 불가)
      const nameBlock = editing
        ? el("input", {
            class: "dm__input",
            type: "text",
            value: editName,
            placeholder: "계정 이름",
            style: "font-weight:700;max-width:180px",
            oninput: (e: Event) => {
              editName = (e.target as HTMLInputElement).value;
            },
          })
        : el(
            "div",
            { style: "font-weight:700;display:flex;align-items:center;gap:8px" },
            avatar(acc.name, 26),
            acc.name,
          );

      const saveEdit = () => {
        ctx.update((s) => renameAccount(s, acc.id, editName));
        editingId = null;
        ctx.toast("계정명을 변경했어요");
        paint();
      };

      // 우측 액션: 편집 중이면 저장/취소, 아니면 이름변경 + 전환/사용중 + 삭제
      const actions = editing
        ? [
            el("button", { class: "btn", onclick: saveEdit }, "저장"),
            el(
              "button",
              {
                class: "btn btn--ghost",
                onclick: () => {
                  editingId = null;
                  paint();
                },
              },
              "취소",
            ),
          ]
        : [
            el(
              "button",
              {
                class: "btn btn--ghost",
                onclick: () => {
                  editingId = acc.id;
                  editName = acc.name;
                  paint();
                },
              },
              "이름 변경",
            ),
            isActive
              ? el("span", { class: "chip chip--active" }, "사용 중")
              : el(
                  "button",
                  {
                    class: "btn",
                    onclick: () => {
                      ctx.update((s) => switchAccount(s, acc.id));
                      ctx.toast(`@${acc.handle} 계정으로 전환`);
                      paint();
                    },
                  },
                  "전환",
                ),
            state.accounts.length > 1
              ? el(
                  "button",
                  {
                    class: "btn btn--ghost",
                    style: "border-color:var(--danger);color:var(--danger)",
                    onclick: () => {
                      ctx.update((s) => deleteAccount(s, acc.id));
                      ctx.toast(`@${acc.handle} 계정 삭제`);
                      paint();
                    },
                  },
                  "삭제",
                )
              : null,
          ];

      return el(
        "div",
        { class: "explore-card", style: isActive ? "border-color:var(--accent)" : "" },
        el(
          "div",
          { class: "explore-card__head" },
          el(
            "div",
            {},
            nameBlock,
            el(
              "div",
              { style: "font-size:12px;color:var(--text-muted);margin-top:4px" },
              `@${acc.handle} · 팔로워 ${formatNumber(acc.followers)}`,
            ),
          ),
          el("div", { class: "acct-actions" }, ...actions),
        ),
      );
    });

    // 새 계정 만들기 폼
    const nameInput = el("input", {
      class: "dm__input",
      type: "text",
      placeholder: "계정 이름",
      value: newName,
      oninput: (e) => {
        newName = (e.target as HTMLInputElement).value;
      },
    });
    const handleInput = el("input", {
      class: "dm__input",
      type: "text",
      placeholder: "아이디(영문/숫자)",
      value: newHandle,
      oninput: (e) => {
        newHandle = (e.target as HTMLInputElement).value;
      },
    });

    const createSection = canCreateAccount(state)
      ? el(
          "div",
          { style: "border-top:1px solid var(--border);padding-top:12px;margin-top:4px" },
          el("div", { style: "font-weight:700;margin-bottom:8px" }, "새 계정 만들기"),
          el("div", { class: "dm__send", style: "margin-top:8px" }, nameInput),
          el("div", { class: "dm__send", style: "margin-top:8px" }, handleInput),
          el(
            "div",
            { style: "text-align:right;margin-top:10px" },
            el(
              "button",
              {
                class: "btn",
                onclick: () => {
                  ctx.update((s) => createNewAccount(s, newName, newHandle, "daily"));
                  const created = getActiveAccount(ctx.store.getState());
                  ctx.toast(`새 계정 @${created.handle} 생성!`);
                  newName = "";
                  newHandle = "";
                  paint();
                },
              },
              "만들고 전환",
            ),
          ),
        )
      : el(
          "div",
          { class: "empty" },
          "계정은 최대 5개까지 만들 수 있어요.",
        );

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        "계정 관리",
        el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
      ),
      el("div", { class: "modal__body" }, ...accountRows, createSection),
    );
  }

  paint();
  return container;
}
