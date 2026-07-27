import type { GameContext } from "./context";
import type { SkillStatId } from "@/core/types";
import { el, formatNumber } from "@/utils/dom";
// SKILL_STATS는 더 이상 필요 없다 — skillDeltas가 label을 직접 실어 오므로(SkillDeltaEntry) 조회가 사라졌다.
import { RESOURCE_STATS, MAX_SKILL } from "@/data/stats";
import posIcon from "@/assets/system/systempop_pos.svg";
import negIcon from "@/assets/system/systempop_neg.svg";

/** 프메 스타일 스탯바로 보여줄 핵심 자원 4종(도크 바와 동일 색). 나머지(돈·팔로워)는 바가 없어 텍스트로. */
const BAR_STATS = ["action", "mental", "morality", "reputation"] as const;

/** 시스템 알림에 표시할 핵심 자원 델타. 있으면 증감 줄 렌더 + tone 자동 판정에 쓰인다. */
export interface NoticeDeltas {
  action?: number;
  mental?: number;
  morality?: number;
  reputation?: number;
  money?: number;
  followers?: number;
}

/** 실제 반영된 스킬 델타 1건(음수 포함 — offline.ts의 OfflineOutcome.skillDeltas와 동일 shape). */
export interface SkillDeltaEntry {
  skill: SkillStatId;
  label: string;
  delta: number;
}

/** ⑤ 컨디션 판정 등급 — 있으면 결과 카드에 등급 배지(색·아이콘·헤더 문구)를 얹는다. */
export type NoticeGrade = "fail" | "normal" | "great";

export interface SystemNoticeOpts {
  title?: string;
  message: string;
  deltas?: NoticeDeltas;
  /**
   * 실제로 반영된 스킬 델타 목록(음수=반대급부 포함, 0은 이미 제외됨).
   * offline.ts가 등급 배율·감쇠·정신력 배율을 전부 반영해 넘기므로 그대로 쓴다 — 재계산 금지.
   */
  skillDeltas?: SkillDeltaEntry[];
  /** 델타로 표현 못 하는 추가 획득(스킬/새 소재/일당 등). 델타 줄과 같은 테마색으로 아래에 붙는다. */
  extraLines?: string[];
  /** 명시 override. 없으면 deltas 부호로 자동, deltas도 없으면 "good". */
  tone?: "good" | "bad";
  /**
   * ⑤ 컨디션 판정 등급. fail/great이면 헤더 위에 배지를 얹는다.
   * ⚠️ 실패/대성공 문구는 이미 message 앞에 합성돼 있다 — 여기선 연출(배지)만 추가한다.
   */
  grade?: NoticeGrade;
  confirmLabel?: string;
  /** 기본 closeModal. */
  onConfirm?: () => void;
  /** 확인 버튼 대신 넣을 커스텀 버튼들(트윗한다/안 한다 등). 있으면 확인 버튼은 생략된다. */
  extraActions?: HTMLElement[];
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** 돈·팔로워 델타 텍스트 줄(바가 없는 자원). 핵심 4스탯은 statDeltaBar로 따로 그린다. */
function deltaLine(d: NoticeDeltas): string {
  const parts: string[] = [];
  if (d.money) parts.push(`${d.money > 0 ? "+" : "-"}${formatNumber(Math.abs(d.money))}원`);
  if (d.followers) parts.push(`팔로워 ${d.followers > 0 ? "+" : "-"}${formatNumber(Math.abs(d.followers))}`);
  return parts.join(" · ");
}

/**
 * 프린세스 메이커식 스탯바 한 줄 — 변화한 스탯의 현재값을 바로 보여주고,
 * 변화 전(old)→후(new)로 채워지는 애니메이션 + 증감 뱃지를 붙인다.
 * 이 카드는 ctx.update 이후 렌더되므로 resources는 이미 '변화 후' 값이다 → old = 현재 - delta.
 */
function deltaBar(
  label: string,
  cur: number,
  delta: number,
  baseCap: number,
  fillClass: string,
): HTMLElement {
  const newVal = Math.max(0, cur);
  const oldVal = Math.max(0, cur - delta);
  // 행동력은 치트로 상한(100)을 넘을 수 있다 → 실제 값이 max를 넘으면 그 값을 상한으로.
  const cap = Math.max(baseCap, newVal, oldVal);
  const oldPct = Math.round((oldVal / cap) * 100);
  const newPct = Math.round((newVal / cap) * 100);
  const fill = el("div", {
    class: `bar__fill ${fillClass}`,
    style: `width:${oldPct}%;transition:width .8s cubic-bezier(.22,1,.36,1)`,
  });
  // 두 프레임 뒤 목표 너비로 → 브라우저가 초기 너비를 반영한 뒤 트랜지션이 돈다(채워지는 연출).
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      fill.style.width = `${newPct}%`;
    }),
  );
  return el(
    "div",
    { class: "sys-notice__statrow" },
    el("span", { class: "sys-notice__statlabel" }, label),
    el("div", { class: "bar" }, fill),
    el("span", { class: "sys-notice__statval" }, String(Math.round(newVal))),
    el(
      "span",
      { class: "sys-notice__statbadge sys-notice__statbadge--" + (delta >= 0 ? "up" : "down") },
      signed(delta),
    ),
  );
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

  // 변화한 핵심 스탯(행동력·정신력·도덕성·평판) + 스킬(어휘력·지식 등)을 프메식 스탯바로.
  // 현재값은 스토어에서 읽는다(변화 후 값 → old = 현재 - delta).
  const state = ctx.store.getState();
  const res = state.resources;
  const statBars: HTMLElement[] = [
    ...(d
      ? BAR_STATS.filter((id) => d[id]).map((id) =>
          deltaBar(RESOURCE_STATS[id].label, res[id], d[id] as number, RESOURCE_STATS[id].max, `bar__fill--${id}`),
        )
      : []),
    ...(opts.skillDeltas
      ? opts.skillDeltas
          .filter((d) => d.delta)
          .map((d) =>
            deltaBar(
              d.label,
              state.skills[d.skill],
              d.delta,
              MAX_SKILL,
              // 반대급부 감소(음수)는 스킬 바여도 하락색으로 — "조용히 깎였다"를 색으로 바로 읽히게 한다.
              d.delta < 0 ? "bar__fill--skilldown" : "bar__fill--skill",
            ),
          )
      : []),
  ];

  // ⑤ 컨디션 판정 배지 — fail/great일 때만 헤더 위에 얹는다. 문구는 message가 이미 담당하므로 라벨만.
  const gradeBadge =
    opts.grade && opts.grade !== "normal"
      ? el(
          "div",
          { class: `sys-notice__grade sys-notice__grade--${opts.grade}` },
          opts.grade === "fail" ? "판정: 실패" : "판정: 대성공",
        )
      : null;

  const gradeClass = opts.grade && opts.grade !== "normal" ? ` sys-notice--grade-${opts.grade}` : "";

  return el(
    "div",
    { class: `modal sys-notice sys-notice--${tone}${gradeClass}` },
    el("div", { class: "sys-notice__header" }, opts.title ?? "시스템 알림"),
    el(
      "div",
      { class: "sys-notice__glyph", "aria-hidden": "true" },
      el("img", { src: tone === "bad" ? negIcon : posIcon, alt: "", width: "80", height: "80" }),
    ),
    el(
      "div",
      { class: "sys-notice__box" },
      gradeBadge,
      el("p", { class: "sys-notice__msg" }, opts.message),
      statBars.length ? el("div", { class: "sys-notice__stats" }, ...statBars) : null,
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
