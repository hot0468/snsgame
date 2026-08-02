/**
 * 직업별 성인 이벤트 — 근무를 한 번 마친 뒤 낮은 확률로 뜨는 씬.
 *
 * 규칙(확률 판정·게이트·효과 적용)은 `systems/jobAdult.ts`가 소유한다.
 *
 * ⚠️ **왜 각 직업의 데이터 풀에 안 넣었나:** 구조가 제각각이다. 택시는 승객+선택지,
 *    콜센터는 "받을까 퇴근할까"뿐(상담원은 고를 수 없다는 게 그 직업의 설계다), 강사는
 *    회차만 센다. 각자에 맞춰 끼우면 여섯 번 다른 일을 하게 되고, 콜센터엔 선택지를
 *    억지로 만들어 넣어야 한다. 근무 뒤 공용 이벤트로 빼면 여섯 직업에 같은 방식으로 붙는다.
 *
 * ⚠️ **등장인물은 전부 성인이다.** 승객·발신자·손님·동료·상위 라인·수강생 모두 성인으로만
 *    쓴다. 특히 강사는 인강 강사라 미성년 수강생이 연상될 수 있으므로 **동료 강사·조교 등
 *    성인 관계만** 등장시킨다(배구부 합숙과 같은 규칙 — data/coachCamp.ts의 경고 참조).
 */

/** 씬이 붙는 직업 id — `systems/jobExperience.JOB_ID`와 철자가 같아야 한다. */
export type JobAdultId = "taxi" | "callCenter" | "mlm" | "stylist" | "lecturer" | "office";

export interface JobAdultScene {
  id: string;
  job: JobAdultId;
  title: string;
  text: string;
  /** 이 씬이 뜨는 최소 음란 */
  minLewd: number;
  /** 이 씬이 뜨는 최소 변태력(없으면 0) */
  minPervert?: number;
  lewdGain: number;
  pervertGain: number;
  mentalDelta: number;
  moralityDelta: number;
  /** 부수입(원). 없으면 0 */
  money?: number;
}

/**
 * 씬이 갈리는 문턱 — 배구부 뒤풀이(data/coachCamp)와 같은 값으로 맞춘다.
 * 직업마다 다른 값을 쓰면 "어느 직업이 더 싸게 열리나"를 외워야 한다.
 */
export const JOB_SCENE_LEWD_MIN = 150;
export const JOB_SCENE_PERVERT_MIN = 150;

/**
 * 근무 1회 뒤 씬이 뜰 확률.
 *
 * ⚠️ 낮게 잡는 이유: 강제 출근 직업은 근무를 자주 돌린다. 확률이 높으면 매번 뜨는
 *    일과가 되어 특별함이 사라지고, 음란·변태력이 근무만으로 급등한다.
 */
export const JOB_SCENE_CHANCE = 0.16;

/**
 * 직업별 씬 풀.
 *
 * ⚠️ 각 직업 안에서 **강도 내림차순**(다인/하드 → 1:1)으로 놓는다. 위에서부터 첫 매치를
 *    쓰므로 순서가 뒤집히면 변태력이 아무리 높아도 약한 씬만 나온다.
 */
