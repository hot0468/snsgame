import type { GameContext } from "./context";
import { RESOURCE_STATS, RESOURCE_STAT_IDS, SKILL_STATS, SKILL_STAT_IDS } from "@/data/stats";
import { daysUntilRent, livingCostToday, rentAmount } from "@/systems/economy";
import { salaryOf } from "@/systems/employment";
import { isAuthorPrepMonth, AUTHOR_WORKLOAD_TARGET, AUTHOR_MAX_MISS } from "@/systems/author";
import { avSalaryOf, canWorkAvNow, AV_MONTHLY_QUOTA } from "@/systems/avJob";
import { certById } from "@/systems/certification";
import { actionMax } from "@/systems/stats";
import type { SkillStatId } from "@/core/types";
import { highestMilestoneTier, unlockedPerks, MILESTONE_PERKS } from "@/systems/milestones";
import { MILESTONE_TITLES, milestoneGrade } from "@/data/milestones";
import { SLOT_LABELS } from "@/core/state";
import { dateLabel, weekdayLabel } from "@/systems/time";
import { el, formatNumber } from "@/utils/dom";
import { renderWorkTweetModal } from "./workTweetModal";
import { statBar } from "./components";
import { icon, type IconName } from "./icons";
import { renderOfflineModal } from "./offlineModal";
import { renderInventoryModal } from "./inventory";
import { renderAchievementsModal } from "./achievementsModal";
import { renderCreaturesModal } from "./creaturesModal";
import { renderDollDexModal } from "./dollDexModal";
import { renderMissionsModal } from "./missionsModal";
import { renderAvWorkModal } from "./avWorkModal";

/** 세부 스탯 아이콘 */
const SKILL_ICON: Record<SkillStatId, IconName> = {
  fitness: "dumbbell",
  beauty: "sparkle",
  vocabulary: "book",
  knowledge: "article",
  sociability: "heart",
  comedy: "smile",
  creativity: "pen",
  lewd: "shield",
  // 변태력 — 음란(shield)과 한눈에 구분돼야 해서 '남들은 안 여는 서랍' 이미지의 drawer.
  pervert: "drawer",
  game: "gamepad",
  // IT계 속성 아이콘(ATTR_ICON.it)과 같은 grid를 쓴다 — 같은 개념에 다른 그림을 주지 않는다.
  it: "grid",
  // 덕질(팬덤 열정·최애) — 꽉 찬 별로 팬심을 표현. sociability(heart)와 겹치지 않게.
  otaku: "star",
};

/**
 * 시계 위에 상시 표시되는 스테이터스 팝업.
 * 기본은 행동력/정신력/도덕성, "상세 스탯"을 누르면 세부 스탯도 펼친다.
 */
let detailOpen = false;

/**
 * 돈·리소스가 이전 렌더보다 감소하면 2초 빨간 플래시를 준다(하락만, 상승·동일 무시).
 * ⚠️ statusInner는 팝업+도크가 공유해 한 프레임에 두 번 호출된다. 비교는 매 호출 순수하게
 * 하되(둘 다 같은 prev를 봐 같은 결과), prev 커밋은 마이크로태스크로 프레임당 1회만 —
 * 첫 호출에서 prev를 갱신하면 둘째 호출이 감소를 못 보고 한쪽만 플래시하는 오작동이 난다.
 */
let prevMoney: number | null = null;
const prevRes: Record<string, number> = {};
let commitScheduled = false;

function computeDrops(s: import("@/core/types").GameState): {
  money: boolean;
  res: Record<string, boolean>;
} {
  const money = prevMoney !== null && s.money < prevMoney;
  const res: Record<string, boolean> = {};
  for (const id of RESOURCE_STAT_IDS) {
    const p = prevRes[id];
    res[id] = p !== undefined && s.resources[id] < p;
  }
  if (!commitScheduled) {
    commitScheduled = true;
    queueMicrotask(() => {
      prevMoney = s.money;
      for (const id of RESOURCE_STAT_IDS) prevRes[id] = s.resources[id];
      commitScheduled = false;
    });
  }
  return { money, res };
}

