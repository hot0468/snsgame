import type { Email, GameState } from "@/core/types";
import type { Certification } from "@/data/certifications";
import { CERTIFICATIONS } from "@/data/certifications";
import { chance, uid } from "@/utils/random";
import { skillTo100 } from "./stats";
import { addSchedule } from "./time";

/**
 * 자격증 시험 시스템.
 * - 네이놈에 "자격증"을 검색하면 O넷이 열리고, 매일 5종이 노출된다.
 * - 응시료를 내고 신청하면 합격 여부가 그 자리에서 확정되고, 3일 뒤 피메일로 통보된다.
 * - 취득한 자격증은 취업 성공률 보너스를 준다(employment.successChance).
 *
 * ⚠️ employment.ts → certification.ts 방향만 import한다(역참조 시 순환).
 */

/** O넷 목록에 하루에 노출되는 자격증 수 */
export const ONET_DAILY_SLOTS = 5;
/** 시험 신청부터 결과 메일까지 걸리는 일수 */
export const EXAM_RESULT_DELAY = 3;

/**
 * 문자열 시드 → 32bit 정수 해시(결정론적).
 *
 * ⚠️ ui/shop.ts의 `h*31 + c` 곱셈 해시를 그대로 쓰면 안 된다. 그 방식은 선형이라
 *    시드가 `${id}:${day}` 꼴일 때 day만 바뀌면 모든 후보의 해시에 '같은 상수'가 더해진다.
 *    상수 덧셈은 mod 2^32에서 순서를 거의 보존하므로(오버플로로 되감기는 소수만 예외)
 *    날짜가 바뀌어도 상위 슬롯이 특정 자격증에 고정돼 버린다.
 *    그래서 마지막에 murmur3 방식의 아발란치 믹싱으로 선형성을 깬다.
 */
function hashInt(seed: string): number {
  let h = 2166136261; // FNV offset basis
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0; // FNV-1a
  }
  // murmur3 fmix32 — 입력 1비트 변화가 출력 전 비트로 퍼진다.
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** id → Certification */
export function certById(id: string): Certification | undefined {
  return CERTIFICATIONS.find((c) => c.id === id);
}

/**
 * 오늘 O넷에 뜨는 자격증 5종.
 * day를 시드로 한 결정론적 해시로 고르므로 같은 날 몇 번을 다시 그려도 목록이 같다.
 * (Math.random 금지) 이미 취득한 자격증은 후보에서 제외한다.
 * 후보가 5종 미만이면 있는 만큼만 반환한다(목록이 비어 있어도 크래시하지 않는다).
 */
export function todaysCertifications(state: GameState): Certification[] {
  const owned = new Set(state.certifications ?? []);
  const pool = CERTIFICATIONS.filter((c) => !owned.has(c.id));
  // (id, day) 쌍마다 독립적인 해시를 뽑아 정렬 → 날짜가 바뀌면 순위가 완전히 재편된다.
  // 해시 충돌 시엔 id로 갈라 정렬을 결정론적으로 유지한다.
  const key = new Map(pool.map((c) => [c.id, hashInt(`${c.id}:${state.day}`)]));
  return [...pool]
    .sort((a, b) => key.get(a.id)! - key.get(b.id)! || (a.id < b.id ? -1 : 1))
    .slice(0, ONET_DAILY_SLOTS);
}

/**
 * 자격증 취득 점수(0~100). cert.skills의 가중 평균을 0~100으로 환산한다.
 * 스킬은 0~999 스케일이므로 skillTo100으로 환산해야 requirement(0~100)와 비교된다
 * (employment.competence와 같은 방식).
 */
export function examScore(state: GameState, cert: Certification): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const [skill, weight] of Object.entries(cert.skills)) {
    if (!weight) continue;
    weighted += (state.skills[skill as keyof typeof state.skills] ?? 0) * weight;
    totalWeight += weight;
  }
  // 가중치 합이 1.0이 아니어도(데이터 실수) 정규화해 0~100을 유지한다.
  if (totalWeight <= 0) return 0;
  return Math.round(skillTo100(weighted / totalWeight));
}

