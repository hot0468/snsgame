import type { AttributeId } from "@/core/types";

/**
 * 갈래 협찬 — **한 갈래를 깊게 판 사람에게만 오는 제안.**
 *
 * 왜 넣었나: 갈래 숙련의 보상이 도달 배율 하나뿐이었다. 만렙(300개)이 ×1.32인데
 * 같은 게임의 다른 레버는 평판 3.3배·궁합 2.3배·스킬 8배다. 300개를 한 갈래에 몰아넣는
 * 지루함에 비해 이득이 너무 작아서, 특화는 **하면 손해인 선택**이었다.
 *
 * 그래서 배율을 더 올리는 대신 **숫자로 안 보이는 문을 연다**: 그 바닥 브랜드가 나를
 * 알아보고 협찬을 제안한다. 여러 갈래에 흩뿌린 플레이는 이 메일을 영영 못 받는다.
 *
 * 규칙(도착 확률·수락·논란)은 `systems/genreSponsor.ts`가 소유한다.
 *
 * ⚠️ **브랜드는 전부 패러디다.** 실존 브랜드를 쓰지 마라(CLAUDE.md의 작명 규약).
 */

/** 갈래별 협찬 브랜드. 그 바닥에 있을 법한 이름이어야 "나를 알아봤다"가 성립한다. */
export const SPONSOR_BRANDS: Record<AttributeId, readonly string[]> = {
  daily: ["오늘의온도", "무해한상점", "소소생활"],
  politics: ["광장리포트", "시사한스푼"],
  idol: ["덕질창고", "포카마켓", "응원봉공작소"],
  anime: ["오타쿠상회", "이차원문구", "굿즈성지"],
  actor: ["시네마레터", "스크린샵"],
  gaming: ["픽셀기어", "한손패드", "레벨업스토어"],
  food: ["맛집레이더", "한입박스", "야식연구소"],
  fitness: ["근성장랩", "땀나는하루", "프로틴창고"],
  beauty: ["윤광연구소", "코덕상점", "민낯이론"],
  humor: ["웃음적금", "밈공장"],
  info: ["알쓸정보국", "지식보급소"],
  it: ["긱스토어", "코드앤기어", "야근방지위원회"],
  dog: ["멍멍상회", "산책의기술", "댕댕간식소"],
  cat: ["집사보급소", "야옹상회", "츄르창고"],
  animal: ["야생기록소", "생태노트"],
  plant: ["초록책방", "화분생활", "물주기연구소"],
  cooking: ["부엌실험실", "손맛공방", "냄비일지"],
  finance: ["차트한잔", "월급방어대", "복리연구소"],
  sports: ["경기장기록", "라커룸토크"],
  fashion: ["옷장정리단", "핏의정석", "데일리룩랩"],
  travel: ["떠남상회", "짐가방연구소", "경유지"],
  adult: ["나이트베일", "은밀한상자"],
};

export interface SponsorTierOffer {
  /** 이 숙련 tier **이상**일 때 이 제안이 온다 */
  minTier: number;
  /** 제안 이름(메일 제목에 들어간다) */
  label: string;
  /** 계약금(원) */
  money: number;
  /** 협찬 트윗으로 들어오는 팔로워 */
  followers: number;
  /** 수락 시 평판 변화(광고를 다는 값) */
  reputation: number;
  /** 뒷광고 논란이 터질 확률 */
  controversyChance: number;
}

/**
 * 숙련 tier별 제안. **위에서부터 첫 매치**를 쓰므로 minTier 내림차순으로 둔다.
 *
 * ⚠️ tier 1(10개)에는 제안이 없다. 어느 갈래든 열 개는 지나가다 쓰는 수준이라,
 *    거기서부터 협찬이 오면 "특화의 보상"이 아니라 그냥 기본 수입이 된다.
 */
export const SPONSOR_TIERS: readonly SponsorTierOffer[] = [
  {
    minTier: 4,
    label: "전속 계약",
    money: 4_000_000,
    followers: 3_000,
    reputation: -3,
    controversyChance: 0.18,
  },
  {
    minTier: 3,
    label: "시즌 협찬",
    money: 1_200_000,
    followers: 900,
    reputation: -2,
    controversyChance: 0.12,
  },
  {
    minTier: 2,
    label: "단건 협찬",
    money: 300_000,
    followers: 250,
    reputation: -1,
    controversyChance: 0.07,
  },
];

/** 제안 메일 본문. {brand}·{genre}·{money}는 systems가 치환한다. */
export const SPONSOR_BODY = [
  "안녕하세요, {brand} 마케팅팀입니다.",
  "",
  "{genre} 쪽 계정을 쭉 보다가 연락드립니다. 그 분야에서 꾸준히 쌓아오신 게 눈에 띄어서요.",
  "한두 번 올리고 마는 계정은 많은데, 이만큼 길게 끌고 가시는 분은 드뭅니다.",
  "",
  "저희 제품으로 {label} 진행하고 싶습니다. 계약금은 {money}원이고,",
  "톤은 평소 쓰시던 그대로 가져가셔도 됩니다. 저희가 원하는 건 그 톤이니까요.",
  "",
  "광고 표기는 필수입니다. 이건 저희도 그쪽도 지켜야 하는 선이라서요.",
].join("\n");

/** 수락했을 때의 결과 문구(논란 없이 끝난 경우). */
export const SPONSOR_OK_LINES: readonly string[] = [
  "계약금이 입금됐다. 평소 쓰던 톤 그대로 올렸더니 반응도 평소와 비슷했다. 광고 표기도 깔끔히 달았다.",
  "협찬 트윗을 올렸다. 늘 쓰던 갈래라 손에 익어서, 광고인 줄 모르겠다는 답글이 달렸다. 표기는 분명히 해뒀다.",
];

/** 수락했는데 뒷광고 논란이 붙은 경우. */
export const SPONSOR_CONTROVERSY_LINE =
  "계약금은 들어왔다. 그런데 며칠 뒤, 광고 표기가 잘 안 보였다는 말이 돌기 시작했다…";

/** 거절했을 때. */
export const SPONSOR_DECLINE_LINES: readonly string[] = [
  "정중히 사양했다. 이 갈래에서 광고를 안 다는 계정이라는 게 그 자체로 값이 된다.",
  "거절 메일을 보냈다. 아쉽지만 타임라인에 광고를 섞고 싶지 않았다. 팔로워들은 모르겠지만 나는 안다.",
];
