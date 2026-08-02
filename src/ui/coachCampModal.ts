import type { GameContext } from "./context";
import type { CampAdultScene } from "@/data/coachCamp";
import {
  AFTERPARTY_SFW_LINES,
  ALUMNI_SCENE,
  CAMP_DAYS,
  CAMP_OFFER_HINT,
  CAMP_OFFER_LEAD,
  CAMP_OFFER_TITLE,
} from "@/data/coachCamp";
import {
  CAMP_SLOTS,
  applyScene,
  campAfterpartyScene,
  campResultLine,
  goToCamp,
  holdAlumniMeet,
  holdNationalParty,
  nationalAfterpartyScene,
  skipCamp,
} from "@/systems/coachCamp";
import { COACH_STAT_TARGET, NATIONAL_CHAMPION_RAISE, teamStrength } from "@/systems/coach";
import { advanceTime } from "@/systems/time";
import { el } from "@/utils/dom";
import { pick } from "@/utils/random";
import { icon } from "./icons";

/**
 * 배구부 여름 합숙 + 뒤풀이 성인 씬 화면.
 *
 * 한 모달 안에서 제안 → 결과 → (성인 모드면) 뒤풀이 씬으로 이어진다.
 * 씬을 별도 모달로 띄우지 않는 이유: 합숙 결과를 확인하고 닫는 순간 다른 강제 팝업이
 * 끼어들면 뒤풀이가 통째로 유실된다(app의 팝업 사슬은 한 번에 하나만 잡는다).
 *
 * ⚠️ **시간 진행은 여기서 한다.** `goToCamp` 뒤에 `advanceTime`을 부르는 순서를 지켜라 —
 *    뒤집으면 하루치 회복이 0으로 눌린 행동력·정신력 위에 덮여 "갈아 넣은 티"가 사라진다.
 */
export function renderCoachCampModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  /** 성인 씬(또는 성인 모드가 꺼졌을 때의 담백한 마무리). */
  function showScene(scene: CampAdultScene | null): void {
    if (!scene) {
      showClosing(pick(AFTERPARTY_SFW_LINES as string[]));
      return;
    }
    ctx.update((st) => applyScene(st, scene));
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, scene.title),
      ),
      el(
        "div",
        { class: "modal__body" },
        el("p", { class: "camp__scene" }, scene.text),
        el(
          "div",
          { class: "compose-actions" },
          el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
        ),
      ),
    );
  }

  /** 성인 씬이 없을 때의 마무리 한 줄. */
  function showClosing(text: string): void {
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("walk", { size: 18 }), "뒤풀이"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el("p", { class: "taxi__scene" }, text),
        el(
          "div",
          { class: "compose-actions" },
          el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
        ),
      ),
    );
  }

  /** 합숙을 다녀온 뒤 — 변화량을 보여주고 뒤풀이로 넘어간다. */
  function showResult(): void {
    const s = ctx.store.getState();
    const strength = teamStrength(s);
    const scene = campAfterpartyScene(s);
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("walk", { size: 18 }), "합숙 종료"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el("p", { class: "taxi__scene" }, campResultLine()),
        el(
          "div",
          { class: "taxi__payout" },
          el("span", { class: "taxi__fare" }, `팀 완성도 ${strength}/${COACH_STAT_TARGET}`),
          el("span", { class: "taxi__rating taxi__rating--down" }, "행동력·정신력 소진"),
        ),
        el(
          "div",
          { class: "compose-actions" },
          el(
            "button",
            { class: "btn", onclick: () => showScene(scene) },
            scene ? "뒤풀이로" : "확인",
          ),
        ),
      ),
    );
  }

  /** 첫 화면 — 갈지 말지. */
  function showOffer(): void {
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, CAMP_OFFER_TITLE),
      ),
      el(
        "div",
        { class: "modal__body" },
        el("p", { class: "taxi__scene" }, CAMP_OFFER_LEAD),
        el("p", { class: "compose-hint" }, CAMP_OFFER_HINT),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el(
            "button",
            {
              class: "btn btn--ghost",
              onclick: () => {
                ctx.update((st) => skipCamp(st));
                ctx.closeModal();
                ctx.toast("올해 합숙은 보내지 않기로 했다");
              },
            },
            "이번엔 안 간다",
          ),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                ctx.update((st) => {
                  goToCamp(st);
                  advanceTime(st, CAMP_SLOTS); // 순서 주의: 효과 → 시간
                });
                showResult();
              },
            },
            `합숙 간다 (${CAMP_DAYS}일)`,
          ),
        ),
      ),
    );
  }

  showOffer();
  return container;
}

