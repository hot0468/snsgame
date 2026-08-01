/**
 * 일일/주간 도전과제 — 리셋·진행 누적·보상 자동 지급.
 * 정의·추첨(순수)은 data/missions.ts, UI는 missionsModal이 호출한다.
 *
 * recordMission은 각 행동이 확정되는 systems 지점(postTweet·onLikeTweet·onRetweet·
 * followAccount·doOffline)에서 불린다 — UI가 아니라 규칙 계층에서 세어 세이브 정합을 지킨다.
 * **달성하는 즉시 보상을 지급하고** id를 state.pendingMissions에 쌓는다(app이 토스트로 알린 뒤 비운다 —
 * pendingAchievements/pendingMilestones와 동일 패턴). 수동 '받기' 단계는 없다.
 */
import type { GameState, MissionInstance } from "@/core/types";
import {
  rollDaily,
  rollWeekly,
  currentWeek,
  missionDef,
  type MissionMetric,
  type MissionReward,
} from "@/data/missions";
import { SKILL_STATS } from "@/data/stats";
import { clampAction, clampMental, gainSkill } from "./stats";
import { changeFollowers } from "./followers";

/** 날짜/주차가 바뀌었으면 해당 미션 세트를 다시 굴린다(onNewDay·세이브 마이그레이션에서 호출). */
export function ensureMissions(state: GameState): void {
  if (state.missions.day !== state.day) {
    state.missions.daily = rollDaily(state.day);
    state.missions.day = state.day;
  }
  const wk = currentWeek(state.day);
  if (state.missions.week !== wk) {
    state.missions.weekly = rollWeekly(wk);
    state.missions.week = wk;
  }
}

/**
 * 보상을 상태에 즉시 지급한다.
 *
 * ⚠️ 스킬 보상은 `flat: true`로 **정신력 배율·감쇠를 면제**한다. 도전과제 보상은 육성 행동이 아니라
 *    이미 달성한 과제에 대한 **약속된 지급**이라, 목록에 "어휘력 +15"로 미리 고지한 값이 그대로
 *    들어와야 한다. 배율을 걸면 (1) 고지값과 실지급이 어긋나고 (2) 컨디션 나쁜 시기에 과제를
 *    깬 플레이어가 이중으로 손해를 본다. 면제 허용 조건은 `SkillGainOpts` 주석 참조.
 */
function grantReward(state: GameState, r: MissionReward): void {
  if (r.money) state.money += r.money;
  if (r.action) state.resources.action = clampAction(state, state.resources.action + r.action);
  if (r.mental) state.resources.mental = clampMental(state, state.resources.mental + r.mental);
  if (r.followers) changeFollowers(state, r.followers);
  if (r.skills) {
    for (const [k, v] of Object.entries(r.skills)) {
      gainSkill(state, k as never, v as number, { flat: true });
    }
  }
}

/**
 * 해당 metric의 미완료 미션 진행도를 n만큼 올린다(일일·주간 동시).
 * 이번에 목표를 채운 미션은 **즉시 보상 지급 + claimed 표시 + pendingMissions에 큐잉**한다.
 */
export function recordMission(state: GameState, metric: MissionMetric, n = 1): void {
  const advance = (inst: MissionInstance) => {
    const def = missionDef(inst.id);
    if (!def || def.metric !== metric || inst.claimed) return;
    inst.progress = Math.min(def.goal, inst.progress + n);
    if (inst.progress >= def.goal) {
      inst.claimed = true;
      grantReward(state, def.reward);
      state.pendingMissions.push(inst.id);
    }
  };
  state.missions.daily.forEach(advance);
  state.missions.weekly.forEach(advance);
}

/** 미션이 달성됐는지(UI 상태 표시용) */
export function isMissionDone(inst: MissionInstance): boolean {
  const def = missionDef(inst.id);
  return !!def && inst.progress >= def.goal;
}

/**
 * 보상을 사람이 읽는 문구로(토스트·모달 공용).
 *
 * 스킬 보상은 `grantReward`가 `flat: true`로 액면 지급하므로 **선언값을 그대로 써도 정확하다**
 * (오프라인 활동 미리보기와 달리 `projectSkillGain`이 필요 없는 이유).
 * 유일한 예외는 스킬이 이미 999라 상한에 걸리는 경우인데, 만렙 표시 문제라 무시한다.
 */
export function describeMissionReward(r: MissionReward): string {
  const parts: string[] = [];
  if (r.money) parts.push(`💰 ${r.money.toLocaleString("ko-KR")}원`);
  if (r.action) parts.push(`⚡ 행동력 +${r.action}`);
  if (r.mental) parts.push(`🧠 정신력 +${r.mental}`);
  if (r.followers) parts.push(`👥 팔로워 +${r.followers.toLocaleString("ko-KR")}`);
  if (r.skills) {
    for (const [k, v] of Object.entries(r.skills)) {
      parts.push(`📈 ${SKILL_STATS[k as keyof typeof SKILL_STATS].label} +${v}`);
    }
  }
  return parts.join(" · ");
}
