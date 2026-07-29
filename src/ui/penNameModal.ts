import type { GameContext } from "./context";
import { getActiveAccount } from "@/core/state";
import { el } from "@/utils/dom";

/** 필명 최대 길이 — 검색창·트윗 본문에 그대로 박히므로 너무 길면 문장이 깨진다. */
export const PEN_NAME_MAX = 12;

/**
 * 이름 한 줄을 받는 공용 입력 모달(웹툰 필명·방송 활동명).
 *
 * ⚠️ 입력값은 DOM에만 있다(전체 재렌더 모델). 그래서 이 모달은 렌더 함수를 매번
 *    새로 만들지 않고 **완성된 노드를 캐시해** 넘긴다 — 재렌더에 타이핑이 날아가지 않게.
 */
export function openNameModal(
  ctx: GameContext,
  opts: {
    title: string;
    lead: string;
    hint: string;
    confirmLabel: string;
    /** 입력창에 미리 채워둘 값(기본: 활성 계정명) */
    suggested?: string;
    max?: number;
    placeholder?: string;
    onConfirm: (name: string) => void;
  },
): void {
  const max = opts.max ?? PEN_NAME_MAX;
  const input = el("input", {
    class: "pen-name__input",
    type: "text",
    value: opts.suggested ?? getActiveAccount(ctx.store.getState()).name,
    maxlength: String(max),
    placeholder: opts.placeholder ?? "이름을 입력하세요",
    spellcheck: "false",
    autocomplete: "off",
  }) as HTMLInputElement;

  const submit = (): void => {
    // 빈 값 처리는 호출부(systems)에 맡긴다 — 여기서 막지 않고 그대로 넘긴다.
    const name = input.value.trim().slice(0, max);
    ctx.closeModal();
    opts.onConfirm(name);
  };

  input.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") submit();
  });

  const node = el(
    "div",
    { class: "modal modal--pen" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, opts.title),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el("p", { class: "pen-name__lead" }, opts.lead),
      input,
      el("p", { class: "pen-name__hint" }, `${opts.hint} (최대 ${max}자)`),
      el(
        "div",
        { class: "compose-actions", style: "margin-top:14px" },
        el("button", { class: "btn", onclick: submit }, opts.confirmLabel),
      ),
    ),
  );

  // 노드를 그대로 돌려주는 렌더 함수 — identity가 고정돼 재렌더에도 입력이 살아남는다.
  ctx.openModal(() => node);
  // 모달이 실제로 붙은 뒤에 포커스를 준다(붙기 전 focus는 무시된다).
  requestAnimationFrame(() => input.focus());
}

/**
 * 웹툰 작가 데뷔 필명 입력 모달.
 *
 * 계약 수락 버튼에서 열린다. 확인하면 onConfirm(penName)이 실제 계약을 체결한다 —
 * 이 화면은 이름만 받고, 계약 규칙은 systems/author가 처리한다.
 */
export function openPenNameModal(
  ctx: GameContext,
  opts: { adult: boolean; onConfirm: (penName: string) => void },
): void {
  openNameModal(ctx, {
    title: "✍️ 데뷔 필명 정하기",
    lead: opts.adult
      ? "성인물 연재로 데뷔합니다. 작품에 올릴 필명을 정해주세요."
      : "연재 작가로 데뷔합니다. 작품에 올릴 필명을 정해주세요.",
    hint: "이 이름으로 SNS를 검색하면 독자 반응을 볼 수 있어요.",
    confirmLabel: "이 이름으로 데뷔",
    placeholder: "필명을 입력하세요",
    onConfirm: opts.onConfirm,
  });
}
