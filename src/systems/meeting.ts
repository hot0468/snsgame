import type { AdultKind, DMThread, GameState } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { MEETING_SCENARIOS, type MeetingScenario } from "@/data/meetings";
import { chance, pick, uid } from "@/utils/random";
import { applyEffect } from "./events";
import { changeFollowers } from "./followers";
import { clampAction, clampResource, clampSkill, skillTo100 } from "./stats";
import { addSchedule, advanceTime } from "./time";
import { sendFriendHangoutInvite } from "./appointments";

/**
 * 매력 수치(0~100) — 미용·음란의 평균. 만남 성사에 영향.
 * 스킬은 0~999 스케일이므로 100점 만점으로 환산한다(미용·음란 만렙 → 100).
 */
export function charmLevel(state: GameState): number {
  const avg = (state.skills.beauty + state.skills.lewd) / 2;
  return Math.round(skillTo100(avg));
}

/** 티켓 양도가(원): 콘서트 8만, GV 1.5만 */
export function ticketPrice(kind: "concert" | "gv"): number {
  return kind === "concert" ? 80_000 : 15_000;
}

export interface TicketResult {
  scam: boolean;
  message: string;
  tweetText: string;
}

/**
 * 티켓 양도를 수락한다(양도가를 먼저 송금).
 * 랜덤으로 실제로 받아서 즐기거나(성사), 돈만 뜯기고 사라진다(사기).
 */
export function resolveTicket(state: GameState, thread: DMThread): TicketResult {
  const kind = thread.ticketKind ?? "concert";
  const price = ticketPrice(kind);
  state.money -= price;
  thread.metOffline = true;
  advanceTime(state, 1);

  const isConcert = kind === "concert";
  // 30% 확률로 사기
  if (chance(0.3)) {
    state.resources.mental = clampResource(state.resources.mental - 12);
    addSchedule(state, isConcert ? "콘서트 티켓 사기" : "GV 티켓 사기", "system");
    return {
      scam: true,
      message: isConcert
        ? "떨리는 마음으로 양도가를 입금하고, 상대가 보내주기로 한 티켓을 기다렸다. 그런데 입금 확인 " +
          "메시지를 보낸 직후부터 답장이 뚝 끊겼다. 처음엔 바쁜가 보다 했지만, 시간이 지날수록 " +
          "불안이 스멀스멀 올라왔다. 결국 상대의 계정으로 들어가 보니 이미 프로필도 게시물도 모두 " +
          "지워진 채 흔적조차 남아 있지 않았다.\n\n" +
          "혹시나 하는 마음에 공연 당일 공연장 앞까지 나가 한참을 서성였다. 삼삼오오 입장하는 사람들 " +
          "틈에서 나는 오지 않을 티켓을 하염없이 기다렸다. 아무리 연락해도 돌아오는 답은 없었다. " +
          "결국 텅 빈 손으로 발길을 돌리며, 완벽하게 사기당했다는 사실을 인정할 수밖에 없었다. " +
          "좋아하는 마음을 이용당한 것 같아 화보다 서글픔이 앞섰다."
        : "감독까지 온다는 회차라 무리해서라도 가고 싶었다. 상대가 부르는 양도가를 두말없이 송금하고 " +
          "티켓이 오기만을 기다렸다. 그런데 송금이 끝나기가 무섭게 연락이 뚝 끊겼다. 읽음 표시조차 " +
          "뜨지 않는 대화창을 몇 번이나 새로고침 했지만 소용없었다.\n\n" +
          "GV 티켓은커녕 사과 한마디조차 받지 못했다. 뒤늦게 상대의 다른 게시물을 찾아보려 했지만, " +
          "이미 계정은 비공개로 잠겨 있었다. 애초에 티켓 같은 건 없었던 것이다. 좋아하는 배우를 " +
          "가까이서 보고 싶었던 순수한 마음이 이렇게 이용당하다니, 허탈하고 분했다. 완벽하게 " +
          "사기당한 하루였다.",
      tweetText: isConcert
        ? "콘서트 티켓 양도받으려다 사기당함... 다들 직거래 조심하세요 제발"
        : "GV 티켓 산다고 입금했는데 잠수탐 사기꾼 박제한다",
    };
  }

  state.resources.mental = clampResource(state.resources.mental + 12);
  state.skills.beauty = clampSkill(state.skills.beauty + 5);
  changeFollowers(state, isConcert ? 8 : 4);
  addSchedule(state, isConcert ? "콘서트 관람" : "영화 GV 관람", "offline");
  return {
    scam: false,
    message: isConcert
      ? "다행히 상대는 약속을 지켰다. 입금 확인 후 얼마 지나지 않아 양도 티켓이 무사히 도착했고, " +
        "나는 두근거리는 마음으로 공연장으로 향했다. 자리는 듣던 대로 정말 좋았다. 무대가 한눈에 " +
        "들어오는 위치에서, 조명이 꺼지고 첫 곡의 전주가 흘러나오는 순간 온몸에 소름이 돋았다.\n\n" +
        "눈앞에서 터지는 무대에 나는 목이 쉬도록 소리치고, 응원봉을 흔들며 모든 순간을 눈에 " +
        "담았다. 주변 팬들과 함께 떼창을 하고, 벅찬 감동에 눈시울이 붉어지기도 했다. 화면으로만 " +
        "보던 무대를 실제로 마주하니 그 에너지가 차원이 달랐다. 집으로 돌아가는 길에도 심장이 " +
        "좀처럼 진정되지 않았다. 오늘은 두고두고 곱씹을, 인생 최고의 밤이었다."
      : "상대는 약속대로 티켓을 넘겨주었고, 나는 설레는 마음으로 GV가 열리는 상영관을 찾았다. " +
        "앞자리라 스크린이 시원하게 잘 보였다. 좋아하는 배우가 등장하는 장면마다 숨을 죽였고, " +
        "영화가 끝난 뒤에는 무대에 오른 배우와 감독의 이야기를 바로 눈앞에서 들을 수 있었다.\n\n" +
        "작품에 담긴 뒷이야기와 촬영 비하인드가 하나씩 풀릴 때마다 팬으로서 가슴이 벅차올랐다. " +
        "스크린 속에서만 보던 배우가 실제로 눈앞에 서서 웃고 이야기하는 모습을 보니 이게 꿈인가 " +
        "싶었다. 무리해서 온 보람이 있었다. 이래서 덕질을 끊을 수가 없다며, 나는 한껏 충전된 " +
        "마음으로 상영관을 나섰다. 오래 기억에 남을 하루였다.",
    tweetText: isConcert
      ? "오늘 콘서트 진짜 미쳤다... 아직도 심장이 안 진정돼 평생 잊지 못할 밤"
      : "GV 다녀왔다 배우 실물 미쳤고 감독님 코멘터리까지 완벽했던 하루",
  };
}

