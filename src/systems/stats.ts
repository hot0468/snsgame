import { MAX_RESOURCE, MAX_SKILL } from "@/data/stats";
import type { GameState, SkillStatId } from "@/core/types";
// ④ 마일스톤 해금 퍼크(스킬 획득 배율). milestones.ts는 stats.ts를 import하지 않으므로 순환 없음.
import { perkMentalMax, perkSkillMult } from "./milestones";
import { HOUSINGS } from "@/data/housing";

/**
 * 스탯 클램프 단일 출처.
 *
 * 상한이 셋으로 갈리므로 반드시 함수를 구분해 쓴다.
 * - `state.skills.*`               → clampSkill      (0~999, 고정)
 * - `state.resources.action`       → clampAction     (0~100+actionMaxBonus, **가변**)
 * - 그 외 `state.resources.*`      → clampResource   (0~100, 고정)
 *   (= mental · morality · reputation)
 *
 * ⚠️ 셋 다 사실상 `number → number`라 오분류를 타입 검사가 잡지 못한다:
 *    - 스킬에 clampResource를 쓰면 100에서 조용히 막힌다.
 *    - 리소스에 clampSkill을 쓰면 평판·도덕성이 999까지 올라 임계값 판정이 깨진다.
 *    - **행동력에 clampResource를 쓰면 상한 보너스가 조용히 무효가 된다**:
 *      행동력 120에서 근무(15 소모) → clampResource(105) → 100. 플레이어는 이유를 알 수 없다.
 *      행동력을 건드리는 곳에서 clampResource가 보이면 그건 버그다.
 */

/** 스킬 값 클램프(0~999) */
export function clampSkill(v: number): number {
  return Math.max(0, Math.min(MAX_SKILL, v));
}

/**
 * 상한이 고정 100인 리소스(도덕성·평판) 클램프.
 * ⚠️ **행동력·정신력에는 쓰지 마라** — 둘 다 상한이 가변이다.
 *    clampAction / clampMental을 쓸 것.
 */
export function clampResource(v: number): number {
  return Math.max(0, Math.min(MAX_RESOURCE, v));
}

/**
 * 행동력의 현재 상한. 기본 100이며 작업관리자 Cheat.exe로 +20 된다(게임당 1회).
 * UI의 행동력 바 상한도 RESOURCE_STATS.action.max가 아니라 이 값을 써야 한다.
 */
export function actionMax(state: GameState): number {
  return MAX_RESOURCE + state.actionMaxBonus;
}

/**
 * 행동력 전용 클램프(0 ~ actionMax(state)).
 * 리소스 4종 중 행동력·정신력만 상한이 가변이라 상태를 인자로 받는다.
 */
export function clampAction(state: GameState, v: number): number {
  return Math.max(0, Math.min(actionMax(state), v));
}

/**
 * 현재 정신력 상한. 기본 100에 세 가지가 더해진다.
 *   - `state.mentalMaxBonus` — 영구 보너스(이벤트·치트 등에서 쓸 자리)
 *   - 현재 집(`Housing.mentalMaxBonus`) — **이사하면 즉시 바뀐다**(회복 보너스와 같은 규칙)
 *   - 마일스톤 퍽 '쉽게 지치지 않는다'
 *
 * ⚠️ UI의 정신력 바 상한도 RESOURCE_STATS.mental.max가 아니라 이 값을 써야 한다.
 * ⚠️ 집을 낮춰 이사하면 상한이 줄어든다 — 현재 정신력이 새 상한을 넘으면 다음 clampMental에서
 *    잘린다. 의도된 동작이다(좋은 집의 값어치가 유지비에 있다).
 */
export function mentalMax(state: GameState): number {
  const bonus = state.mentalMaxBonus;
  const home = HOUSINGS[state.housingTier] ?? HOUSINGS[0];
  return (
    MAX_RESOURCE +
    (Number.isFinite(bonus) ? bonus : 0) +
    (home?.mentalMaxBonus ?? 0) +
    perkMentalMax(state)
  );
}

