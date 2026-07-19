import type { GameContext } from "./context";
import { el, formatNumber } from "@/utils/dom";
import posIcon from "@/assets/system/systempop_pos.svg";
import negIcon from "@/assets/system/systempop_neg.svg";

/** 시스템 알림에 표시할 핵심 자원 델타. 있으면 증감 줄 렌더 + tone 자동 판정에 쓰인다. */
export interface NoticeDeltas {
  action?: number;
  mental?: number;
  morality?: number;
  reputation?: number;
  money?: number;
  followers?: number;
}

export interface SystemNoticeOpts {
  title?: string;
  message: string;
  deltas?: NoticeDeltas;
  /** 델타로 표현 못 하는 추가 획득(스킬/새 소재/일당 등). 델타 줄과 같은 테마색으로 아래에 붙는다. */
  extraLines?: string[];
  /** 명시 override. 없으면 deltas 부호로 자동, deltas도 없으면 "good". */
  tone?: "good" | "bad";
  confirmLabel?: string;
  /** 기본 closeModal. */
  onConfirm?: () => void;
  /** 확인 버튼 대신 넣을 커스텀 버튼들(트윗한다/안 한다 등). 있으면 확인 버튼은 생략된다. */
  extraActions?: HTMLElement[];
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** 델타 한 줄: "행동력 +25 · 정신력 +30 · +5,000원 · 팔로워 +120" */
function deltaLine(d: NoticeDeltas): string {
  const parts: string[] = [];
  if (d.action) parts.push(`행동력 ${signed(d.action)}`);
  if (d.mental) parts.push(`정신력 ${signed(d.mental)}`);
  if (d.morality) parts.push(`도덕성 ${signed(d.morality)}`);
  if (d.reputation) parts.push(`평판 ${signed(d.reputation)}`);
  if (d.money) parts.push(`${d.money > 0 ? "+" : "-"}${formatNumber(Math.abs(d.money))}원`);
  if (d.followers) parts.push(`팔로워 ${d.followers > 0 ? "+" : "-"}${formatNumber(Math.abs(d.followers))}`);
  return parts.join(" · ");
}

/**
 * 공용 "시스템 알림" 카드. 단순 결과 알림(문구 + 스탯증감 + 확인)을 통일한다.
 * 긍정=블루(#2e6fe0)/부정=레드(#ef3e3e). openModal(render)에 그대로 넘기거나,
 * 이미 뜬 모달을 갈아끼울 땐 ctx.openModal((c) => renderSystemNotice(c, opts))로 재지정한다.
 */
export function renderSystemNotice(ctx: GameContext, opts: SystemNoticeOpts): HTMLElement {
  const d = opts.deltas;
  // ponytail: 순증감 부호 휴리스틱 — 행동력(action)은 활동에 '쓰는 비용'이라 대부분 음수라서
  //           부호 판정에서 제외한다(빼면 행동력 소모 활동이 다 부정으로 보인다). money/followers도
  //           스케일이 커 제외. mental/morality/reputation만으로 판정하고, mixed 케이스는 tone override.
  const net = d ? (d.mental ?? 0) + (d.morality ?? 0) + (d.reputation ?? 0) : 0;
  const tone = opts.tone ?? (net < 0 ? "bad" : "good");

  const line = d ? deltaLine(d) : "";

  return el(
    "div",
    { class: `modal sys-notice sys-notice--${tone}` },
    el("div", { class: "sys-notice__header" }, opts.title ?? "시스템 알림"),
    el(
      "div",
      { class: "sys-notice__glyph", "aria-hidden": "true" },
      el("img", { src: tone === "bad" ? negIcon : posIcon, alt: "", width: "80", height: "80" }),
    ),
    el(
      "div",
      { class: "sys-notice__box" },
      el("p", { class: "sys-notice__msg" }, opts.message),
      line ? el("p", { class: "sys-notice__delta" }, line) : null,
      ...(opts.extraLines ?? []).map((t) => el("p", { class: "sys-notice__extra" }, t)),
      el(
        "div",
        { class: "sys-notice__actions" },
        ...(opts.extraActions ?? [
          el(
            "button",
            {
              class: "sys-notice__confirm",
              onclick: () => (opts.onConfirm ? opts.onConfirm() : ctx.closeModal()),
            },
            opts.confirmLabel ?? "확인",
          ),
        ]),
      ),
    ),
  );
}