/** 타락도(도덕성의 반대) — 변태 플레이 만족에 영향 */
export function corruptionLevel(state: GameState): number {
  return 100 - state.resources.morality;
}

export interface MotelResult {
  /** 결과 문구 */
  message: string;
  /** 결과 트윗 문구 키(MOTEL_RESULT_TWEETS) */
  tweetKey: string;
  /** 결과 트윗을 올릴 때의 종류 */
  tweetKind: AdultKind;
}

/**
 * 모텔 제안을 수락하고 나갔을 때의 결과. 트윗 종류(motelKind)에 따라 플레이가 다르다.
 * - meetup: 매력이 낮으면 바람맞음. 성사되면 관계, 타락도 높으면 확률적으로 그룹 이벤트(→그룹 트윗 해금).
 * - punish/dom: 타락도가 낮으면 아파서/어색해서 중단, 높으면 만족하며 음란도 상승.
 * - group: 다수와의 밤, 음란도 크게 상승.
 */
export function resolveMotel(state: GameState, thread: DMThread): MotelResult {
  state.resources.action = clampAction(state, state.resources.action - MEETING_ACTION_COST);
  thread.metOffline = true;
  advanceTime(state, 1);

  const account = getActiveAccount(state);
  const kind: AdultKind = thread.motelKind ?? "meetup";
  const charm = charmLevel(state);
  const corrupt = corruptionLevel(state); // 0~100

  const raiseLewd = (n: number) => (state.skills.lewd = clampSkill(state.skills.lewd + n));
  const changeMental = (n: number) =>
    (state.resources.mental = clampResource(state.resources.mental + n));
  const changeMorality = (n: number) =>
    (state.resources.morality = clampResource(state.resources.morality + n));

  // 만남 추구(sekt 일반 성인 트윗 유입도 일반 만남으로 동일 처리)
  if (kind === "meetup" || kind === "sekt") {
    // 거근(매우 큼) 특별 이벤트 — 사진의 주인공이면 무조건 성사, 압도적 만족
    if (thread.genitalSize === "huge") {
      changeMental(10);
      raiseLewd(40);
      changeMorality(-6);
      addSchedule(state, "거근 특별 이벤트", "offline");
      return {
        message:
          "약속한 모텔 방 앞에 서자 심장이 이미 요란하게 뛰고 있었다. 문을 열기도 전부터, 사진 속에서 봤던 " +
          "그 압도적인 실루엣이 머릿속을 떠나지 않았다. 노크를 하자 문이 천천히 열렸고, 은은한 조명이 깔린 " +
          "방 안에서 마주한 상대는 사진이 결코 과장이 아니었음을 단번에 깨닫게 했다. 숨이 턱 막히는 존재감 " +
          "앞에서 나는 잠시 아무 말도 하지 못한 채 그 자리에 굳어버렸다.\n\n" +
          "상대가 손을 내밀어 나를 안으로 이끌었다. 옷을 벗기는 순간, 그의 바지 속에서 드러난 것은 " +
          "사진으로도 짐작할 수 없었던 엄청난 크기의 거근이었다. 두껍고 길고, 핏줄이 불거진 모습에 " +
          "본능적으로 다리가 후들거렸다.\n\n" +
          "그는 나를 침대에 눕히고 다리를 크게 벌린 뒤, 천천히 그러나 거침없이 그 거대한 자지를 " +
          "밀어 넣기 시작했다. 배 속이 찢어질 듯한 압박감과 함께 가장 안쪽까지 가득 채워지는 감각에 " +
          "눈물이 핑 돌았다. 움직임이 시작되자, 자지가 안을 쑤시고 문지르는 강렬한 마찰에 몸이 " +
          "부들부들 떨렸다. 한 번 박힐 때마다 숨이 막히고, 시야가 흐려질 정도였다.\n\n" +
          "그는 점점 속도를 높이며 깊고 강하게 박아댔다. 보지가 한계까지 벌어진 채 그의 거근을 " +
          "물고 늘어졌고, 애액이 넘쳐흘렀다. 여러 번 절정을 넘길 때마다 다리에 힘이 풀려 제대로 " +
          "서 있지도 못할 지경이었다. 결국 그가 내 안에 뜨거운 정액을 길게 쏟아낼 때, 나는 몸을 " +
          "크게 경련하며 동시에 강렬한 절정에 올랐다.\n\n" +
          "모든 것이 끝난 뒤, 나는 한동안 천장을 올려다보며 흐트러진 숨을 고르지 못했다. 다리에는 " +
          "아직도 힘이 들어가지 않았고, 보지 안이 얼얼하게 부은 채 정액이 계속 새어나왔다. 이런 경험은 " +
          "난생처음이었다. 부끄러움과 함께 묘한 성취감과 만족감이 동시에 밀려왔다. 옷을 챙겨 방을 " +
          "나서는 발걸음은 두둥실 떠 있는 것처럼 가벼우면서도, 온몸은 나른하게 무거웠다. 오늘 밤은 " +
          "아마 오래도록 잊히지 않을 것이다.",
        tweetKey: "huge",
        tweetKind: "meetup",
      };
    }
    const noShowChance = Math.max(0.05, Math.min(0.75, 0.7 - charm / 130));
    if (chance(noShowChance)) {
      changeMental(-15);
      addSchedule(state, `${thread.partnerName}에게 바람맞음`, "offline");
      return {
        message:
          "설레는 마음에 옷매무새를 몇 번이나 고치며 약속 장소로 나갔다. 상대가 먼저 도착해 기다리고 " +
          "있을지도 모른다는 생각에 발걸음을 재촉했지만, 도착한 곳엔 아무도 없었다. 처음엔 조금 늦나 " +
          "보다 하고 대수롭지 않게 여기며 근처를 서성였다. 십 분, 이십 분, 그렇게 한 시간이 넘도록 " +
          "나는 그 자리를 떠나지 못한 채 애꿎은 휴대폰만 만지작거렸다.\n\n" +
          "몇 번이나 메시지를 보내고 전화를 걸어봤지만 돌아오는 건 무거운 침묵뿐이었다. 읽음 표시조차 " +
          "뜨지 않는 화면을 멍하니 바라보다, 결국 상대가 나오지 않으리란 걸 인정할 수밖에 없었다. 내가 " +
          "뭘 잘못한 걸까, 아니면 애초에 장난이었던 걸까. 매력이 부족했던 건 아닐까 하는 자책까지 " +
          "밀려왔다. 괜히 혼자 들떠 있던 스스로가 초라하게 느껴졌다.\n\n" +
          "허탈함에 어깨가 축 처진 채 발길을 돌렸다. 유난히 시린 밤바람이 옷깃을 파고들었고, 집으로 " +
          "돌아가는 길이 오늘따라 배로 멀게 느껴졌다. 오늘 밤은 정말 최악이다.",
        tweetKey: "bail",
        tweetKind: "meetup",
      };
    }
    changeMental(6);
    raiseLewd(10);
    changeMorality(-3);
    // 타락도가 높으면 방에 한 명이 아니라 여럿이 기다리는 그룹 이벤트
    const groupChance = Math.max(0, (corrupt - 40) / 110);
    if (chance(groupChance)) {
      account.groupUnlocked = true;
      raiseLewd(15);
      changeMorality(-4);
      addSchedule(state, "모텔 그룹 이벤트", "offline");
      return {
        message:
          "약속 장소에서 만난 상대는 사진보다 훨씬 분위기가 좋았고, 자연스럽게 근처 모텔로 발걸음을 " +
          "옮겼다. 그런데 방문을 열자 예상과 전혀 다른 광경이 펼쳐졌다. 상대는 혼자가 아니었다. " +
          "방 안에는 이미 세 명의 남자들이 나른한 눈빛으로 나를 기다리고 있었다. 은은한 조명과 " +
          "낮게 깔린 음악이 방 전체를 후끈한 열기로 가득 채우고 있었다. 순간 나는 문 앞에 얼어붙었다.\n\n" +
          "돌아설까 하는 생각이 스쳤지만, 상대가 부드럽게 웃으며 다가와 어깨를 감싸자 마음이 흔들렸다. " +
          "여러 남자의 시선이 한꺼번에 내 몸을 훑는 낯선 긴장감 속에서, 나는 잠깐의 망설임 끝에 " +
          "결국 방 안으로 발을 들였다.\n\n" +
          "처음엔 어색하고 얼떨떨했지만, 그들은 곧바로 내 옷을 벗기기 시작했다. 여러 손이 동시에 " +
          "가슴을 주무르고, 젖꼭지를 빨아대고, 이미 축축해진 보지와 엉덩이를 손가락으로 헤집었다. " +
          "한 남자가 뒤에서 자지를 깊숙이 박아 넣는 순간, 앞에 선 남자의 자지를 입에 물어야 했다. " +
          "몸의 구멍이라는 구멍이 모두 채워지는 압도적인 감각에 머릿속이 하얘졌다.\n\n" +
          "그들은 번갈아가며 나를 탐했다. 한 명이 보지 안에 사정하고 물러나면 바로 다음 남자가 " +
          "들어왔고, 어떤 때는 앞과 뒤를 동시에 채우기도 했다. 정액이 섞인 애액이 허벅지와 시트를 " +
          "흥건히 적셨다. 나는 그들의 손과 자지에 완전히 휩쓸려, 정신없이 몸을 맡긴 채 여러 번 " +
          "절정을 넘겼다. 시간이 어떻게 흘러갔는지 도무지 기억나지 않을 만큼 농밀하고 정신없는 밤이었다.\n\n" +
          "모든 게 끝나고 방을 나설 무렵, 나는 스스로도 낯선 감정에 사로잡혔다. 죄책감과 강렬한 " +
          "해방감이 뒤섞인 묘한 기분이었다. 넘어서는 안 될 선을 넘은 것 같으면서도, 한편으로는 " +
          "여태 몰랐던 쾌락의 세계로 한 걸음 더 들어간 아찔한 흥분이 남았다. 이 밤은 앞으로의 나를 " +
          "조금은 다른 사람으로 바꿔놓을 것 같다는 예감이 들었다.",
        tweetKey: "group",
        tweetKind: "group",
      };
    }
    addSchedule(state, `${thread.partnerName}와 뜨거운 밤`, "offline");
    return {
      message:
        "약속 장소에 나가자 멀리서 나를 알아본 그가 손을 흔들었다. 사진으로만 봤던 얼굴을 실제로 " +
        "마주하니 화면 너머에서는 절대 느낄 수 없었던 남자다운 분위기가 나를 압도했다. 낮고 부드러운 " +
        "목소리, 시선, 그리고 미묘하게 올라간 입꼬리까지… 심장이 빠르게 뛰기 시작했다.\n\n" +
        "어색한 인사를 나누고 짧은 대화를 주고받는 동안, 우리 사이에는 말로 설명할 수 없는 뜨거운 " +
        "긴장감이 흘렀다. 눈이 마주칠 때마다 아랫배가 저릿저릿하고, 팬티가 축축하게 젖어드는 게 " +
        "느껴졌다. 그도 나를 빤히 바라보는 눈빛이 점점 위험해졌다.\n\n" +
        "누가 먼저랄 것도 없이 우리 발걸음은 근처 호텔 방으로 향했다.\n\n" +
        "문이 닫히자마자 그는 나를 벽으로 세게 밀어붙이며 키스했다. 혀가 깊숙이 들어와 내 입안을 " +
        "휘저었고, 침이 흘러내릴 정도로 음란하게 빨아댔다. 그의 큰 손이 블라우스 안으로 파고들어 " +
        "내 풍만한 가슴을 거칠게 주물렀다. 젖꼭지를 세게 꼬집고 비틀자, 나는 몸을 떨며 신음을 삼켰다.\n\n" +
        "그는 내 치마를 걷어 올리고 팬티를 옆으로 젖힌 채 손가락을 두 마디나 한 번에 쑤셔 넣었다. " +
        "이미 흥건히 젖어 있던 보지가 손가락을 쩍쩍 빨아들이며 요란한 소리를 냈다.\n\n" +
        "“와… 진짜 많이 젖었네.”\n\n" +
        "그의 거친 손가락이 안쪽의 민감한 곳을 빠르게 문지르며 파고들었다. 나는 다리를 벌리고 " +
        "그의 팔을 붙잡은 채 허리를 미친 듯이 흔들었다. 금세 다리가 후들거리며 첫 절정이 왔다.\n\n" +
        "그는 바지를 내리자마자 완전히 발기된, 굵고 긴 자지를 꺼냈다. 나를 침대에 엎드리게 하고 " +
        "뒤에서 허리를 잡은 채 한 번에 끝까지 찔러 넣었다. 배 속 가장 안쪽까지 꽉 채워지는 충격에 " +
        "눈이 뒤집혔다. 그는 내 엉덩이를 양손으로 세게 붙잡고 미친 듯이 박아댔다. 찰싹찰싹 살 " +
        "부딪히는 소리와 함께 보지가 그의 자지를 물고 늘어졌다.\n\n" +
        "그는 내 머리카락을 한 움큼 잡아당기며 속도를 높였다. 자지가 가장 안쪽을 마구 찌를 때마다 " +
        "머릿속이 하얘졌다. 뒤에서 박히는 자세로 몇 번이나 사정 직전까지 몰아가다 멈추기를 반복했다.\n\n" +
        "결국 그는 나를 뒤집어 다리를 어깨에 올린 채 정상위로 들어왔다. 가장 깊은 곳을 세게 때리는 " +
        "강렬한 피스톤질이 이어졌다. 나는 눈물을 흘리며 그의 등을 할퀴었다.\n\n" +
        "그의 허리가 마지막으로 몇 번 격렬하게 움직이더니, 뜨거운 정액이 내 보지 가장 깊은 곳으로 " +
        "강하게 뿜어졌다. 나는 몸을 부르르 떨며 동시에 크게 절정에 올랐다. 보지 안이 그의 정액으로 " +
        "가득 차 넘쳐흘렀다.\n\n" +
        "그날 밤, 우리는 두 번, 세 번을 더 했다. 내가 위에 올라타서 미친 듯이 허리를 흔들 때도, " +
        "그가 나를 안아 올려 서서 박을 때도, 정액이 섞인 애액이 침대를 흥건히 적셨다. 매번 사정할 " +
        "때마다 가장 안쪽이 따뜻하고 무거워지며 몸서리를 쳤다.\n\n" +
        "한참을 그렇게 서로를 탐한 뒤, 우리는 땀으로 범벅이 된 채 나란히 누웠다. 그의 자지가 아직도 " +
        "내 안에 반쯤 들어가 있었고, 정액이 보지 밖으로 꾸물꾸물 흘러나왔다.\n\n" +
        "처음 만난 사이였지만, 이상하리만치 깊은 만족감이 남았다. 그는 내 젖은 머리카락을 쓸어 " +
        "넘기며 낮게 속삭였다.\n\n" +
        "“…또 보고 싶네.”\n\n" +
        "나는 대답 대신 그의 가슴에 얼굴을 묻고, 아직도 살짝 경련하는 보지로 그의 자지를 조이며 " +
        "미소 지었다. 새벽 공기가 선선했지만, 내 몸은 아직도 뜨거웠다.",
      tweetKey: "meetup",
      tweetKind: "meetup",
    };
  }

  // 그룹섹스 추구
  if (kind === "group") {
    raiseLewd(25);
    changeMental(6);
    changeMorality(-5);
    account.groupUnlocked = true;
    addSchedule(state, "모텔 그룹 플레이", "offline");
    return {
      message:
        "이번엔 처음부터 각오하고 나선 밤이었다. 약속된 방에 들어서자, 예상대로 여러 남자들이 " +
        "이미 느슨하게 어우러진 채 나를 기다리고 있었다. 낯선 얼굴들이었지만, 어색함은 오래가지 " +
        "않았다. 한 번 경험해본 세계라 그런지, 나는 문 앞에서 머뭇거리지 않고 자연스럽게 그들 " +
        "사이로 스며들었다. 낮게 깔린 음악과 은은한 조명, 그리고 노골적으로 나를 훑는 시선들이 " +
        "방 안을 후끈하게 달구고 있었다.\n\n" +
        "옷을 벗기는 데는 시간이 얼마 걸리지 않았다. 여러 손이 내 몸을 동시에 더듬기 시작했다. " +
        "가슴을 세게 주무르고, 젖꼭지를 꼬집고 빨아대며, 이미 축축해진 보지와 엉덩이 사이를 " +
        "거침없이 손가락으로 헤집었다. 나는 다리를 벌린 채 그들의 손에 몸을 맡겼다. 손가락이 " +
        "안쪽을 파고들 때마다 허리가 저절로 들썩였다.\n\n" +
        "첫 번째 남자가 내 뒤에서 자지를 박아 넣었다. 단번에 깊숙이 들어오는 굵은 감촉에 몸이 " +
        "부르르 떨렸다. 그는 내 허리를 잡고 세게 박아대기 시작했고, 동시에 앞에 선 남자의 자지를 " +
        "입에 물어야 했다. 입안이 가득 차는 느낌과 뒤에서 찔러오는 충격이 동시에 밀려왔다. " +
        "또 다른 손들이 내 가슴과 클리토리스를 자극하며 쉼 없이 움직였다.\n\n" +
        "남자들이 번갈아가며 나를 탐했다. 한 명이 보지 안에 사정하고 빠지자마자 다음 남자가 바로 " +
        "들어왔다. 정액이 섞인 애액이 허벅지를 타고 흘러내렸다. 어떤 때는 두 명이 동시에 앞과 " +
        "뒤를 채우기도 했다. 몸이 터질 듯한 압박감과 함께 강렬한 쾌감이 계속해서 밀려왔다. " +
        "침대 시트는 땀과 체액으로 흥건히 젖어 있었다.\n\n" +
        "시간은 뜨겁고 어지럽게 흘렀다. 몇 번을 절정에 올랐는지 세지도 못할 만큼, 나는 그들의 " +
        "자지와 손에 완전히 녹아내렸다. 금기를 넘나드는 짜릿함이 온몸을 지배했다. 처음의 죄책감은 " +
        "완전히 사라지고, 오직 육체의 쾌락만이 남았다.\n\n" +
        "모든 것이 잦아든 새벽, 나는 흐트러진 방 한구석에서 천천히 정신을 추슬렀다. 몸은 녹초가 " +
        "되도록 지쳐 있었지만, 머릿속은 묘하게 개운했다. 남들이 알면 손가락질할 취향이라는 걸 " +
        "알면서도, 이젠 이 세계가 제법 익숙하고 편안해졌다는 사실을 부정할 수 없었다. 나는 이미 " +
        "돌아올 수 없는 선을 한참 전에 넘어버린 모양이다.",
      tweetKey: "group",
      tweetKind: "group",
    };
  }

  // 체벌 / 주종관계 — 타락도가 낮으면 중단, 높으면 만족
  const satisfied = chance(Math.max(0.05, Math.min(0.95, corrupt / 100)));
  const isDom = kind === "dom";
  if (satisfied) {
    raiseLewd(20);
    changeMental(5);
    changeMorality(-3);
    addSchedule(state, isDom ? "주종 플레이 만족" : "체벌 플레이 만족", "offline");
    return {
      message: isDom
        ? "방에 들어서자 상대는 낮과는 완전히 다른, 차갑고 지배적인 눈빛으로 나를 내려다보았다. " +
          "부드럽지만 거스를 수 없는 낮은 목소리로 명령을 내릴 때마다 온몸이 긴장으로 바짝 곤두섰다. " +
          "처음엔 이런 관계가 낯설고 두려웠지만, 그가 이끄는 대로 몸을 완전히 맡기자 이상하게도 " +
          "마음이 편안해졌다. 스스로 결정할 필요 없이 그의 뜻대로 움직인다는 사실이, 피곤한 현실에서 " +
          "벗어나는 강렬한 안식처럼 느껴졌다.\n\n" +
          "그는 내 손목을 가죽 끈으로 침대 기둥에 단단히 묶었다. 드러난 몸을 천천히 훑으며, " +
          "가슴을 세게 주무르고 젖꼭지를 꼬집었다. 이어서 엉덩이를 손바닥으로 여러 번 세게 때렸다. " +
          "찰싹찰싹 하는 날카로운 소리와 함께 뜨거운 열기가 퍼졌다. 아픔이 쾌감으로 바뀌는 순간, " +
          "보지가 더욱 흥건히 젖어들었다.\n\n" +
          "그는 내 다리를 벌리고 손가락을 깊숙이 넣어 휘저은 뒤, 굵은 자지를 한 번에 박아 넣었다. " +
          "묶인 채로 허리를 세게 잡히고 박히는 동안, 그는 계속해서 엉덩이와 허벅지를 때리며 " +
          "리듬을 조절했다. 통증과 함께 밀려오는 강렬한 쾌감에 눈물이 흘렀다. 그는 내가 절정에 " +
          "오를 때마다 일부러 움직임을 멈추며 애태우다가, 결국 내 안에 뜨거운 정액을 깊숙이 쏟아냈다.\n\n" +
          "밤이 끝나고 정신을 차렸을 때, 나는 멍한 채로 옷을 챙겼다. 엉덩이와 몸 곳곳이 빨갛게 " +
          "달아올라 있었지만, 부끄러움과 강렬한 만족감이 뒤섞인 기분이었다. 내게 이런 주종 플레이 " +
          "취향이 있었다는 걸 이제야 깨달았다. 남들에게는 절대 털어놓을 수 없지만, 오늘 밤 나는 " +
          "오랫동안 억눌려 있던 부분을 완전히 해방시켰다. 낯설고도 달콤한, 오래 기억에 남을 밤이었다."
        : "방 안의 공기는 시작부터 팽팽했다. 상대는 능숙한 손놀림으로 분위기를 완전히 장악했다. " +
          "나는 긴장 반 기대 반으로 그의 흐름에 몸을 맡겼다. 먼저 무릎을 꿇린 채 엉덩이를 높이 " +
          "들게 한 뒤, 손바닥과 가죽 끈으로 엉덩이를 세게 때리기 시작했다. 찰싹, 하는 날카로운 " +
          "소리가 방 안에 울릴 때마다 뜨거운 열기와 함께 짜릿한 전율이 온몸을 훑고 지나갔다.\n\n" +
          "아픈데도 자꾸 더 원하게 되는, 스스로도 이해하기 힘든 감각이었다. 엉덩이가 빨갛게 부어오를 " +
          "때까지 계속 맞은 뒤, 그는 내 보지를 손가락으로 거칠게 헤집었다. 이어서 뒤에서 자지를 " +
          "한 번에 깊숙이 찔러 넣고, 박을 때마다 다시 엉덩이를 때리며 리듬을 조절했다. 통증과 " +
          "쾌감의 경계가 완전히 무너지는 순간, 나는 여태 몰랐던 강렬한 본능과 마주했다.\n\n" +
          "그가 내 안에 여러 번 정액을 쏟아낼 때마다 몸이 부르르 떨렸다. 모든 게 끝난 뒤, " +
          "얼얼하고 뜨거운 몸을 추스르며 나는 헛웃음을 지었다. 이런 주종과 체벌 플레이가 나와 " +
          "이렇게 잘 맞을 줄은 상상도 못 했다. 부끄러우면서도, 오랫동안 억눌러왔던 무언가를 " +
          "마음껏 풀어낸 듯한 후련함이 깊게 남았다. 오늘 밤 나는 제대로 이 세계에 빠져버린 모양이다.",
      tweetKey: isDom ? "domOk" : "punishOk",
      tweetKind: kind,
    };
  }
  changeMental(-8);
  changeMorality(2);
  addSchedule(state, isDom ? "주종 플레이 중단" : "체벌 플레이 중단", "offline");
  return {
    message: isDom
      ? "잔뜩 긴장한 채 방에 들어섰지만, 막상 상황이 시작되자 모든 게 삐걱거렸다. 상대가 건네는 " +
        "말과 분위기에 좀처럼 몰입하지 못했고, 머릿속에는 '내가 지금 뭘 하고 있는 거지' 하는 " +
        "생각만 맴돌았다. 몸에 힘이 잔뜩 들어간 채로 어색하게 굳어 있는 나를 보며 상대도 결국 " +
        "한숨을 내쉬었다. 아무리 애를 써도, 나를 온전히 내려놓고 상대에게 맡긴다는 감각이 도무지 " +
        "찾아오지 않았다.\n\n" +
        "이런 관계에는 어느 정도의 신뢰와 마음의 준비가 필요하다는 걸, 나는 그제야 실감했다. 호기심 " +
        "하나만으로 뛰어들기엔 아직 마음이 따라주질 않았던 것이다. 어정쩡한 침묵이 방 안을 채웠고, " +
        "나는 결국 '오늘은 여기까지 하는 게 좋겠다'며 어색하게 말을 꺼냈다. 상대도 굳이 붙잡지 " +
        "않았다.\n\n" +
        "'역시 난 아직 아닌가 봐.' 옷을 챙겨 방을 나서며 나는 씁쓸하게 중얼거렸다. 창피함과 " +
        "안도감이 뒤섞인 묘한 기분이었다. 세상엔 나와 맞는 것과 맞지 않는 것이 분명히 있다는 걸 " +
        "값진 실패로 배운 밤. 그래도 한 가지는 확실해졌다. 적어도 오늘의 나에겐, 이건 아니었다."
      : "호기롭게 시작했지만, 첫 자극이 오는 순간 각오는 순식간에 무너졌다. 예상보다 훨씬 얼얼한 " +
        "통증에 눈물이 핑 돌았고, 머릿속이 새하얘졌다. 상대는 조심스럽게 강도를 살피며 다가왔지만, " +
        "이미 잔뜩 겁을 먹은 나는 그 어떤 감각도 쾌감으로 받아들일 여유가 없었다. 몸이 저절로 " +
        "움츠러들고, 온 신경이 그저 이 상황에서 벗어나고 싶다는 생각으로 쏠렸다.\n\n" +
        "결국 나는 참지 못하고 '그만!'을 외쳤다. 상대는 곧바로 손을 멈추고 걱정스러운 얼굴로 나를 " +
        "살폈다. 미안하다는 말과 괜찮냐는 말이 오갔지만, 나는 그저 빨리 이 어색한 공기에서 " +
        "빠져나오고 싶을 뿐이었다. 남들이 짜릿하다고 하는 그 감각이 내겐 그저 아프고 두렵기만 " +
        "했다.\n\n" +
        "서둘러 옷을 챙겨 방을 나서는 내내 얼굴이 화끈거렸다. 괜한 호기심에 무리했다는 후회와, " +
        "그래도 한 번은 부딪혀봤다는 얄궂은 뿌듯함이 동시에 밀려왔다. 이런 취향은 확실히 나와는 " +
        "거리가 멀다는 걸 몸소 확인한 밤이었다. 다음부턴 내 성향을 좀 더 솔직하게 마주해야겠다고, " +
        "쓴웃음을 지으며 다짐했다.",
    tweetKey: isDom ? "domFail" : "punishFail",
    tweetKind: kind,
  };
}