/**
 * 정신력 전용 클램프(0 ~ mentalMax(state)).
 *
 * ⚠️ **정신력을 건드리는 곳에서 clampResource가 보이면 그건 버그다.**
 *    행동력이 겪었던 것과 같은 함정이다: 상한 120에서 8을 깎으면 clampResource가
 *    112를 100으로 눌러 보너스가 조용히 사라진다. 감소 경로에서도 반드시 이걸 써라.
 */
export function clampMental(state: GameState, v: number): number {
  return Math.max(0, Math.min(mentalMax(state), v));
}

/**
 * 행동력이 비용 이상이라 그 행동을 할 수 있는지.
 * clampAction이 0에서 바닥을 치므로 비용보다 모자라면 '행동력이 마이너스로 내려가는' 대신 조용히
 * 0으로 깎이며 행동만 수행된다 — 그걸 막으려면 UI/시스템이 실행 전 이 게이트로 걸러야 한다.
 */
export function hasAction(state: GameState, cost: number): boolean {
  return state.resources.action >= cost;
}

/** 체력 한계치(staminaMax)의 하드 실링 — 운동으로도 이 값을 넘지 못한다. */
export const STAMINA_MAX_CAP = 999;

/**
 * 체력 클램프(0 ~ state.staminaMax). 상한이 가변이라 상태를 인자로 받는다(clampAction과 같은 이유).
 * ⚠️ staminaMax가 0이면 항상 0으로 눌린다 — save.sanitize가 200 폴백을 보장한다.
 */
export function clampStamina(state: GameState, v: number): number {
  return Math.max(0, Math.min(state.staminaMax, Math.round(v)));
}

/** 체력을 n만큼 가감한다(음수도 clamp). */
export function gainStamina(state: GameState, n: number): void {
  state.stamina = clampStamina(state, state.stamina + n);
}

/** 체력 한계치가 이 값을 넘긴 만큼부터 행동력 회복 보너스가 붙는다(시작값 = 보너스 0). */
export const STAMINA_RECOVER_BASE = 200;
/** 이만큼의 staminaMax마다 아침 행동력 회복이 +1 된다. */
export const STAMINA_PER_ACTION_RECOVER = 40;
/**
 * 체력으로 얻을 수 있는 아침 행동력 회복 보너스의 상한.
 * ⚠️ 체력 만렙(`STAMINA_MAX_CAP` 999)에서 `floor((999-200)/40) = 19`이므로 **19가 실제 도달 상한**이다.
 *    이보다 큰 값을 넣으면 닿지 않는 죽은 상수가 된다(20으로 뒀다가 실제로 그랬다).
 *    `STAMINA_PER_ACTION_RECOVER`나 `STAMINA_MAX_CAP`을 바꾸면 이 값도 다시 계산하라.
 */
export const STAMINA_ACTION_RECOVER_MAX = 19;

/**
 * 체력 한계치(staminaMax)에서 파생되는 **아침 행동력 회복 보너스**(0 ~ 20).
 *
 * 운동으로 `staminaMax`가 오르면(1회당 +8) 그만큼 하루에 쓸 수 있는 행동력이 늘어난다 —
 * "수련으로 체력을 키워 더 많이 행동한다"는 육성게임의 고전 루프다.
 *   staminaMax 200(시작) → +0 · 400 → +5 · 600 → +10 · 999(만렙) → +19
 *   (운동 25회 → +5 · 50회 → +10 · 100회 → +19)
 *
 * ⚠️ **체력의 기존 역할(질병 판정)은 그대로다.** 이건 추가된 두 번째 쓰임이고,
 *    현재 체력(state.stamina)이 아니라 **한계치(staminaMax)**에서만 파생된다 —
 *    당장 지친 상태와 무관하게 "그동안 몸을 얼마나 만들었나"가 회복량을 정해야
 *    운동이 **장기 투자**가 되기 때문이다(오늘 체력이 낮다고 내일 회복이 줄면 회복 불능 나선이 된다).
 *
 * ⚠️ 상한(20)이 있는 이유: 이게 무한이면 운동만 반복하는 게 지배 전략이 된다.
 *    `SLEEP_ACTION_RECOVER`(45)와 합쳐 최대 65 — 무거운 활동 2개(57)가 겨우 들어가는 선이다.
 */