/**
 * 씬 하나만 보여주고 '확인'에서 효과를 적용하는 공용 화면.
 *
 * ⚠️ **렌더 중에 `ctx.update`를 부르지 마라.** update는 재렌더를 부르고, 재렌더는 이 함수를
 *    다시 부른다 — 처음에 그렇게 짰다가 전국체전 뒤풀이가 재렌더마다 음란·변태력을 다시
 *    올리는 걸 발견했다. 효과는 사용자가 확인을 누르는 그 순간 한 번만 적용한다
 *    (연 1회 도장도 같은 자리에서 찍는다).
 */
function sceneModal(
  ctx: GameContext,
  scene: CampAdultScene | null,
  commit: (st: Parameters<Parameters<GameContext["update"]>[0]>[0]) => void,
  fallbackTitle: string,
): HTMLElement {
  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, scene ? scene.title : fallbackTitle),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { class: scene ? "camp__scene" : "taxi__scene" },
        scene ? scene.text : pick(AFTERPARTY_SFW_LINES as string[]),
      ),
      el(
        "div",
        { class: "compose-actions" },
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              ctx.update(commit);
              ctx.closeModal();
            },
          },
          "확인",
        ),
      ),
    ),
  );
}

/** 전국체전 직후 뒤풀이. */
export function renderNationalAfterpartyModal(ctx: GameContext): HTMLElement {
  const scene = nationalAfterpartyScene(ctx.store.getState());
  return sceneModal(ctx, scene, (st) => holdNationalParty(st), "회식");
}

/**
 * 전국체전 **우승** 축하 팝업 — 우승한 그날 아침에 뜬다(coach.maybeHoldMeet이 예약).
 *
 * 대회 결과는 원래 일정 한 줄과 카톡 두 줄로만 알렸다. 코치 직업에서 가장 큰 사건인데
 * 스크롤에 묻혀 지나가서, 우승만은 화면을 멈춰 세우고 알린다.
 *
 * ⚠️ **어느 버튼을 누르든 `pendingCoachChampion`을 비운다.** 안 비우면 매 렌더마다 다시 뜬다.
 * ⚠️ 뒤풀이로 이어질 때 `holdNationalParty`가 그 해 도장(`nationalPartyYear`)을 찍으므로,
 *    다음 날 `isNationalAfterDay`가 false가 되어 뒤풀이가 두 번 열리지 않는다.
 */
export function renderChampionModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const job = s.coachJob;
  const year = s.pendingCoachChampion;
  // 뒤풀이 씬이 있으면(성인 모드·음란 문턱) 축하 팝업이 그대로 그 자리로 이어진다.
  const hasParty = nationalAfterpartyScene(s) !== null;

  const clear = (): void => {
    ctx.update((st) => {
      st.pendingCoachChampion = null;
    });
  };

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("star", { size: 18 }), "전국체전 우승!"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { class: "camp__scene" },
        `마지막 세트가 끝나는 순간 코트 위로 아이들이 쏟아져 나왔다. 벤치에 있던 애들까지 뛰어들어 ` +
          `서로를 끌어안고 울었다. ${year ?? ""}년 전국체전 우승. 현수막에 학교 이름이 걸리고, ` +
          `체육부장이 코트 밖에서 두 팔을 번쩍 들어 보였다.\n\n` +
          `“코치님, 진짜 해냈습니다.” 주장이 땀범벅인 채로 달려와 손을 잡았다. ` +
          (job ? `통산 ${job.championships}회째 우승이다. ` : "") +
          `내년부터 월급이 ${NATIONAL_CHAMPION_RAISE.toLocaleString("ko-KR")}원 더 오른다.`,
      ),
      el(
        "div",
        { class: "compose-actions" },
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              clear();
              if (hasParty) {
                ctx.openModal(renderNationalAfterpartyModal);
                return;
              }
              ctx.closeModal();
            },
          },
          hasParty ? "뒤풀이 자리로 간다" : "확인",
        ),
      ),
    ),
  );
}

/** 이듬해 2월 졸업생 모임. 씬이 고정(ALUMNI_SCENE)이라 그대로 쓴다. */
export function renderAlumniModal(ctx: GameContext): HTMLElement {
  return sceneModal(ctx, ALUMNI_SCENE, (st) => holdAlumniMeet(st), "졸업생 모임");
}