/** 오프라인 만남 1회 행동력 비용 */
export const MEETING_ACTION_COST = 15;

/** 만남 가능 여부: 상대가 제안했고, 아직 안 만났고, 행동력이 충분해야 함 */
export function canMeet(state: GameState, thread: DMThread): boolean {
  return (
    thread.wantsToMeet &&
    !thread.metOffline &&
    // 만남 제안은 그날 하루만 유효 — 익일이 되면 만료(구세이브는 필드 부재 → 만료 없음).
    (thread.meetProposedDay === undefined || state.day <= thread.meetProposedDay) &&
    state.resources.action >= MEETING_ACTION_COST
  );
}

/**
 * 이 상대에게 어울리는 만남 시나리오를 하나 고른다.
 * - 성향 전용 시나리오가 있으면 우선, 없으면 범용.
 * - 계정 성인물 해제가 켜져 있고 상대가 성인 성향이면 성인 시나리오도 후보에 포함.
 */
export function pickMeetingScenario(state: GameState, thread: DMThread): MeetingScenario {
  const allowAdult = state.adultMode && thread.isAdult;

  const eligible = MEETING_SCENARIOS.filter((sc) => {
    if (sc.adultOnly && !allowAdult) return false;
    if (sc.attribute && sc.attribute !== thread.attribute) return false;
    return true;
  });

  // 성인 상대 + 성인모드면 성인 시나리오를 우선 노출
  if (allowAdult) {
    const adultOnes = eligible.filter((sc) => sc.adultOnly);
    if (adultOnes.length > 0 && Math.random() < 0.6) return pick(adultOnes);
  }
  // 성향 전용이 있으면 우선
  const specific = eligible.filter((sc) => sc.attribute === thread.attribute);
  if (specific.length > 0 && Math.random() < 0.7) return pick(specific);

  const generic = eligible.filter((sc) => !sc.attribute && !sc.adultOnly);
  return pick(generic.length > 0 ? generic : eligible);
}

