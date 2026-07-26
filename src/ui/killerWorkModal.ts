import type { GameContext } from "./context";
import { el } from "@/utils/dom";
import { targetById } from "@/data/killerTargets";
import { attemptHit } from "@/systems/killer";
import { weekdayLabel } from "@/systems/calendar";

/**
 * [작업하기] 모달 — 타겟 정보와 마감만 보여주고 위치를 입력받는다.
 * 타겟 트윗은 이제 SNS 피드/검색에서 읽는다(트윗 검색·둘러보기·프로필). 여기선 처리만.
 * 정답이면 의뢰비 지급, 틀리면 재시도(임무 유지).
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
        el("p", {}, "지금은 배정된 임무가 없다. 매달 1일에 momo가 다음 타겟을 보낸다."),
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
      el("span", { class: "modal__head-title" }, "작업 — 타겟 처리"),
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
          `마감: 일주일 · 남은 시간 ${remain}일 (${weekdayLabel(s.day)}요일)`,
        ),
      ),
      el(
        "div",
        { class: "killer-hint" },
        `SNS에서 '@${target.handle}'을 검색하거나 둘러보기 피드에서 그자의 트윗을 찾아, 위치를 흘린 트윗을 읽어라. 그 위치를 아래에 입력한다.`,
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