/** 생활비/월세/재직 안내 */
function renderMoneyInfo(s: import("@/core/types").GameState): HTMLElement {
  const dRent = daysUntilRent(s);
  const rentText = dRent === 0 ? "오늘 납부일!" : `${dRent}일 후`;
  const rent = rentAmount(s);
  const living = livingCostToday(s);

  return el(
    "div",
    {
      class: "money-info",
      style: s.money < 0 ? "color:var(--danger)" : "",
    },
    el(
      "div",
      {},
      `월세 ${formatNumber(rent)}원 · ${rentText}` +
        (s.overdueRent > 0
          ? ` · 미납누적 ${formatNumber(s.overdueRent)}원(${s.unpaidRentStreak}/3)`
          : ""),
    ),
    el("div", {}, living > 0 ? `오늘 생활비 ${formatNumber(living)}원` : "오늘 생활비 면제(회사 복지)"),
    s.loan
      ? el(
          "div",
          { style: "color:var(--danger);font-weight:700" },
          `사채 ${formatNumber(s.loan.repayAmount)}원 · 상환 ${Math.max(0, s.loan.dueDay - s.day)}일 후`,
        )
      : null,
    s.money < 0 && !s.loan
      ? el("div", { style: "font-weight:700" }, "적자! 광고·취업으로 수익을 내세요")
      : null,
  );
}

/**
 * 직업란 — 회사 재직·AV배우 계약을 함께 보여준다.
 * 둘 다 없으면 null(빈 박스 금지). "상세 스탯 보기" 버튼 바로 위에 놓인다.
 */
function renderJobInfo(ctx: GameContext): HTMLElement | null {
  const s = ctx.store.getState();
  const emp = s.employment;
  const av = s.avJob;
  const author = s.authorContract;
  if (!emp && !av && !author) return null;

  const rows: (HTMLElement | null)[] = [
    el("div", { style: "font-weight:700;color:var(--text)" }, "직업"),
  ];
  if (emp) {
    rows.push(
      el(
        "div",
        { style: "color:var(--good);font-weight:700" },
        `재직: ${emp.company} · 월급 ${formatNumber(salaryOf(s))}원 (10일)`,
      ),
      el("div", {}, `업무 성과 Lv.${emp.perfLevel} (${Math.round(emp.performance)}/100)`),
      // 오늘 회사 얘기 트윗(선택·하루 1번) — 긍정/부정 톤을 골라 올린다. 안 써도 됨.
      el(
        "button",
        {
          class: "btn btn--ghost",
          style: "margin-top:6px;width:100%;font-size:12.5px",
          disabled: s.lastWorkTweetDay === s.day,
          onclick: () => {
            if (s.lastWorkTweetDay !== s.day) ctx.openModal(renderWorkTweetModal);
          },
        },
        s.lastWorkTweetDay === s.day ? "💼 오늘 회사 얘기 완료" : "💼 오늘 회사 얘기 트윗",
      ),
    );
  }
  if (av) {
    const halved = av.workDaysThisMonth < AV_MONTHLY_QUOTA;
    rows.push(
      el("div", { style: "font-weight:700" }, `AV배우 · 월급 ${formatNumber(avSalaryOf(s))}원 (25일)`),
    );
    rows.push(
      el(
        "div",
        { style: halved ? "color:var(--danger);font-weight:700" : "" },
        `이번달 근무 ${av.workDaysThisMonth}/${AV_MONTHLY_QUOTA}일` + (halved ? " · 월급 반감 중" : ""),
      ),
    );
    rows.push(el("div", {}, `이번 달 노콘 ${av.condomlessThisMonth}회 (월급 +${formatNumber(av.condomlessThisMonth * 300000)}원)`));
    if (av.stdUntilDay >= s.day) {
      rows.push(
        el(
          "div",
          { style: "color:var(--danger);font-weight:700" },
          `성병 치료 중 · 촬영 불가 (${av.stdUntilDay - s.day + 1}일 남음)`,
        ),
      );
    }
  }
  if (author) {
    const prep = isAuthorPrepMonth(s);
    const met = author.workload >= AUTHOR_WORKLOAD_TARGET;
    rows.push(
      el(
        "div",
        { style: "font-weight:700" },
        prep ? "작가 계약 · 준비 기간" : `작가 계약 · ${author.monthsWorked + 1}개월차`,
      ),
      el(
        "div",
        { style: met ? "color:var(--good)" : "" },
        prep
          ? "다음 달부터 작업 시작"
          : `작업량 ${author.workload}/${AUTHOR_WORKLOAD_TARGET}` +
              (met ? " · 목표 달성 ✓" : ` · 미달 ${author.missCount}/${AUTHOR_MAX_MISS}`),
      ),
    );
  }
  return el("div", { class: "money-info" }, ...rows);
}

