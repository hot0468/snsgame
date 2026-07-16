import type { DMThread, GameState, PlayerAccount } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { chance, pick, randInt, uid } from "@/utils/random";
import { changeFollowers } from "./followers";
import { legendBJMultiplier } from "./eggs";
import { ownedCount } from "./shop";
import { clampSkill, SKILL_SCALE } from "./stats";
import { addSchedule, advanceTime } from "./time";

/**
 * 사바나 여캠(라이브방송) 흐름.
 * - 성인 트윗을 올리다 보면 확률적으로 '사바나에서 방송해보지 않겠나' 제의 DM이 온다.
 * - 계약하면 매 심야(취침 선택)마다 '사바나 라이브방송' 행동이 열린다.
 * - 방송 도네이션은 미용·어휘력·음란 수치가 높을수록 커진다.
 */

/** 성인 트윗 직후 여캠 제의 DM이 올 확률 */
export const SAVANNA_DM_CHANCE = 0.35;

const SAVANNA_OPENERS = [
  "안녕하세요, 사바나 BJ 매니저입니다. 트윗 잘 봤어요 🔥 사바나에서 방송해보지 않겠나 제안드려요! 심야 방송이면 도네이션 쏠쏠할 거예요",
  "혹시 라이브방송 생각 있으세요? 딱 각 나오는데... 사바나에서 방송해보지 않겠나 싶어서 연락드려요. 매일 심야에 켜기만 하면 돼요!",
  "사바나에서 방송해보지 않겠나? 지금 컨셉이면 별풍선 잘 나올 것 같은데, 저희랑 계약해요 :)",
];

/** 이 계정에 이미 사바나 제의 스레드가 있는지 */
function hasSavannaOffer(account: PlayerAccount): boolean {
  return account.dms.some((t) => t.savanna);
}

/**
 * 성인 트윗 직후 확률적으로 여캠 제의 DM을 생성한다.
 * 이미 계약했거나 제의 스레드가 있으면 생성하지 않는다.
 * @returns 생성되면 true
 */
export function maybeSpawnSavannaDM(state: GameState): boolean {
  if (state.savannaJoined) return false;
  if (!state.adultMode) return false;
  const account = getActiveAccount(state);
  if (hasSavannaOffer(account)) return false;
  if (!chance(SAVANNA_DM_CHANCE)) return false;

  account.dms.unshift({
    id: uid("dm"),
    partnerName: "사바나 매니저",
    partnerHandle: "savana_bj",
    attribute: "adult",
    isAdult: true,
    messages: [{ id: uid("dmm"), from: "partner", text: pick(SAVANNA_OPENERS), day: state.day }],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    savanna: true,
  });
  return true;
}

/** 사바나 여캠 계약을 맺는다. 이후 매 심야에 방송 행동이 열린다. */
export function joinSavanna(state: GameState, thread: DMThread): void {
  state.savannaJoined = true;
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: "계약 완료! 🎉 이제 매일 심야에 방송 켤 수 있어요. 미용·말빨·섹시함이 곧 별풍선이에요. 화이팅!",
    day: state.day,
  });
  thread.unread = true;
  addSchedule(state, "사바나 여캠 계약", "system");
}

/** 웹방송용 마이크 1개당 오르는 도네이션 정액(원) */
export const STREAM_MIC_DONATION_BONUS = 1_000;

/** 웹방송용 마이크 보유 개수에 따른 도네이션 가산액(원, 1개당 +1,000원, 상한 없음) */
export function streamMicDonationBonus(state: GameState): number {
  return STREAM_MIC_DONATION_BONUS * ownedCount(state, "stream_mic");
}

/**
 * 오늘 방송의 도네이션 액수(원).
 * 미용·어휘력·음란 수치가 높을수록 커지고, 매일 운(랜덤)이 붙는다.
 * 좋은 마이크를 갖출수록 방송 음질이 좋아져 별풍선이 더 터진다.
 */
export function savannaDonation(state: GameState): number {
  const { beauty, vocabulary, lewd } = state.skills;
  // 미용(외모)·음란(컨셉)이 크게, 어휘력(입담)이 보조로 기여.
  // 스킬은 0~999 스케일이므로 SKILL_SCALE로 나눠 구 0~100 시절 금액을 보존한다.
  const base = (beauty * 900 + lewd * 1100 + vocabulary * 500) / SKILL_SCALE;
  const luck = 0.7 + Math.random() * 0.8; // 0.7~1.5배 그날의 운
  const raw = 5_000 + Math.round(base * luck) + randInt(0, 3_000);
  // 레전드 BJ 버프는 배수, 마이크는 정액 — 배수를 적용한 뒤 더한다
  // (정액 보너스에 배수가 곱해지면 안 된다).
  return Math.round(raw * legendBJMultiplier(state)) + streamMicDonationBonus(state);
}