/** 합격 확률(0~1) — employment.successChance와 같은 곡선 */
export function examPassChance(state: GameState, cert: Certification): number {
  const gap = examScore(state, cert) - cert.requirement;
  return Math.max(0.05, Math.min(0.95, 0.5 + gap / 80));
}

/** 이미 취득한 자격증인지 */
export function hasCertification(state: GameState, certId: string): boolean {
  return (state.certifications ?? []).includes(certId);
}

/** 신청 가능한지 — 미취득 + 대기 중 시험 없음 + 응시료 지불 가능 */
export function canApplyExam(state: GameState, cert: Certification): boolean {
  if (state.gameOver) return false;
  if (hasCertification(state, cert.id)) return false;
  if (state.pendingExam) return false;
  return state.money >= cert.fee;
}

/**
 * 시험을 신청한다. 응시료를 내고 합격 여부를 그 자리에서 확정해 두었다가
 * EXAM_RESULT_DELAY일 뒤 피메일로 통보한다.
 * ⚠️ 시간(advanceTime)은 소모하지 않는다 — submitJobApplication과 동일.
 * @returns 신청에 성공했으면 true
 */
export function applyExam(state: GameState, cert: Certification): boolean {
  if (!canApplyExam(state, cert)) return false;
  state.money -= cert.fee;
  state.pendingExam = {
    certId: cert.id,
    passed: chance(examPassChance(state, cert)),
    resultDay: state.day + EXAM_RESULT_DELAY,
  };
  addSchedule(state, `${cert.name} 시험 응시`, "system");
  return true;
}

/**
 * 결과 대기 중인 시험이 있고 결과일이 되면, 합격/불합격 메일을 수신함에 넣는다.
 * 합격이면 자격증을 취득한다. time.onNewDay에서 매일 호출된다.
 * ⚠️ 메일은 정보 전달용 — jobOffer/adOffer/spam은 절대 세팅하지 않는다.
 */
export function deliverExamResultEmail(state: GameState): void {
  const exam = state.pendingExam;
  if (!exam || state.day < exam.resultDay) return;
  state.pendingExam = null;

  const cert = certById(exam.certId);
  // 데이터에서 사라진 자격증이면 조용히 대기만 해제한다(구세이브 대비).
  if (!cert) return;
  if (exam.passed && !hasCertification(state, cert.id)) {
    state.certifications.push(cert.id);
  }

  const bonusText = `${Math.round(cert.jobBonus * 100)}%p`;
  const email: Email = exam.passed
    ? {
        id: uid("mail"),
        from: `${cert.issuer} 자격시험부`,
        subject: `[합격] ${cert.name} 자격시험 합격 통지`,
        body:
          `안녕하세요, ${cert.issuer} 자격시험부입니다.\n\n` +
          `${cert.name} 시험에 응시해 주셔서 감사합니다. 채점 결과 합격하셨음을 알려드립니다!\n\n` +
          `자격증은 프로필 세부 스탯에서 확인하실 수 있으며, 앞으로 채용 지원 시 합격률이 ` +
          `${bonusText} 상승합니다.\n\n축하드립니다.`,
        day: state.day,
        read: false,
      }
    : {
        id: uid("mail"),
        from: `${cert.issuer} 자격시험부`,
        subject: `[불합격] ${cert.name} 자격시험 결과 안내`,
        body:
          `안녕하세요, ${cert.issuer} 자격시험부입니다.\n\n` +
          `${cert.name} 시험에 응시해 주셔서 감사합니다. 아쉽게도 이번 회차에서는 ` +
          `기준 점수에 도달하지 못하셨습니다.\n\n` +
          `응시료는 반환되지 않습니다. 실력을 더 쌓아 다음 회차에 다시 도전해 보세요.`,
        day: state.day,
        read: false,
      };

  state.emails.unshift(email);
  addSchedule(state, exam.passed ? `${cert.name} 합격!` : `${cert.name} 불합격`, "system");
}

/**
 * 보유 자격증의 취업 성공률 보너스 합(0~1).
 * 상한은 successChance의 클램프(0.95)가 잡으므로 여기서 따로 막지 않는다.
 */
export function certJobBonus(state: GameState): number {
  let sum = 0;
  for (const id of state.certifications ?? []) {
    sum += certById(id)?.jobBonus ?? 0;
  }
  return sum;
}