export const JOB_ADULT_SCENES: readonly JobAdultScene[] = [
  /* ─────────────── 택시 ─────────────── */
  {
    id: "taxi_group",
    job: "taxi",
    title: "🔞 심야 운행 — 뒷좌석의 셋",
    minLewd: JOB_SCENE_LEWD_MIN,
    minPervert: JOB_SCENE_PERVERT_MIN,
    lewdGain: 40,
    pervertGain: 34,
    mentalDelta: -6,
    moralityDelta: -12,
    money: 180_000,
    text:
      "새벽 두 시, 유흥가 앞에서 셋이 한꺼번에 탔다. 목적지를 말하고도 자기들끼리 웃기만 했다.\n\n" +
      "신호에 걸렸을 때 뒷좌석에서 손이 넘어와 기어 위에 얹힌 내 손을 감쌌다. \"기사님도 같이 놀래요?\" " +
      "백미러로 보니 셋 다 나를 보고 있었다. 갓길에 차를 세웠다.\n\n" +
      "좁은 차 안에서 자리가 몇 번이나 바뀌었다. 앞좌석 등받이를 눕히자 뒤에서 손이 올라와 셔츠 단추를 풀었고, " +
      "다른 하나가 무릎 사이로 파고들었다. 창문에 김이 서려 바깥이 안 보이게 될 때까지 계속됐다.\n\n" +
      "내릴 때 셋이 각자 지폐를 쥐여줬다. 미터기에 찍힌 요금의 몇 배였다. " +
      "\"이 시간에 또 뵈어요, 기사님.\"",
  },
  {
    id: "taxi_solo",
    job: "taxi",
    title: "🔞 심야 운행 — 마지막 손님",
    minLewd: JOB_SCENE_LEWD_MIN,
    lewdGain: 30,
    pervertGain: 0,
    mentalDelta: -3,
    moralityDelta: -6,
    money: 90_000,
    text:
      "마지막 손님이 목적지에 다 와서도 안 내렸다. \"조금만 더 있다 갈게요.\" 미터기는 이미 꺼둔 뒤였다.\n\n" +
      "룸미러 너머로 눈이 마주쳤다. 먼저 뒷문을 열고 옆자리로 옮겨 앉은 건 그쪽이었다.\n\n" +
      "가로등이 닿지 않는 골목에 차를 세웠다. 좁은 뒷좌석에서 옷이 반쯤 벗겨진 채, " +
      "서로 소리를 줄이려고 애쓰면서도 창문에 손자국이 남았다.\n\n" +
      "내리면서 그 사람이 요금의 세 배를 쥐여줬다. \"영수증은 됐어요.\"",
  },

  /* ─────────────── 콜센터 ─────────────── */
  {
    id: "call_hard",
    job: "callCenter",
    title: "🔞 상담 — 지정 상담원",
    minLewd: JOB_SCENE_LEWD_MIN,
    minPervert: JOB_SCENE_PERVERT_MIN,
    lewdGain: 36,
    pervertGain: 32,
    mentalDelta: 6,
    moralityDelta: -10,
    text:
      "같은 번호가 사흘째 나를 지정해서 걸어온다. 이번엔 용건도 말하지 않았다.\n\n" +
      "\"목소리만 들려주면 돼요. 오늘은 명령조로.\" 헤드셋 너머로 숨소리가 먼저 들어왔다. " +
      "센터 규정에는 없는 요구였지만, 진상 응대보다 이쪽이 편하다는 걸 이미 알고 있었다.\n\n" +
      "말투를 바꿔 지시를 시작하자 수화기 너머가 순순히 따라왔다. 세는 소리, 참는 소리, " +
      "허락을 구하는 소리가 차례로 넘어왔다. 파티션 하나 건너에 동료가 앉아 있다는 걸 " +
      "의식할수록 목소리가 낮아졌다.\n\n" +
      "통화가 끊기고 헤드셋을 벗었다. 이번 달 그 번호의 통화 시간만 다른 콜 전부를 합친 것보다 길었다.",
  },
  {
    id: "call_solo",
    job: "callCenter",
    title: "🔞 상담 — 규정 밖의 통화",
    minLewd: JOB_SCENE_LEWD_MIN,
    lewdGain: 26,
    pervertGain: 0,
    mentalDelta: 4,
    moralityDelta: -5,
    text:
      "\"환불은 됐고요… 그냥 좀 더 얘기하면 안 될까요.\" 진상인 줄 알았던 목소리가 갑자기 낮아졌다.\n\n" +
      "퇴근 시간이 지난 센터는 조용했다. 끊어도 되는 통화였는데 끊지 않았다.\n\n" +
      "무슨 얘기를 하는지 서로 알면서도 모른 척했다. 숨소리가 흐트러지는 게 수화기 너머로 그대로 넘어왔고, " +
      "나도 어느새 목소리를 낮추고 있었다.\n\n" +
      "통화가 끝나고 상담 이력에는 '단순 문의'라고 적었다.",
  },

  /* ─────────────── 다단계 ─────────────── */
  {
    id: "mlm_hard",
    job: "mlm",
    title: "🔞 특별 관리 — 상위 라인의 방",
    minLewd: JOB_SCENE_LEWD_MIN,
    minPervert: JOB_SCENE_PERVERT_MIN,
    lewdGain: 38,
    pervertGain: 36,
    mentalDelta: -8,
    moralityDelta: -14,
    money: 300_000,
    text:
      "실적이 밀린 달이었다. 이사님이 \"특별 관리 대상\"이라며 센터 위층 방으로 불렀다.\n\n" +
      "방에는 상위 라인 둘이 더 앉아 있었다. 실적표를 넘기며 하나씩 짚더니, 이사님이 말했다. " +
      "\"물건을 못 팔면 다른 걸로 채워야죠.\" 아무도 웃지 않았고, 문은 이미 잠겨 있었다.\n\n" +
      "무릎 꿇는 것부터 시작됐다. 세 사람이 번갈아 자리를 바꾸는 동안 실적표는 바닥에 떨어진 채였다. " +
      "누군가 \"이번 달은 채운 걸로 하죠\"라고 말한 건 한참 뒤였다.\n\n" +
      "내려오는 계단에서 봉투를 받았다. 이번 달 매입비보다 조금 많았다. " +
      "다음 달에도 실적이 밀리면 어떻게 되는지는 묻지 않았다.",
  },
  {
    id: "mlm_solo",
    job: "mlm",
    title: "🔞 특별 관리 — 뒤풀이",
    minLewd: JOB_SCENE_LEWD_MIN,
    lewdGain: 28,
    pervertGain: 0,
    mentalDelta: -4,
    moralityDelta: -8,
    money: 120_000,
    text:
      "센터 회식이 끝나고 이사님이 한 잔 더 하자고 했다. 결국 간 곳은 술집이 아니었다.\n\n" +
      "\"이번 달 제일 열심히 뛴 사람이 누군지 나는 알아요.\" 어깨에 얹은 손이 등을 타고 내려왔다. " +
      "거절하면 다음 달 물량이 어떻게 될지 계산이 먼저 섰다.\n\n" +
      "모텔 방의 형광등은 끝까지 켜져 있었다. 그가 위에서 움직이는 동안 천장의 얼룩을 셌다.\n\n" +
      "나오면서 그는 봉투를 쥐여주며 웃었다. \"다음 달 시상식, 무대 올라갑시다.\"",
  },

  /* ─────────────── 헤어디자이너 ─────────────── */
  {
    id: "stylist_hard",
    job: "stylist",
    title: "🔞 마감 후 — 셔터 내린 가게",
    minLewd: JOB_SCENE_LEWD_MIN,
    minPervert: JOB_SCENE_PERVERT_MIN,
    lewdGain: 34,
    pervertGain: 30,
    mentalDelta: -4,
    moralityDelta: -10,
    money: 150_000,
    text:
      "마지막 예약이 셋이서 함께 들어왔다. 마감 시간이 지나 셔터를 반쯤 내린 뒤였다.\n\n" +
      "커트가 끝나고도 아무도 일어나지 않았다. 한 명이 거울 앞 의자를 돌려 나를 앉히더니 " +
      "가운 끈을 풀었다. \"오늘은 원장님이 손님 해요.\"\n\n" +
      "샴푸대에 눕혀진 채로 시작됐다. 물소리가 계속 나는 동안 셋이 번갈아 자리를 바꿨고, " +
      "거울 벽 때문에 어느 방향을 봐도 보였다. 가위 소리 대신 다른 소리가 가게를 채웠다.\n\n" +
      "정리하고 셔터를 완전히 내렸을 때는 새벽이었다. 계산대에는 시술비의 몇 배가 놓여 있었다.",
  },
  {
    id: "stylist_solo",
    job: "stylist",
    title: "🔞 마감 후 — 마지막 손님",
    minLewd: JOB_SCENE_LEWD_MIN,
    lewdGain: 26,
    pervertGain: 0,
    mentalDelta: -2,
    moralityDelta: -5,
    money: 70_000,
    text:
      "단골 하나가 마감 직전에 들어왔다. \"오늘 마지막이죠?\" 그렇다고 대답한 게 시작이었다.\n\n" +
      "샴푸대에 눕힌 채 두피를 만지는 동안 그 사람이 눈을 감고 말했다. \"손이 좋으시네요.\" " +
      "그 말끝에 손목을 잡아 자기 쪽으로 끌어당겼다.\n\n" +
      "가운이 흘러내리고 거울에 둘이 겹쳐 보였다. 물기가 마르기도 전에 의자 위에서 이어졌고, " +
      "드라이기 소리가 대신 났다.\n\n" +
      "나가면서 그 사람이 팁을 두 배로 놓고 갔다. \"다음 주에도 마지막으로 예약할게요.\"",
  },

  /* ─────────────── 강사 ─────────────── */
  {
    id: "lecturer_hard",
    job: "lecturer",
    title: "🔞 야간 스튜디오 — 촬영 뒤",
    minLewd: JOB_SCENE_LEWD_MIN,
    minPervert: JOB_SCENE_PERVERT_MIN,
    lewdGain: 34,
    pervertGain: 30,
    mentalDelta: -5,
    moralityDelta: -10,
    text:
      "심야 촬영이 끝나고 스튜디오에 성인 강사 셋만 남았다. 조명은 아직 꺼지지 않았다.\n\n" +
      "\"카메라 안 돌아가요.\" 옆 과목 강사가 그렇게 말하며 촬영용 책상에 걸터앉았다. " +
      "조교가 문을 잠그고 돌아왔을 때 분위기는 이미 되돌릴 수 없었다.\n\n" +
      "판서용 화이트보드에 등을 붙인 채로 시작됐다. 촬영 조명이 정면으로 들어와 " +
      "어디를 가려도 소용없었고, 셋이 자리를 바꿀 때마다 삼각대가 흔들렸다.\n\n" +
      "새벽에 장비를 정리하며 누군가 말했다. \"다음 촬영도 심야로 잡죠.\" 아무도 반대하지 않았다.",
  },
  {
    id: "lecturer_solo",
    job: "lecturer",
    title: "🔞 야간 스튜디오 — 둘만 남은 강의실",
    minLewd: JOB_SCENE_LEWD_MIN,
    lewdGain: 26,
    pervertGain: 0,
    mentalDelta: -3,
    moralityDelta: -5,
    text:
      "촬영이 밀려 자정을 넘겼다. 스튜디오에는 나와 담당 조교뿐이었다.\n\n" +
      "\"선생님 오늘 목소리 잠기셨어요.\" 그렇게 말하며 건넨 물병을 받다가 손이 겹쳤고, " +
      "그 손이 떨어지지 않았다.\n\n" +
      "촬영용 책상 위에서 강의 자료가 밀려 떨어졌다. 마이크는 꺼져 있었지만 " +
      "소리를 죽이는 버릇은 그대로였다.\n\n" +
      "정리하고 나오며 조교가 말했다. \"내일 1교시는 제가 대신 세팅해둘게요.\"",
  },

  /* ─────────────── 회사원 ─────────────── */
  {
    id: "office_hard",
    job: "office",
    title: "🔞 야근 — 사무실에 남은 사람들",
    minLewd: JOB_SCENE_LEWD_MIN,
    minPervert: JOB_SCENE_PERVERT_MIN,
    lewdGain: 34,
    pervertGain: 32,
    mentalDelta: -6,
    moralityDelta: -12,
    text:
      "마감 주간이라 팀 전체가 자정까지 남았다. 하나둘 빠지고 결국 셋이 남았을 때 " +
      "누군가 사무실 메인 조명을 껐다.\n\n" +
      "\"어차피 아무도 안 와요.\" 팀장이 회의실 문을 닫으며 말했다. 블라인드는 이미 내려가 있었다.\n\n" +
      "회의실 긴 테이블 위에서 셔츠 단추가 하나씩 풀렸다. 프로젝터가 켜진 채라 " +
      "벽에 그림자가 크게 비쳤고, 둘이 번갈아 자리를 바꾸는 동안 아무도 그걸 끄지 않았다.\n\n" +
      "새벽에 각자 자리로 돌아가 메일을 마저 보냈다. 다음 날 아침 회의는 평소와 똑같이 진행됐다.",
  },
  {
    id: "office_solo",
    job: "office",
    title: "🔞 야근 — 둘만 남은 층",
    minLewd: JOB_SCENE_LEWD_MIN,
    lewdGain: 26,
    pervertGain: 0,
    mentalDelta: -3,
    moralityDelta: -6,
    text:
      "야근하는 사람이 나와 선배뿐인 밤이었다. 자판기 커피를 뽑아 오며 선배가 옆자리에 앉았다.\n\n" +
      "\"이거 내일 아침까지 해도 돼요.\" 그렇게 말하며 모니터를 돌려놓는 손이 내 손목을 스쳤다. " +
      "먼저 자리에서 일어난 건 나였다.\n\n" +
      "비상계단 문이 닫히는 소리가 크게 울렸다. 층계참 센서등이 몇 번이나 꺼졌다 켜졌다 하는 동안 " +
      "서로 입을 막아가며 소리를 죽였다.\n\n" +
      "자리로 돌아와 앉으니 모니터의 문서는 아까 그대로였다. 결국 그건 다음 날 아침에 했다.",
  },
];