export interface SavannaResult {
  amount: number;
  message: string;
  /** 시청자를 방송에 끌어들이는 장문 시나리오로 연결해야 하면 true(효과는 선택 후 적용) */
  scenario?: boolean;
}

/** 방송 중 시청자 난입 특별 이벤트가 터질 확률 */
export const SAVANNA_INTRUSION_CHANCE = 0.12;
/** 난입 시 시청자와 관계로 이어지는 음란도 하한(미만이면 충격받고 종료) */
export const SAVANNA_INTRUSION_LEWD_MIN = 500;

/**
 * 시청자 난입 — 음란도가 낮은 경우(충격받고 방송 급히 종료). 단발 처리.
 */
function runSavannaShock(state: GameState): SavannaResult {
  state.lateTweetToday = true;
  advanceTime(state, 1);
  const amount = 5_000 + randInt(0, 5_000);
  state.money += amount;
  state.resources.mental = Math.max(0, state.resources.mental - 15);
  addSchedule(state, "사바나 시청자 난입 소동", "sns");
  return {
    amount,
    message:
      "장난삼아 '우리 집으로 와보든가 ㅋㅋ' 했을 뿐인데, 방송 도중 정말로 초인종이 울렸다. 문밖에 낯선 " +
      "시청자가 서 있는 걸 확인한 순간 온몸이 굳었다. 소름이 쫙 끼쳐 황급히 방송을 끄고 문을 걸어 잠갔다. " +
      "한참을 심장이 진정되지 않았다. 오늘 방송은 여기서 끝. 정신적으로 큰 충격을 받았다.",
  };
}

/* ─────────────────── 시청자 난입 장문 시나리오 ─────────────────── */

/** 시청자를 방송에 끌어들이는 장문 시나리오 페이지(웹소설 형식). */
export const SAVANNA_INTRUSION_PAGES: string[] = [
  `새벽 두 시, 채팅창은 어느 때보다 뜨거웠다.
별풍선이 연달아 터지고, 사람들은 저마다 더 자극적인 걸 원했다. 분위기에 취한 나는 장난삼아 카메라를 향해 웃으며 툭 던졌다.
"이렇게 보고만 있지 말고, 진짜 우리 집으로 와보든가 ㅋㅋ"
농담이었다. 그런데 그 말이 끝나기가 무섭게, 방 밖에서 초인종이 울렸다. 딩- 동-. 새벽의 정적을 깨는 그 소리에 나는 순간 얼어붙었다. 채팅창도 '헐' '설마' '진짜?'로 도배됐다.`,
  `현관 모니터를 확인하니, 정말로 누군가 문 앞에 서 있었다.
모자를 눌러쓴 낯선 사람. 심장이 쿵 내려앉았다. 무섭기도 했지만, 이상하게도 그보다 앞선 건 짜릿한 호기심이었다. 방송 화면 너머 수천 명이 숨죽이고 지켜보는 이 순간, 여기서 물러설 수도 있고… 아니면 이 위험한 우연을 통째로 방송의 일부로 만들어버릴 수도 있었다.

'오늘 방송, 전설로 남길 수 있겠는데.' 그런 대담한 생각이 스쳤다. 나는 마른침을 삼키고, 떨리는 손으로 인터폰 버튼에 손을 올렸다.`,
  `문을 열자, 상대는 생각보다 훨씬 얌전하고 조심스러운 눈치였다.
"…죄송해요, 그냥 진짜 팬이라서. 폐 끼치면 바로 갈게요." 잔뜩 긴장한 그 모습에 오히려 마음이 놓였다. 위험한 사람 같진 않았다. 나는 잠깐 고민하다, 짓궂은 미소를 지으며 그를 안으로 들였다.

채팅창은 그야말로 폭발했다. 실시간으로 벌어지는 초유의 상황에 시청자 수가 미친 듯이 치솟았고, 별풍선이 화면을 가릴 만큼 쏟아졌다. 심장이 두근거렸다. 이 밤을 어디까지 밀어붙일지는, 온전히 내 선택이었다.`,
];

export interface SavannaChoice {
  label: string;
}