export function staminaActionBonus(state: GameState): number {
  const over = (state.staminaMax ?? STAMINA_RECOVER_BASE) - STAMINA_RECOVER_BASE;
  if (!Number.isFinite(over) || over <= 0) return 0;
  return Math.min(STAMINA_ACTION_RECOVER_MAX, Math.floor(over / STAMINA_PER_ACTION_RECOVER));
}

/**
 * 스킬 0~999 값을 구 0~100 스케일로 환산하는 제수(9.99).
 * 스킬 상한이 100이던 시절의 계수·공식을 그대로 쓰되 밸런스를 보존할 때 나눈다.
 */
export const SKILL_SCALE = MAX_SKILL / 100;

/**
 * 스킬 값(0~999)을 0~100 지수로 환산한다.
 * 스킬 만렙(999) → 100. 0~100 기준으로 설계된 파생 지표
 * (취업 역량·매력 등)와 데이터 임계값을 그대로 유지하기 위한 다리.
 */
export function skillTo100(v: number): number {
  return v / SKILL_SCALE;
}

/**
 * 반복 grind 소스의 스킬 상승 감쇠 계수. 스킬이 높을수록 획득이 줄어
 * 능동 플레이 만렙 도달을 2달→~5달대로 늦춘다. content-author가 미세조정한다.
 */
export const SKILL_GAIN_DECAY = 0.8;

/* ─────────────────── 정신력 → 육성 효율 ─────────────────── */

/**
 * 정신력이 이 값 이상이면 육성 효율 보너스가 붙기 시작한다(100에서 최대).
 * 이 값 아래로는 보너스 없이 페널티 구간으로 넘어간다.
 */
export const MENTAL_EFF_HIGH = 70;
/** 정신력 100일 때의 스킬 획득 배율(최대치). */
export const MENTAL_EFF_MAX = 1.25;
/** 정신력 0일 때의 스킬 획득 배율(최소치). 컨디션이 바닥이면 뭘 해도 잘 안 는다. */
export const MENTAL_EFF_MIN = 0.4;

/**
 * 현재 정신력에 따른 **스킬 획득 배율**(0.4 ~ 1.25).
 *
 * 정신력을 육성의 단일 축으로 세우는 장치다 — 컨디션 관리가 곧 육성 효율이 된다.
 *   정신력  0 → 0.40배 · 20 → 0.57배 · 50 → 0.83배 · 70 → 1.00배 · 85 → 1.13배 · 100 → 1.25배
 * MENTAL_EFF_HIGH(70)를 기준선 1.0으로 두어, 평범하게 관리하면 현행과 같고
 * 방치하면 눈에 띄게 손해, 잘 관리하면 소폭 이득인 비대칭 곡선이다(선형 2구간).
 *
 * ⚠️ UI가 활동 선택 시 이 값을 그대로 표시해야 플레이어가 컨디션 관리를 학습한다.
 */
export function mentalEfficiency(state: GameState): number {
  const m = clampResource(state.resources.mental);
  if (m >= MENTAL_EFF_HIGH) {
    // 70~100 → 1.0~1.25
    return 1 + ((m - MENTAL_EFF_HIGH) / (MAX_RESOURCE - MENTAL_EFF_HIGH)) * (MENTAL_EFF_MAX - 1);
  }
  // 0~70 → 0.4~1.0
  return MENTAL_EFF_MIN + (m / MENTAL_EFF_HIGH) * (1 - MENTAL_EFF_MIN);
}

