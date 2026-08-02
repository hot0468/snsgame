import type { GameState } from "@/core/types";
import {
  JOB_ADULT_SCENES,
  JOB_SCENE_CHANCE,
  type JobAdultId,
  type JobAdultScene,
} from "@/data/jobAdult";
import { PERVERT_COERCIVE_MIN } from "./adultOffline";
import { seedBlackmail } from "./blackmail";
import { clampMental, clampResource, gainSkill } from "./stats";
import { addSchedule } from "./time";
import { chance } from "@/utils/random";

/**
 * 직업별 성인 이벤트 — 근무를 한 번 마친 뒤 낮은 확률로 뜬다.
 *
 * 여섯 직업(택시·콜센터·다단계·헤어·강사·회사원)이 **같은 통로**를 쓴다. 각 직업의
 * 데이터 구조가 제각각이라(택시=승객+선택지, 콜센터=선택지 없음, 강사=회차만) 각자에
 * 끼우면 여섯 번 다른 일을 해야 한다 — 근무 뒤 공용 이벤트로 뺀 이유다.
 *
 * ⚠️ 씬 등장인물은 전부 성인이다(data/jobAdult.ts의 같은 경고와 짝).
 *
 * ⚠️ **여기서 씬을 바로 적용하지 않는다.** 근무 함수는 결과 화면을 이미 띄우는 중이라,
 *    그 자리에서 또 모달을 열면 결과가 씬에 덮인다. `pendingJobAdult`에 씬 id만 세워두고
 *    ui(app.ts)가 다음 렌더에서 띄운다 — 팔로워 티어 안내(postSlotIncreasedTo)와 같은 패턴.
 */

/** id로 씬을 찾는다. */
export function jobAdultSceneById(id: string): JobAdultScene | undefined {
  return JOB_ADULT_SCENES.find((s) => s.id === id);
}

/**
 * 지금 이 직업에서 뜰 수 있는 씬(조건 충족분 중 **강도 높은 것**). 없으면 null.
 *
 * ⚠️ 풀은 강도 내림차순이라 위에서부터 첫 매치가 곧 가장 센 씬이다 — 순서를 뒤집지 마라.
 */
export function jobSceneFor(state: GameState, job: JobAdultId): JobAdultScene | null {
  if (!state.adultMode) return null;
  for (const s of JOB_ADULT_SCENES) {
    if (s.job !== job) continue;
    // '강압/범죄 안 보기'를 켜면 비합의 씬은 통째로 건너뛴다 — 풀이 강도 내림차순이라
    // 자연히 그 아래 합의 씬으로 내려간다(현생 성인 조우와 같은 규칙).
    if (s.coercive && state.adultNoCoercion) continue;
    if (state.skills.lewd < s.minLewd) continue;
    if (state.skills.pervert < pervertGate(s)) continue;
    return s;
  }
  return null;
}

/**
 * 이 씬이 요구하는 변태력. 명시된 `minPervert`가 최우선이고, 없으면 강압 씬은
 * 현생 성인 조우와 **같은** 기본 문턱을, 일반 씬은 0을 쓴다.
 *
 * ⚠️ 문턱을 data에 적지 않고 여기서 거는 이유: 두 축(현생 조우·직업 씬)이 갈라지면
 *    "택시 강압은 250인데 골목 강압은 300"처럼 플레이어가 외워야 할 게 늘어난다.
 */
export function pervertGate(s: JobAdultScene): number {
  return s.minPervert ?? (s.coercive ? PERVERT_COERCIVE_MIN : 0);
}

/**
 * 근무 1회를 마친 자리에서 호출한다 — 확률에 걸리면 `pendingJobAdult`를 세운다.
 *
 * ⚠️ 이미 대기 중인 씬이 있으면 덮어쓰지 않는다. 덮으면 플레이어가 못 본 씬이 조용히 사라진다.
 * @returns 씬이 예약되면 true
 */
export function maybeQueueJobScene(state: GameState, job: JobAdultId): boolean {
  if (state.gameOver) return false;
  if (state.pendingJobAdult) return false;
  const scene = jobSceneFor(state, job);
  if (!scene) return false;
  if (!chance(JOB_SCENE_CHANCE)) return false;
  state.pendingJobAdult = scene.id;
  return true;
}

/**
 * 대기 중인 씬의 효과를 적용하고 플래그를 비운다(ui가 '확인'에서 부른다).
 *
 * ⚠️ **멱등해야 한다.** 렌더 중에 불리거나 두 번 눌려도 효과가 두 번 붙으면 안 된다
 *    (배구부 뒤풀이에서 실제로 그 버그를 냈다 — systems/coachCamp의 같은 경고 참조).
 */
export function resolveJobScene(state: GameState): void {
  const id = state.pendingJobAdult;
  if (!id) return;
  state.pendingJobAdult = null;
  const scene = jobAdultSceneById(id);
  if (!scene) return;

  if (scene.lewdGain) gainSkill(state, "lewd", scene.lewdGain);
  if (scene.pervertGain) gainSkill(state, "pervert", scene.pervertGain);
  state.resources.mental = clampMental(state, state.resources.mental + scene.mentalDelta);
  state.resources.morality = clampResource(state.resources.morality + scene.moralityDelta);
  if (scene.money) state.money += scene.money;
  // 촬영이 언급된 씬이면 협박의 씨를 심는다 — 며칠 뒤 카톡으로 돌아온다.
  if (scene.filmed) seedBlackmail(state, scene.filmed);
  addSchedule(state, scene.title.replace("🔞 ", ""), "offline");
}