/** "{name}" 토큰을 상대 이름으로 치환 */
export function fillName(text: string, thread: DMThread): string {
  return text.replaceAll("{name}", thread.partnerName);
}

/**
 * 만남 선택지를 확정한다.
 * - 효과 적용(EventEffect 재사용) + 행동력/시간 소모 + metOffline 표시.
 * - 상대가 만남 후기를 DM으로 남기고 스케줄에도 기록.
 * @returns 상대 이름이 채워진 결과 문구
 */
export function resolveMeeting(
  state: GameState,
  thread: DMThread,
  scenario: MeetingScenario,
  choiceIndex: number,
): string {
  const choice = scenario.choices[choiceIndex];
  if (!choice) return "";

  applyEffect(state, choice.effect);
  state.resources.action = clampAction(state, state.resources.action - MEETING_ACTION_COST);
  thread.metOffline = true;

  const resultText = fillName(choice.result, thread);

  // 상대가 만남 후 DM으로 인사를 남긴다
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: pick([
      "오늘 만나서 정말 즐거웠어요! 또 봐요 :)",
      "실제로 보니까 더 좋았어요 ㅎㅎ 조심히 들어가요",
      "오늘 고마웠어요 다음에 또 불러줘요!",
    ]),
    day: state.day,
  });
  thread.unread = true;

  addSchedule(state, `${thread.partnerName}님과 오프라인 만남`, "offline");
  // 만남을 제대로 마친 상대는 나중에 '또 놀자'는 카톡을 보낸다
  sendFriendHangoutInvite(state, thread.partnerName, thread.attribute);
  advanceTime(state, 1);

  return resultText;
}
