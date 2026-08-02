import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  JOB_ADULT_SCENES,
  JOB_SCENE_LEWD_MIN,
  JOB_SCENE_PERVERT_MIN,
  type JobAdultId,
} from "@/data/jobAdult";
import {
  jobAdultSceneById,
  jobSceneFor,
  maybeQueueJobScene,
  pervertGate,
  resolveJobScene,
} from "@/systems/jobAdult";
import { PERVERT_COERCIVE_MIN } from "@/systems/adultOffline";
import { JOB_CATALOG } from "@/systems/jobLevels";
import type { GameState } from "@/core/types";

/**
 * 직업별 성인 이벤트 테스트.
 *
 * 왜 넣었나: 직업 8종 중 AV배우와 배구부 코치를 빼면 성인 이벤트가 하나도 없었다.
 * 각 직업의 데이터 구조가 제각각이라(택시=승객+선택지, 콜센터=선택지 없음, 강사=회차만)
 * 근무 뒤 공용 이벤트로 뺐다.
 *
 * 고정하는 불변식:
 *  1) 여섯 직업 전부에 씬이 있다 — 하나라도 빠지면 그 직업만 또 비게 된다.
 *  2) 성인 모드가 꺼져 있으면 절대 안 뜬다.
 *  3) 음란만 높으면 1:1, 변태력까지 높으면 다인/하드.
 *  4) 대기 중인 씬을 덮어쓰지 않는다 — 덮으면 못 본 씬이 조용히 사라진다.
 *  5) 효과 적용은 **멱등**하다.
 *  6) 씬에 미성년자가 등장하지 않는다(콘텐츠 경계).
 */

const JOBS: JobAdultId[] = ["taxi", "callCenter", "mlm", "stylist", "lecturer", "office"];

function adult(lewd = 0, pervert = 0): GameState {
  const s = createInitialState();
  s.adultMode = true;
  s.skills.lewd = lewd;
  s.skills.pervert = pervert;
  return s;
}