/**
 * 세부 스탯 팝오버 하단의 자격증 목록.
 * 이름이 길면 잘리므로, 이름은 한 줄에 가두지 않고
 * .detail-cert__name에서 줄바꿈시킨다(CSS: word-break:keep-all).
 */
function renderCertSection(s: import("@/core/types").GameState): HTMLElement {
  // 데이터에서 사라진 id(구세이브)는 걸러낸다.
  const owned = (s.certifications ?? [])
    .map((id) => certById(id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  return el(
    "div",
    { class: "detail-cert" },
    el(
      "div",
      { class: "detail-cert__head" },
      el("span", { class: "detail-stats__title" }, "자격증"),
      owned.length > 0
        ? el("span", { class: "detail-cert__count" }, `${owned.length}종`)
        : null,
    ),
    owned.length === 0
      ? el("div", { class: "detail-cert__empty" }, "아직 취득한 자격증이 없습니다")
      : el(
          "div",
          { class: "detail-cert__list" },
          ...owned.map((c) =>
            el(
              "div",
              { class: "detail-cert__item", title: `${c.name} · ${c.issuer}` },
              el("span", { class: "detail-cert__dot" }),
              el("span", { class: "detail-cert__name" }, c.name),
            ),
          ),
        ),
  );
}

/**
 * ④ 마일스톤 해금 퍼크 섹션 — 세부 스탯 팝오버 하단(자격증 위)에 둔다.
 * 퍼크는 state에 별도 필드가 없다(statMilestones 개수에서 파생 — milestones.ts 주석 참조).
 * 그래서 여기서도 저장된 값을 읽지 않고 매번 unlockedPerks(state)로 조회한다.
 */
function renderPerksSection(s: import("@/core/types").GameState): HTMLElement {
  const unlocked = unlockedPerks(s);
  const n = s.statMilestones.length;
  const next = MILESTONE_PERKS.find((p) => p.at > n);

  return el(
    "div",
    { class: "detail-cert" },
    el(
      "div",
      { class: "detail-cert__head" },
      el("span", { class: "detail-stats__title" }, "육성 퍼크"),
      el("span", { class: "detail-cert__count" }, `마일스톤 ${n}개 달성`),
    ),
    unlocked.length === 0
      ? el("div", { class: "detail-cert__empty" }, "아직 해금한 퍼크가 없습니다")
      : el(
          "div",
          { class: "detail-cert__list" },
          ...unlocked.map((p) =>
            el(
              "div",
              { class: "detail-cert__item", title: p.desc },
              el("span", { class: "detail-cert__dot" }),
              el(
                "span",
                { class: "detail-cert__name" },
                `${p.label} — ${p.desc}`,
              ),
            ),
          ),
        ),
    next
      ? el(
          "div",
          { class: "detail-cert__empty" },
          `다음 퍼크까지 마일스톤 ${next.at - n}개 (${next.label})`,
        )
      : null,
  );
}

/** 세부 스탯 한 줄(아이콘·라벨·바·수치). extraClass로 음란 행을 빨갛게 강조한다. */
function detailStatRow(
  s: import("@/core/types").GameState,
  id: SkillStatId,
  extraClass = "",
): HTMLElement {
  const def = SKILL_STATS[id];
  const val = Math.round(s.skills[id]);
  const pct = Math.round((Math.max(0, val) / def.max) * 100);
  return el(
    "div",
    { class: "detail-row" + (extraClass ? " " + extraClass : "") },
    el("span", { class: "detail-row__icon" }, icon(SKILL_ICON[id], { size: 13 })),
    el("span", { class: "detail-row__label" }, def.label),
    el(
      "div",
      { class: "bar bar--sm" },
      el("div", { class: "bar__fill bar__fill--skill", style: `width:${pct}%` }),
    ),
    el("span", { class: "detail-row__val" }, String(val)),
    ...milestoneBadge(s, id),
  );
}

/**
 * 해당 스킬의 최고 등급 배지(없으면 빈 배열).
 * 목록에서 스탯끼리 한눈에 비교돼야 하므로 서사 칭호가 아니라 **등급 기호**를 쓴다
 * (칭호는 달성 토스트가 담당 — `MILESTONE_GRADES` 주석 참조).
 */
function milestoneBadge(
  s: import("@/core/types").GameState,
  id: SkillStatId,
): HTMLElement[] {
  const tier = highestMilestoneTier(s, id);
  const grade = milestoneGrade(tier);
  if (!grade) return [];
  return [
    el(
      "span",
      { class: `detail-row__badge detail-row__badge--tier${tier}`, title: MILESTONE_TITLES[id][tier] },
      grade,
    ),
  ];
}

/** 스테이터스 내용(제목 + 본문) — 팝업/도킹 패널이 공유한다. */
function statusInner(ctx: GameContext): HTMLElement[] {
  const s = ctx.store.getState();
  const drops = computeDrops(s);

  const resourceRows = RESOURCE_STAT_IDS.map((id) => {
    const def = RESOURCE_STATS[id];
    // ⚠️ 행동력만 상한이 가변이다(Cheat.exe로 +20). RESOURCE_STATS.action.max(100)를 쓰면
    //    행동력 120이 바에서 꽉 찬 것처럼 보여 상한이 오른 티가 나지 않는다.
    //    정신력·도덕성·평판은 상한이 고정 100이므로 def.max 그대로.
    const max = id === "action" ? actionMax(s) : def.max;
    return statBar(def.label, s.resources[id], max, `bar__fill--${id}`, drops.res[id]);
  });

  // 체력은 GameState top-level(stamina/staminaMax)이라 RESOURCE_STAT_IDS 루프에 안 들어온다.
  // 상한이 가변(운동으로 staminaMax↑)이므로 action(actionMax)처럼 def.max가 아닌 s.staminaMax를 쓴다.
  const staminaRow = statBar("체력", s.stamina, s.staminaMax, "bar__fill--stamina");

  // 세부 스탯은 스크롤 대신 왼쪽에 뜨는 팝오버로 표시한다.
  const detailPop = detailOpen
    ? el(
        "div",
        { class: "detail-pop" },
        el(
          "div",
          { class: "detail-pop__head" },
          el("span", { class: "detail-stats__title" }, "세부 스탯"),
          el(
            "button",
            {
              class: "detail-pop__close",
              title: "닫기",
              onclick: () => {
                detailOpen = false;
                ctx.refresh();
              },
            },
            "✕",
          ),
        ),
        el(
          "div",
          { class: "detail-grid" },
          ...SKILL_STAT_IDS.filter((id) => id !== "lewd" && id !== "pervert").map((id) =>
            detailStatRow(s, id),
          ),
        ),
        // 음란·변태력은 그리드에서 빼 별도 행으로 분리하고 빨간색으로 강조한다. 성인물 보기 OFF면 숨긴다.
        s.adultMode ? detailStatRow(s, "lewd", "detail-row--lewd") : null,
        s.adultMode ? detailStatRow(s, "pervert", "detail-row--lewd") : null,
        // ④ 마일스톤 해금 퍼크 — claimed 개수에서 파생 조회(unlockedPerks). 자격증 섹션 위.
        renderPerksSection(s),
        renderCertSection(s),
      )
    : null;

  // 2슬롯: 낮=morning(따뜻한 금색 CSS 재사용) / 심야=late(밤 블루). evening 클래스는 미사용.
  const slotClass = ["morning", "late"][s.slot] ?? "morning";
  // "스테이터스" 텍스트 대신 시간대 아이콘(낮=해 / 심야=달)을 얹는다.
  const slotIcon = (["sun", "moon"] as const)[s.slot] ?? "sun";
  // 날짜+슬롯 트래커 — 지금 며칠인지·오늘 어디쯤인지를 상시 크게 보여준다.
  const dayHeader = el(
    "div",
    { class: `status-day status-day--${slotClass}` },
    // 날짜 관련(며칠차·날짜·낮/심야 슬롯)을 한 줄에 가로로 배치한다.
    el("span", { class: "status-day__num" }, `${s.day}일차`),
    el("span", { class: "status-day__date" }, `${dateLabel(s.day)} (${weekdayLabel(s.day)})`),
    el(
      "div",
      { class: "status-day__slots" },
      el(
        "span",
        { class: "status-day__slot" + (s.slot === 0 ? " is-now" : " is-done") },
        icon("sun", { size: 13 }),
        " 낮",
      ),
      el("span", { class: "status-day__slot-arrow" }, "→"),
      el(
        "span",
        { class: "status-day__slot" + (s.slot === 1 ? " is-now" : "") },
        icon("moon", { size: 13 }),
        " 심야",
      ),
    ),
  );

  const nodes: HTMLElement[] = [
    dayHeader,
    el(
      "div",
      { class: `popup__title popup__title--${slotClass}` },
      el("span", { class: "popup__title-slot", title: SLOT_LABELS[s.slot] }, icon(slotIcon, { size: 18 })),
      el(
        "span",
        {
          class: "money-badge" + (drops.money ? " money-drop" : ""),
          style:
            "font-weight:700;font-size:12px;" +
            (s.money < 0 ? "color:var(--danger)" : ""),
        },
        icon("coin", { size: 14 }),
        `${formatNumber(s.money)}원`,
      ),
    ),
    el(
      "div",
      { class: "popup__body" },
      ...resourceRows,
      staminaRow,
      renderMoneyInfo(s),
      renderJobInfo(ctx),
      el(
        "button",
        {
          class: "link-btn",
          onclick: () => {
            detailOpen = !detailOpen;
            ctx.refresh();
          },
        },
        icon("chevron", { size: 14, className: detailOpen ? "chev chev--open" : "chev" }),
        detailOpen ? " 상세 스탯 닫기" : " 상세 스탯 보기",
      ),
    ),
  ];
  if (detailPop) nodes.push(detailPop);
  return nodes;
}

/** 시계 위에 떠 있는 팝업 형태(달력이 열리면 자리 양보) */
export function renderStatusPopup(ctx: GameContext): HTMLElement {
  return el("div", { class: "popup status-popup" }, ...statusInner(ctx));
}

/** 브라우저 오른쪽에 상시 도킹되는 스테이터스 패널 */
export function renderStatusDock(ctx: GameContext): HTMLElement {
  return el(
    "aside",
    { class: "status-dock" },
    ...statusInner(ctx),
    el(
      "div",
      { class: "status-dock__foot" },
      el(
        "div",
        { class: "life-btn-row" },
        el(
          "button",
          {
            class: "life-btn life-btn--sub",
            onclick: () => ctx.openModal(renderInventoryModal),
          },
          icon("drawer", { size: 18 }),
          "서랍장",
        ),
        el(
          "button",
          {
            class: "life-btn life-btn--sub",
            onclick: () => ctx.openModal(renderCreaturesModal),
          },
          icon("book", { size: 18 }),
          "크리처 도감",
        ),
      ),
      el(
        "div",
        { class: "life-btn-row" },
        el(
          "button",
          {
            class: "life-btn life-btn--sub",
            onclick: () => ctx.openModal(renderDollDexModal),
          },
          icon("book", { size: 18 }),
          "인형 도감",
        ),
      ),
      el(
        "div",
        { class: "life-btn-row" },
        el(
          "button",
          {
            class: "life-btn life-btn--sub",
            onclick: () => ctx.openModal(renderMissionsModal),
          },
          icon("article", { size: 18 }),
          "도전과제",
        ),
        el(
          "button",
          {
            class: "life-btn life-btn--sub",
            onclick: () => ctx.openModal(renderAchievementsModal),
          },
          icon("star", { size: 18 }),
          "업적",
        ),
      ),
      // AV 촬영은 서랍장 아래·현생살기 위. 성인/AV 톤으로 분홍(life-btn--av).
      canWorkAvNow(ctx.store.getState())
        ? el(
            "button",
            {
              class: "life-btn life-btn--av",
              onclick: () => ctx.openModal(renderAvWorkModal),
            },
            icon("camera", { size: 18 }),
            "AV 촬영 업무",
          )
        : null,
      el(
        "button",
        { class: "life-btn", onclick: () => ctx.openModal(renderOfflineModal) },
        icon("walk", { size: 18 }),
        "현생살기",
      ),
    ),
  );
}