/**
 * 스킬 획득 옵션.
 *
 * `flat: true`는 **정신력 배율·퍼크 배율·상단 감쇠를 전부 면제**하고 선언값을 액면 그대로 지급한다.
 *
 * ⚠️ **남발하면 정신력 단일 축이 무너진다.** 기본은 언제나 배율 적용(`flat` 없음)이고,
 *    아래 두 조건을 **모두** 만족할 때만 면제한다:
 *      ① 지급량이 화면에 **미리 확정 고지**된다(도전과제 보상 목록·상점 표기 등).
 *      ② 플레이어가 그 대가를 **이미 치렀다**(과제 달성·돈 지불 등 선행 조건 완료).
 *    즉 "컨디션에 따라 변동해도 되는 성장"이 아니라 **"약속한 지급"**일 때만이다.
 *    반복 육성 행동(운동·교양·촬영 등)에 붙이면 컨디션 관리를 우회하는 구멍이 된다.
 *
 * 현재 면제 대상(전부 위 ①②를 만족한다):
 *   - 도전과제(미션) 보상 — `systems/missions.ts`의 `grantReward`
 *   - 유상 구매 부스트 — `shop.buyItem` · `adMail.buyFromAdOffer` · `goblin.buyGoblinItem`
 *     (상점 표기가 곧 고지, 정가 지불이 곧 대가. **되팔이 대칭**도 여기 걸려 있다:
 *      `shop.sellOwnedItem`이 선언값 `boost`를 그대로 회수하므로 지급이 액면이 아니면
 *      사고팔 때마다 스탯이 순손실된다.)
 *   - 주거 영구 스탯 — `housing.moveToHousing`(집 목록 표기 + 계약금 지불).
 *     계약한 집의 `permaSkills`만 1회 지급하며, 이사해도 회수하지 않는다(영구).
 *   - 뒷거래 스탯 부스트 — `statBoost.resolveBoostDeal`(30만원 선지불 + "확 올려드립니다")
 *   - 1회성 확정 보상 — `auction`의 진홍안 양도·게임기 리뷰
 *   - 성인 시나리오 확정 지급 — `events.ts`의 난교 계열(서사가 규모를 이미 확정 고지)
 *
 * ⚠️ **반복 가능한 활동은 위 목록에 없다**: 독서·스터디·영상 감상·야밤/푸시타임 감상·
 *    모텔 만남·야외 촬영·코믹콘 등은 전부 배율을 탄다. 새 활동을 flat으로 올리기 전에
 *    "이걸 반복해서 육성할 수 있는가"를 먼저 물어라 — 그렇다면 flat이 아니다.
 */
export interface SkillGainOpts {
  /** 배율·감쇠를 면제하고 액면 그대로 지급(위 조건 ①②를 모두 만족할 때만). */
  flat?: boolean;
}

/**
 * 스킬 획득 공식의 **단일 출처**. `gainSkill`(실제 지급)과 `projectSkillGain`(미리보기)이
 * 둘 다 이 함수를 통과하므로 공식이 갈라질 수 없다.
 *
 * ⚠️ 이 함수를 복사해 다른 곳에서 다시 계산하지 마라 — 튜닝 때 반드시 어긋난다.
 * 배율을 바꿀 일이 생기면 여기 한 곳만 고치면 실제 지급과 미리보기가 함께 따라온다.
 *
 * @param before 적용 전 스킬 값(감쇠 기준).
 * @param amount 선언된 획득량(음수면 배율 없이 그대로 통과 — gainSkill의 대원칙).
 * @param opts.flat true면 배율·감쇠를 전부 건너뛰고 액면 그대로 지급한다(FLAT_GAIN 참조).
 * @returns 반올림된 스킬 변화량(clamp 전).
 */
function skillGainDelta(
  state: GameState,
  before: number,
  amount: number,
  opts?: SkillGainOpts,
): number {
  if (opts?.flat) return Math.round(amount);
  const eff =
    amount > 0
      ? amount *
        mentalEfficiency(state) *
        perkSkillMult(state) *
        (1 - SKILL_GAIN_DECAY * (before / MAX_SKILL))
      : amount;
  return Math.round(eff);
}

