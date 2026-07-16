import type { ResourceStatId, SkillStatId } from "@/core/types";

export interface StatDef {
  label: string;
  emoji: string;
  /** 표시 최대치(리소스형) 또는 성장 상한(스킬형) */
  max: number;
}

/** 스킬 전종의 성장 상한. 리소스와 달리 0~999 스케일이다. */
export const MAX_SKILL = 999;
/** 리소스 4종(행동력·정신력·도덕성·평판)의 상한. 0~100 유지. */
export const MAX_RESOURCE = 100;

export const RESOURCE_STATS: Record<ResourceStatId, StatDef> = {
  action: { label: "행동력", emoji: "", max: MAX_RESOURCE },
  mental: { label: "정신력", emoji: "", max: MAX_RESOURCE },
  morality: { label: "도덕성", emoji: "", max: MAX_RESOURCE },
  reputation: { label: "평판", emoji: "", max: MAX_RESOURCE },
};

export const SKILL_STATS: Record<SkillStatId, StatDef> = {
  fitness: { label: "운동", emoji: "", max: MAX_SKILL },
  beauty: { label: "미용", emoji: "", max: MAX_SKILL },
  vocabulary: { label: "어휘력", emoji: "", max: MAX_SKILL },
  knowledge: { label: "지식", emoji: "", max: MAX_SKILL },
  sociability: { label: "친화력", emoji: "", max: MAX_SKILL },
  comedy: { label: "개그", emoji: "", max: MAX_SKILL },
  creativity: { label: "창작", emoji: "", max: MAX_SKILL },
  lewd: { label: "음란", emoji: "", max: MAX_SKILL },
  game: { label: "게임", emoji: "", max: MAX_SKILL },
  it: { label: "IT", emoji: "", max: MAX_SKILL },
};

export const RESOURCE_STAT_IDS = Object.keys(RESOURCE_STATS) as ResourceStatId[];
export const SKILL_STAT_IDS = Object.keys(SKILL_STATS) as SkillStatId[];
