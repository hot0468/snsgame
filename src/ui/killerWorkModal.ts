import type { GameContext } from "./context";
import { el } from "@/utils/dom";
import { targetById } from "@/data/killerTargets";
import { attemptHit } from "@/systems/killer";
import { weekdayLabel } from "@/systems/calendar";

/**
 * [작업하기] 모달 — 이번 타겟의 '정찰 도시어'(주간 트윗)를 보여주고, 그 안에서 찾은
 * 위치를 입력해 처리한다. 정답이면 의뢰비 지급, 틀리면 재시도(임무 유지).
 */
export function renderKillerWorkModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const asg = s.killerJob?.assignment ?? null;
  const target = asg ? targetById(asg.targetId) : undefined;

  const container = el("div", { class: "modal modal--killer" });

  if (!asg || !target) {
    container.replaceChildren(
      el("div", { class: "modal__head" }, el("span", { class: "modal__head-title" }, "작업")),
      el(
        "div",
        { class: "modal__body" },
        el("p", {}, "지금은 배정된 임무가 없다. 일요일에 momo가 다음 타겟을 보낸다."),
        el("button", { class: "btn btn--ghost", onclick: () => ctx.closeModal() }, "닫기"),
      ),
    );
    return container;
  }

  const remain = Math.max(0, asg.deadlineDay - s.day);
  const errLine = el("p", { class: "killer-err", style: "min-height:18px;color:var(--danger);margin:6px 0 0" }, "");

  const input = el("input", {
    class: "killer-input",
    placeholder: "타겟이 나타날 위치",
    spellcheck: "false",
    autocomplete: "off",
  }) as HTMLInputElement;

  const submit = (): void => {
    let res!: ReturnType<typeof attemptHit>;
    ctx.update((st) => {
      res = attemptHit(st, input.value);
    });
    if (res.ok) {
      ctx.toast(`🗡️ ${res.msg}`);
      ctx.closeModal();
    } else {
      errLine.textContent = res.msg;
      ctx.refresh();
    }
  };

  container.replaceChildren(
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "작업 — 타겟 정찰"),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "div",
        { class: "killer-dossier" },
        el("div", { class: "killer-dossier__name" }, `${target.name} @${target.handle}`),
        el("div", { class: "killer-dossier__bio" }, target.bio),
        el(
          "div",
          { class: "killer-dossier__deadline" },
          `마감: 토요일까지 · 남은 시간 ${remain}일 (${weekdayLabel(s.day)}요일)`,
        ),
      ),
      el("div", { class: "killer-hint" }, "이자의 최근 트윗이다. 위치를 흘린 트윗이 있다 — 잘 읽어라."),
      el(
        "div",
        { class: "killer-tweets" },
        ...target.tweets.map((t) =>
          el("div", { class: "killer-tweet" }, el("span", { class: "killer-tweet__at" }, `@${target.handle}`), t),
        ),
      ),
      el("label", { class: "killer-input-label" }, "처리 위치 입력"),
      el(
        "div",
        { class: "killer-input-row" },
        input,
        el("button", { class: "btn", onclick: submit }, "처리하기"),
      ),
      errLine,
    ),
  );
  return container;
}