/** 시청자 난입 시나리오의 선택지. */
export const SAVANNA_INTRUSION_CHOICES: SavannaChoice[] = [
  { label: "카메라를 켠 채 대담하게 간다" },
  { label: "카메라는 끄고 둘만의 시간을 갖는다" },
];

/**
 * 시청자 난입 장문 시나리오의 선택을 확정한다.
 * - 0: 카메라 ON — 화제성 폭발(팔로워·도네이션 최대), 도덕성 크게 하락.
 * - 1: 카메라 OFF — 도네이션은 벌되 노출은 덜함(팔로워 소폭), 정신력 타격 적음.
 */
export function resolveSavannaIntrusion(state: GameState, choiceIndex: number): SavannaResult {
  const account = getActiveAccount(state);
  state.lateTweetToday = true;
  const onCam = choiceIndex === 0;

  const extra = onCam ? randInt(50_000, 120_000) : randInt(20_000, 60_000);
  const amount = savannaDonation(state) + extra;
  state.money += amount;

  const gain = onCam
    ? Math.round(account.followers * 0.15) + 120
    : Math.round(account.followers * 0.06) + 40;
  changeFollowers(state, gain);

  state.skills.lewd = clampSkill(state.skills.lewd + (onCam ? 40 : 30));
  state.resources.morality = Math.max(0, state.resources.morality - (onCam ? 12 : 8));
  state.resources.mental = Math.max(0, state.resources.mental - (onCam ? 6 : 3));

  addSchedule(state, `사바나 시청자 난입 방송 (+${amount.toLocaleString("ko-KR")}원)`, "sns");
  advanceTime(state, 1);

  const message = onCam
    ? "나는 카메라를 끄지 않은 채, 찾아온 시청자와의 아찔한 만남을 그대로 방송에 담았다. 실시간으로 벌어진 " +
      "초유의 상황에 시청자 수가 폭발했고, 채팅창은 별풍선으로 가득 찼다. 위험한 만큼 화제도 컸다. " +
      `오늘 도네이션 ${amount.toLocaleString("ko-KR")}원, 소문이 일파만파 번지며 팔로워도 +${gain} 늘었다. ` +
      "다만 수위 높은 방송으로 도덕성엔 흠집이 남았다."
    : "나는 슬며시 카메라를 끄고, 찾아온 시청자와 둘만의 시간을 보냈다. 화면 밖의 은밀한 밤이었다. " +
      `방송 전까지 쌓인 도네이션 ${amount.toLocaleString("ko-KR")}원을 챙겼고, 조용히 퍼진 소문에 팔로워도 +${gain} 늘었다. ` +
      "카메라를 끈 덕에 마음의 부담은 조금 덜했다.";

  return { amount, message };
}

/**
 * 심야 사바나 라이브방송을 진행한다.
 * - 도네이션을 벌고, 음란이 소폭 오르며, 밤을 새워 정신력이 깎이고 수면이 부족해진다.
 * - 방송 후 하루가 넘어간다(자러 가기와 동일하게 다음날로).
 * - 낮은 확률로 시청자 난입 특별 이벤트가 발생한다.
 *   음란도가 높으면 장문 시나리오(scenario:true)로 연결하고, 낮으면 충격 종료(단발).
 */
export function runSavannaStream(state: GameState): SavannaResult {
  if (chance(SAVANNA_INTRUSION_CHANCE)) {
    if (state.skills.lewd >= SAVANNA_INTRUSION_LEWD_MIN) {
      // 효과는 시나리오 선택 후 resolveSavannaIntrusion에서 적용한다(여기선 상태 변경 없음).
      return { amount: 0, message: "", scenario: true };
    }
    return runSavannaShock(state);
  }

  const amount = savannaDonation(state);
  state.money += amount;
  state.skills.lewd = clampSkill(state.skills.lewd + 5);
  state.resources.mental = Math.max(0, state.resources.mental - 8);
  state.lateTweetToday = true; // 밤샘 방송 → 다음날 회복 감소
  addSchedule(state, `사바나 라이브방송 (+${amount.toLocaleString("ko-KR")}원)`, "sns");
  advanceTime(state, 1);
  return {
    amount,
    message:
      `심야 방송을 켰다. 채팅창이 북적이고 별풍선이 연달아 터졌다. ` +
      `오늘 도네이션 ${amount.toLocaleString("ko-KR")}원을 벌었다! 다만 밤을 새워 몸은 무겁다.`,
  };
}
