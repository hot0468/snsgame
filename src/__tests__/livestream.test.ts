import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { getActiveAccount } from "@/core/state";
import {
  STREAM_TYPES,
  STREAM_EVENTS,
  STREAM_EVENT_COUNT,
  CHAT_LINES,
  CHAT_NICKS,
  streamTypeById,
} from "@/data/livestream";
import {
  startingViewers,
  chatInterval,
  driftViewers,
  applyChoiceViewers,
  eventsForType,
  rollEventSequence,
  rollChatLine,
  startStream,
  finishStream,
  MIN_VIEWERS,
  CHAT_INTERVAL_MIN,
  CHAT_INTERVAL_MAX,
  STREAM_MENTAL_COST,
} from "@/systems/livestream";

/**
 * 너튜브 인방 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 * - 시청자 하한(3명) — 팔로워 0에서도 방송이 성립해야 한다. 이게 곧 진입 장벽이라
 *   별도 해금 조건을 두지 않았으므로, 하한이 깨지면 초반 방송이 통째로 죽는다.
 * - 채팅 속도가 시청자에 **반비례**하는 것(이 기능의 실시간 감각 그 자체).
 * - 선택지가 트레이드오프를 유지하는 것(순이득 선택지가 생기면 고민이 사라진다).
 */

describe("방송 타입", () => {
  it("3종이며 id가 유일하다", () => {
    expect(STREAM_TYPES).toHaveLength(3);
    expect(new Set(STREAM_TYPES.map((t) => t.id)).size).toBe(3);
  });

  it("세 타입이 서로 다른 축에서 1등이다(한 타입이 다 이기면 안 된다)", () => {
    const byReach = [...STREAM_TYPES].sort((a, b) => b.reachFactor - a.reachFactor)[0];
    const byFollower = [...STREAM_TYPES].sort((a, b) => b.followerRate - a.followerRate)[0];
    const byDonation = [...STREAM_TYPES].sort(
      (a, b) => b.donationPerViewer - a.donationPerViewer,
    )[0];
    expect(byReach.id).toBe("game");
    expect(byFollower.id).toBe("talk");
    expect(byDonation.id).toBe("vtuber");
  });

  it("모든 타입이 채팅 풀과 요구 스탯을 갖는다", () => {
    for (const t of STREAM_TYPES) {
      expect(t.skills.length, t.id).toBeGreaterThan(0);
      expect(CHAT_LINES[t.id].length, t.id).toBeGreaterThanOrEqual(10);
    }
    expect(CHAT_NICKS.length).toBeGreaterThanOrEqual(10);
  });

  it("streamTypeById가 id로 타입을 찾는다", () => {
    expect(streamTypeById("game")?.label).toBe("게임 방송");
    expect(streamTypeById("nope" as never)).toBeUndefined();
  });
});

describe("시작 시청자", () => {
  const gameType = streamTypeById("game")!;

  it("팔로워 0·스탯 0이어도 최소 3명은 보장된다", () => {
    const s = createInitialState();
    getActiveAccount(s).followers = 0;
    for (const id of gameType.skills) s.skills[id] = 0;
    for (let i = 0; i < 30; i++) {
      expect(startingViewers(s, gameType)).toBeGreaterThanOrEqual(MIN_VIEWERS);
    }
  });

  it("팔로워가 많을수록 시청자가 많다", () => {
    const low = createInitialState();
    getActiveAccount(low).followers = 100;
    const high = createInitialState();
    getActiveAccount(high).followers = 100_000;
    // 지터가 ±20%라 표본을 여러 번 뽑아 평균으로 비교한다.
    const avg = (s: typeof low) => {
      let sum = 0;
      for (let i = 0; i < 20; i++) sum += startingViewers(s, gameType);
      return sum / 20;
    };
    expect(avg(high)).toBeGreaterThan(avg(low) * 10);
  });

  it("관련 스탯이 높으면 시청자가 는다", () => {
    const dull = createInitialState();
    getActiveAccount(dull).followers = 0;
    dull.skills.game = 0;
    const pro = createInitialState();
    getActiveAccount(pro).followers = 0;
    pro.skills.game = 999;
    const avg = (s: typeof dull) => {
      let sum = 0;
      for (let i = 0; i < 20; i++) sum += startingViewers(s, gameType);
      return sum / 20;
    };
    expect(avg(pro)).toBeGreaterThan(avg(dull));
  });
});

describe("채팅 갱신 속도", () => {
  it("시청자가 많을수록 간격이 짧아진다(반비례)", () => {
    expect(chatInterval(10)).toBeGreaterThan(chatInterval(100));
    expect(chatInterval(100)).toBeGreaterThan(chatInterval(1_000));
    expect(chatInterval(1_000)).toBeGreaterThan(chatInterval(10_000));
  });

  it("하한·상한을 벗어나지 않는다", () => {
    for (const v of [0, 1, 5, 100, 5_000, 1_000_000, 99_999_999]) {
      const ms = chatInterval(v);
      expect(ms, `viewers=${v}`).toBeGreaterThanOrEqual(CHAT_INTERVAL_MIN);
      expect(ms, `viewers=${v}`).toBeLessThanOrEqual(CHAT_INTERVAL_MAX);
    }
  });

  it("대규모 방송은 하한에 붙는다", () => {
    expect(chatInterval(100_000)).toBe(CHAT_INTERVAL_MIN);
  });
});