/**
 * **미리보기 투영** — `amount`를 지금 지급하면 스킬이 실제로 얼마나 변하는지 예고한다.
 * 상태를 **변경하지 않는다**(순수 함수).
 *
 * ⚠️ **`gainSkill`과 반드시 같은 결과를 내야 한다.** 같은 `state`·`key`·`amount`에 대해
 *    `projectSkillGain(state, key, amount) === gainSkill(state, key, amount)`가 불변식이며
 *    `__tests__/skillProjection.test.ts`가 이를 강제한다. 두 함수는 공식(`skillGainDelta`)과
 *    클램프(`clampSkill`)를 공유하므로, 어느 한쪽만 고치는 일이 없게 하라.
 *
 * ⚠️ **등급(fail 0.25배 / great 1.8배)은 여기서 곱하지 않는다.** 굴림 전이라 알 수 없고,
 *    기대값을 곱하면 "확률이 이미 반영된 숫자"가 되어 정상 판정 때 예고보다 많이 나오는
 *    새로운 괴리가 생긴다. 역할 분담: **숫자는 결정적 부분만 정확히, 확률은 컨디션 배너가.**
 *
 * @returns 실제 반영될 델타(음수 포함). 999 상한/0 하한에 걸리면 그만큼 줄어든 값.
 */
export function projectSkillGain(
  state: GameState,
  key: SkillStatId,
  amount: number,
  opts?: SkillGainOpts,
): number {
  const before = state.skills[key];
  return clampSkill(before + skillGainDelta(state, before, amount, opts)) - before;
}

/**
 * 스킬 획득 공용 헬퍼 — 반복 소스(오프라인 활동·AV 촬영·사바나·정기런·이벤트 등)의
 * 스킬 상승을 여기로 라우팅해 상단 감쇠와 정신력 배율을 한 지점에서 건다.
 * `eff = amount * mentalEfficiency * perkSkillMult * (1 - SKILL_GAIN_DECAY * skill/MAX_SKILL)` 후 clampSkill.
 *
 * ⚠️ 감쇠도 정신력 배율도 **획득(양수)에만** 건다 — 음수(페널티/드롭/반대급부)는 그대로 통과시켜
 *    ① 스킬이 높을수록 페널티가 약해지는 역효과와
 *    ② 정신력이 낮을수록 감소도 덜 아픈 역효과를 함께 막는다.
 *    반대급부 스탯 감소(offline.ts의 음수 skillGains)가 이 경로를 타므로 특히 중요하다.
 *
 * ⚠️ **정신력 배율은 오프라인 활동뿐 아니라 gainSkill의 모든 호출처에 파급된다** —
 *    AV 촬영·사바나·코스프레·EBS·이벤트·도전과제 보상까지 전부. 이는 **의도된 설계**다:
 *    "컨디션이 나쁘면 뭘 해도 덜 는다"가 정신력을 육성의 단일 축으로 만드는 핵심이고,
 *    오프라인만 예외로 두면 플레이어가 컨디션을 무시하고 다른 경로로 우회한다.
 *    배율을 피해야 하는 획득처(순수 보상·시나리오 확정 지급 등)는 gainSkill을 우회하지 말고
 *    `opts.flat`으로 면제하라 — 그래야 관문이 하나로 남는다. 면제 허용 조건은 `SkillGainOpts` 참조.
 *
 * ⚠️ 지급 전 예고가 필요하면 여기 공식을 UI에서 재현하지 말고 `projectSkillGain`을 써라.
 *    둘은 `skillGainDelta`를 공유하므로 반드시 같은 결과를 낸다.
 *
 * @returns 실제 반영된 델타(상한 clamp·감쇠·정신력 배율 후).
 */
export function gainSkill(
  state: GameState,
  key: SkillStatId,
  amount: number,
  opts?: SkillGainOpts,
): number {
  const before = state.skills[key];
  state.skills[key] = clampSkill(before + skillGainDelta(state, before, amount, opts));
  return state.skills[key] - before;
}
