/**
 * 마라톤 대회 — 운동 스탯을 '증명'으로 바꾸는 축.
 * 참가비를 내고 신청하면 RACE_DELAY_DAYS 뒤 대회일에 기록이 나온다(systems/marathon.ts).
 *
 * 기록 판정은 운동 스킬(0~999)과 체력 한계치(staminaMax)에서 파생된다 —
 * 데이터는 코스와 목표 기록만 선언하고, 계산은 systems가 한다.
 */
export interface Race {
  id: string;
  name: string;
  emoji: string;
  /** 코스 거리(km) */
  km: number;
  /** 참가비(원) */
  fee: number;
  /**
   * 완주 인정 제한 시간(분). 이 안에 들어와야 완주다.
   *
   * ⚠️ **최소 요구 운동(minFitness) 스펙이면 완주는 되도록** 잡혀 있다 —
   *    참가비를 내고 확정 실패하는 코스는 도전이 아니라 벌금이다.
   *    난이도는 podium(입상)이 담당한다. `expectedRecord`로 실측하고 바꿔라.
   */
  cutoff: number;
  /** 이 기록(분) 안에 들어오면 입상 — 상금과 팔로워가 크게 붙는다 */
  podium: number;
  /** 완주 상금(원). 입상하면 2배 */
  prize: number;
  /** 완주 시 팔로워 증가분(입상하면 2배) */
  followers: number;
  /** 이 코스에 도전할 수 있는 최소 운동 스킬(0~999) */
  minFitness: number;
}

export const RACES: Race[] = [
  {
    id: "run5k",
    name: "한강 5K 런",
    emoji: "🏃",
    km: 5,
    fee: 20_000,
    cutoff: 62,
    podium: 35,
    prize: 50_000,
    followers: 600,
    minFitness: 0,
  },
  {
    id: "run10k",
    name: "시민 10K 마라톤",
    emoji: "🏃‍♀️",
    km: 10,
    fee: 35_000,
    cutoff: 110,
    podium: 65,
    prize: 150_000,
    followers: 1_800,
    minFitness: 150,
  },
  {
    id: "half",
    name: "가을 하프마라톤",
    emoji: "🥈",
    km: 21,
    fee: 50_000,
    cutoff: 205,
    podium: 130,
    prize: 400_000,
    followers: 5_000,
    minFitness: 350,
  },
  {
    id: "full",
    name: "국제 풀코스 마라톤",
    emoji: "🏅",
    km: 42,
    fee: 80_000,
    cutoff: 350,
    podium: 240,
    prize: 1_200_000,
    followers: 15_000,
    minFitness: 600,
  },
];

export function raceById(id: string): Race | undefined {
  return RACES.find((r) => r.id === id);
}

/** 입상 메일 본문 */
export const RACE_PODIUM_LINES = [
  "결승선을 통과하자 진행요원이 메달을 목에 걸어줬다. 시상대 위에서 본 하늘이 유난히 넓었다.",
  "마지막 1km에서 앞사람을 제쳤다. 다리는 남의 것 같았지만 시계는 정직했다.",
];
/** 완주(입상 실패) 메일 본문 */
export const RACE_FINISH_LINES = [
  "순위는 한참 뒤였지만 완주는 완주다. 기록증에 찍힌 숫자를 한참 들여다봤다.",
  "중간에 몇 번이나 걷고 싶었는데, 결국 끝까지 뛰었다. 그거면 됐다.",
];
/** 완주 실패(제한 시간 초과) 메일 본문 */
export const RACE_DNF_LINES = [
  "제한 시간을 넘겨 기록이 남지 않았다. 회수 차량에 앉아 창밖을 봤다.",
  "다리가 먼저 항복했다. 완주는 다음 기회로 미뤘다.",
];

/** 완주/입상 자동 트윗 문구 */
export const RACE_TWEET_DONE = [
  "완주했다 🏃 기록보다 끝까지 뛴 내가 더 놀랍다 #마라톤 #완주인증",
  "결승선 통과 인증 다리는 남의 다리 같은데 기분은 최고 #러닝 #마라톤",
];
/** 완주 실패 자동 트윗 문구 */
export const RACE_TWEET_DNF = [
  "제한 시간에 못 들어왔다 다음엔 기필코 #마라톤 #다음기회에",
  "완주 실패 인증도 기록이니까 남겨둔다 다음 대회 신청하러 감",
];