describe("여섯 직업 전부에 씬이 있다", () => {
  for (const job of JOBS) {
    it(`${job}: 1:1과 다인 씬이 모두 있다`, () => {
      const pool = JOB_ADULT_SCENES.filter((s) => s.job === job);
      expect(pool.length, `${job}에 씬이 없다`).toBeGreaterThanOrEqual(2);
      expect(pool.some((s) => (s.minPervert ?? 0) > 0), `${job}에 다인 씬이 없다`).toBe(true);
      expect(pool.some((s) => !s.minPervert), `${job}에 1:1 씬이 없다`).toBe(true);
    });
  }

  it("도감의 직업 중 성인 이벤트가 없는 건 AV·코치·청부업뿐이다", () => {
    // AV는 직업 자체가 성인이고, 코치는 합숙·뒤풀이가 따로 있다(coachCamp).
    // 청부업은 성인 축이 아니라 범죄 축이라 대상이 아니다.
    const covered = new Set(JOB_ADULT_SCENES.map((s) => s.job as string));
    const exempt = new Set(["av", "coach", "killer", "author"]);
    for (const entry of JOB_CATALOG) {
      if (exempt.has(entry.id)) continue;
      expect(covered.has(entry.id), `${entry.id}(${entry.label})에 성인 이벤트가 없다`).toBe(true);
    }
  });

  it("씬 id가 중복되지 않는다", () => {
    const ids = JOB_ADULT_SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("게이트", () => {
  it("성인 모드가 꺼져 있으면 어떤 직업도 씬이 없다", () => {
    const s = adult(999, 999);
    s.adultMode = false;
    for (const job of JOBS) expect(jobSceneFor(s, job)).toBeNull();
  });

  it("음란이 모자라면 안 뜬다", () => {
    const s = adult(JOB_SCENE_LEWD_MIN - 1, 999);
    for (const job of JOBS) expect(jobSceneFor(s, job)).toBeNull();
  });

  it("음란만 높으면 1:1이 뜬다", () => {
    const s = adult(JOB_SCENE_LEWD_MIN, JOB_SCENE_PERVERT_MIN - 1);
    for (const job of JOBS) {
      const scene = jobSceneFor(s, job)!;
      expect(scene, job).toBeTruthy();
      expect(scene.minPervert ?? 0, `${job}: 변태력이 모자란데 다인 씬이 떴다`).toBe(0);
    }
  });

  it("변태력까지 높으면 다인/하드가 뜬다 — 강도 높은 쪽을 먼저 고른다", () => {
    const s = adult(JOB_SCENE_LEWD_MIN, JOB_SCENE_PERVERT_MIN);
    for (const job of JOBS) {
      expect(jobSceneFor(s, job)!.minPervert ?? 0, job).toBeGreaterThan(0);
    }
  });

  it("각 직업 풀이 강도 내림차순이다", () => {
    // ⚠️ **선언된 minPervert가 아니라 `pervertGate`(실효 문턱)로 잰다.** 강압 씬은 문턱을
    //    data에 안 적고 systems가 PERVERT_COERCIVE_MIN을 건다 — 선언값만 보면 0으로 읽혀
    //    "가장 약한 씬이 맨 앞"으로 오해된다(실제로 그렇게 짰다가 이 테스트가 잡았다).
    for (const job of JOBS) {
      const keys = JOB_ADULT_SCENES.filter((s) => s.job === job).map(
        (s) => s.minLewd + pervertGate(s),
      );
      expect(keys, job).toEqual([...keys].sort((a, b) => b - a));
    }
  });
});

describe("강압 씬", () => {
  /**
   * 강압(coercive) 씬은 현생 성인 조우와 **같은 두 규칙**을 따라야 한다:
   *  1) '강압/범죄 안 보기'(adultNoCoercion)를 켜면 안 뜬다.
   *  2) 변태력 문턱은 PERVERT_COERCIVE_MIN — 음란만 높다고 굴러오지 않는다.
   * 직업 씬만 규칙이 다르면 "택시는 250인데 골목은 300"을 외워야 한다.
   */
  const coerciveJobs = [...new Set(JOB_ADULT_SCENES.filter((s) => s.coercive).map((s) => s.job))];

  it("여섯 직업 전부에 강압 씬이 있다", () => {
    expect(coerciveJobs.sort()).toEqual([...JOBS].sort());
  });

  it("변태력이 강압 문턱에 못 미치면 안 뜬다 — 음란이 만렙이어도", () => {
    const s = adult(999, PERVERT_COERCIVE_MIN - 1);
    for (const job of JOBS) {
      expect(jobSceneFor(s, job)?.coercive ?? false, job).toBe(false);
    }
  });

  it("문턱을 넘으면 강압 씬이 가장 먼저 잡힌다 — 풀의 맨 위 등급이다", () => {
    const s = adult(999, 999);
    for (const job of JOBS) {
      expect(jobSceneFor(s, job)?.coercive, job).toBe(true);
    }
  });

  it("'강압/범죄 안 보기'를 켜면 합의 씬으로 내려간다 — 씬이 통째로 사라지지 않는다", () => {
    const s = adult(999, 999);
    s.adultNoCoercion = true;
    for (const job of JOBS) {
      const scene = jobSceneFor(s, job);
      expect(scene, `${job}: 강압을 껐더니 씬이 아예 없어졌다`).not.toBeNull();
      expect(scene!.coercive ?? false, job).toBe(false);
    }
  });

  it("강압 씬은 돈을 벌어다 주지 않는다 — 대가로 받는 자리가 아니다", () => {
    for (const s of JOB_ADULT_SCENES.filter((x) => x.coercive)) {
      expect(s.money ?? 0, s.id).toBe(0);
    }
  });

  it("강압 씬은 정신력을 크게 깎는다 — 합의 씬보다 무겁다", () => {
    const consent = JOB_ADULT_SCENES.filter((s) => !s.coercive);
    const worstConsent = Math.min(...consent.map((s) => s.mentalDelta));
    for (const s of JOB_ADULT_SCENES.filter((x) => x.coercive)) {
      expect(s.mentalDelta, s.id).toBeLessThan(worstConsent);
    }
  });
});

describe("예약과 적용", () => {
  /** 확률을 걷어내고 예약될 때까지 돌린다. */
  function queueUntil(s: GameState, job: JobAdultId): boolean {
    for (let i = 0; i < 200 && !s.pendingJobAdult; i++) maybeQueueJobScene(s, job);
    return !!s.pendingJobAdult;
  }

  it("조건이 맞으면 결국 예약된다", () => {
    const s = adult(999, 999);
    expect(queueUntil(s, "taxi")).toBe(true);
    expect(jobAdultSceneById(s.pendingJobAdult!)?.job).toBe("taxi");
  });

  it("대기 중인 씬을 덮어쓰지 않는다 — 덮으면 못 본 씬이 사라진다", () => {
    const s = adult(999, 999);
    queueUntil(s, "taxi");
    const first = s.pendingJobAdult;
    for (let i = 0; i < 200; i++) maybeQueueJobScene(s, "office");
    expect(s.pendingJobAdult).toBe(first);
  });

  it("적용하면 스탯이 오르고 플래그가 비워진다", () => {
    // ⚠️ 만렙(999)으로 세팅하면 gainSkill이 상한에 눌려 "안 올랐다"로 보인다.
    //    문턱만 넘되 여유가 남는 값을 쓴다.
    const s = adult(JOB_SCENE_LEWD_MIN + 50, JOB_SCENE_PERVERT_MIN + 50);
    queueUntil(s, "taxi");
    const before = { lewd: s.skills.lewd, money: s.money };
    resolveJobScene(s);

    expect(s.pendingJobAdult).toBeNull();
    expect(s.skills.lewd).toBeGreaterThan(before.lewd);
    expect(s.money, "택시 씬은 부수입이 있다").toBeGreaterThan(before.money);
  });

  it("두 번 적용해도 효과가 두 번 붙지 않는다", () => {
    const s = adult(JOB_SCENE_LEWD_MIN + 50, JOB_SCENE_PERVERT_MIN + 50);
    queueUntil(s, "taxi");
    resolveJobScene(s);
    const after = { lewd: s.skills.lewd, money: s.money };
    resolveJobScene(s);
    expect(s.skills.lewd).toBe(after.lewd);
    expect(s.money).toBe(after.money);
  });

  it("게임이 끝났으면 예약하지 않는다", () => {
    const s = adult(999, 999);
    s.gameOver = "끝";
    for (let i = 0; i < 200; i++) maybeQueueJobScene(s, "taxi");
    expect(s.pendingJobAdult).toBeNull();
  });

  it("성인 모드가 꺼져 있으면 예약되지 않는다", () => {
    const s = adult(999, 999);
    s.adultMode = false;
    for (let i = 0; i < 200; i++) maybeQueueJobScene(s, "taxi");
    expect(s.pendingJobAdult).toBeNull();
  });
});

describe("콘텐츠 경계 — 미성년자는 등장하지 않는다", () => {
  /**
   * 강사(인강)·회사원 씬에서 특히 조심할 선이다. 등장인물은 승객·발신자·손님·동료·
   * 상위 라인처럼 전부 성인이어야 한다.
   */
  const BANNED = ["학생", "미성년", "여고", "남고", "재학생", "1학년", "2학년", "3학년", "교복"];

  it("모든 씬 본문에 미성년자를 가리키는 말이 없다", () => {
    for (const sc of JOB_ADULT_SCENES) {
      for (const w of BANNED) {
        expect(sc.text.includes(w), `${sc.id}에 '${w}'가 있다`).toBe(false);
      }
    }
  });

  it("씬 본문이 비어 있지 않다", () => {
    for (const sc of JOB_ADULT_SCENES) {
      expect(sc.text.length, sc.id).toBeGreaterThan(100);
      expect(sc.title.length, sc.id).toBeGreaterThan(0);
    }
  });
});