describe("시청자 증감", () => {
  it("자연 변동은 1명 아래로 안 내려간다", () => {
    for (let i = 0; i < 50; i++) {
      expect(driftViewers(1)).toBeGreaterThanOrEqual(1);
    }
  });

  it("선택지 증감이 비율로 적용된다", () => {
    const up = { label: "", result: "", viewerDelta: 0.25 };
    const down = { label: "", result: "", viewerDelta: -0.2 };
    expect(applyChoiceViewers(1_000, up)).toBe(1_250);
    expect(applyChoiceViewers(1_000, down)).toBe(800);
  });

  it("아무리 깎여도 시청자가 1 아래로 안 내려간다", () => {
    const wipe = { label: "", result: "", viewerDelta: -1 };
    expect(applyChoiceViewers(5, wipe)).toBe(1);
    expect(applyChoiceViewers(1, wipe)).toBe(1);
  });
});

describe("선택지 이벤트", () => {
  it("모든 이벤트가 선택지 2개 이상과 결과 문구를 갖는다", () => {
    for (const e of STREAM_EVENTS) {
      expect(e.choices.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.situation.length, e.id).toBeGreaterThan(10);
      for (const c of e.choices) {
        expect(c.label.length, `${e.id}/${c.label}`).toBeGreaterThan(0);
        expect(c.result.length, `${e.id}/${c.label}`).toBeGreaterThan(10);
        expect(Math.abs(c.viewerDelta), `${e.id}/${c.label}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("이벤트 id가 유일하다", () => {
    expect(new Set(STREAM_EVENTS.map((e) => e.id)).size).toBe(STREAM_EVENTS.length);
  });

  it("타입 전용 이벤트는 그 타입에서만 나온다", () => {
    const gameOnly = STREAM_EVENTS.filter((e) => e.types?.length === 1 && e.types[0] === "game");
    expect(gameOnly.length).toBeGreaterThan(0);
    const talkPool = eventsForType("talk");
    for (const e of gameOnly) {
      expect(talkPool.find((x) => x.id === e.id), e.id).toBeUndefined();
    }
  });

  it("공용 이벤트는 전 타입에서 나온다", () => {
    const shared = STREAM_EVENTS.filter((e) => !e.types);
    expect(shared.length).toBeGreaterThan(0);
    for (const t of STREAM_TYPES) {
      const pool = eventsForType(t.id);
      for (const e of shared) {
        expect(pool.find((x) => x.id === e.id), `${t.id}/${e.id}`).toBeDefined();
      }
    }
  });

  it("각 타입 풀이 이벤트 4개를 채울 만큼 크다", () => {
    for (const t of STREAM_TYPES) {
      expect(eventsForType(t.id).length, t.id).toBeGreaterThanOrEqual(STREAM_EVENT_COUNT);
    }
  });

  it("한 방송의 이벤트 순서는 중복이 없다", () => {
    for (const t of STREAM_TYPES) {
      const seq = rollEventSequence(t.id);
      expect(seq).toHaveLength(STREAM_EVENT_COUNT);
      expect(new Set(seq.map((e) => e.id)).size, t.id).toBe(seq.length);
    }
  });

  it("채팅 한 줄은 그 타입 풀에서 나온다", () => {
    for (const t of STREAM_TYPES) {
      for (let i = 0; i < 20; i++) {
        const line = rollChatLine(t.id);
        expect(CHAT_NICKS).toContain(line.nick);
        expect(CHAT_LINES[t.id]).toContain(line.text);
      }
    }
  });
});

describe("방송 시작·종료", () => {
  it("시작하면 누적 횟수가 오르고 시간이 흐른다", () => {
    const s = createInitialState();
    const slotBefore = s.slot;
    const dayBefore = s.day;
    startStream(s, streamTypeById("talk")!);
    expect(s.streamCount).toBe(1);
    // 타임블록 1칸 — 슬롯이 넘어가거나 날짜가 바뀐다
    expect(s.slot !== slotBefore || s.day !== dayBefore).toBe(true);
  });

  it("종료 정산이 타입 계수대로 팔로워·후원금을 준다", () => {
    const s = createInitialState();
    const vtuber = streamTypeById("vtuber")!;
    const before = getActiveAccount(s).followers;
    const money = s.money;

    const r = finishStream(s, vtuber, 1_000);
    expect(r.followers).toBe(Math.round(1_000 * vtuber.followerRate));
    expect(r.donation).toBe(1_000 * vtuber.donationPerViewer);
    expect(getActiveAccount(s).followers).toBe(before + r.followers);
    expect(s.money).toBe(money + r.donation);
  });

  it("종료 시 정신력이 깎이고 관련 스탯이 오른다", () => {
    const s = createInitialState();
    s.resources.mental = 80;
    s.skills.game = 0;
    finishStream(s, streamTypeById("game")!, 500);
    expect(s.resources.mental).toBe(80 - STREAM_MENTAL_COST);
    expect(s.skills.game).toBeGreaterThan(0);
  });

  it("시청자가 많을수록 스탯이 더 오르되 상한이 있다", () => {
    const small = createInitialState();
    small.skills.game = 0;
    finishStream(small, streamTypeById("game")!, 100);

    const huge = createInitialState();
    huge.skills.game = 0;
    finishStream(huge, streamTypeById("game")!, 1_000_000);

    expect(huge.skills.game).toBeGreaterThan(small.skills.game);
    // ⚠️ 상한 STREAM_SKILL_CAP은 gainSkill에 **넣는 amount**의 상한이지 결과의 상한이 아니다
    //    (마일스톤 퍼크 배율이 그 위에 곱해져 결과는 더 클 수 있다). 시청자가 100배로 뛰어도
    //    스탯이 그만큼 뛰지 않는다는 것 — 상한이 실제로 물린다는 것만 확인한다.
    const evenHuger = createInitialState();
    evenHuger.skills.game = 0;
    finishStream(evenHuger, streamTypeById("game")!, 100_000_000);
    expect(evenHuger.skills.game).toBe(huge.skills.game);
  });
});
