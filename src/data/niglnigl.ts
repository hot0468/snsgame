/**
 * '니글니글' — 꿈의 IT 기업(판교/실리콘밸리 감성 패러디, **가상 회사**).
 *
 * 이 파일은 **선언만** 한다. 취업 처리·자유 출근·월 20일 판정·IT 2배는
 * `systems/employment.ts`·`systems/economy.ts`·`systems/followers.ts`가 담당한다.
 *
 * ⚠️ systems·ui·cmd가 여기 상수를 import해 공유한다. 회사명/URL/파일명을
 * 다른 곳에 하드코딩하지 마라 — 값이 갈리면 주소창·cmd·지원서가 조용히 어긋난다.
 * ⚠️ 실존 IT 기업의 상표·슬로건을 베끼지 말 것(가상 패러디).
 */

/** 회사명 */
export const NIGL_COMPANY = "니글니글";

/** 지원서 URL — 브라우저 주소창에 직접 입력하는 값이자 cmd `type 채용.url` 출력에 노출되는 값 */
export const NIGL_URL = "niglnigl.com/apply";

/** cmd `dir /a`가 드러내는 히든 파일명(`type`으로 열면 NIGL_URL이 나온다) */
export const NIGL_CMD_FILE = "채용.url";

/**
 * 채용 합격에 필요한 스탯 문턱(999 스케일).
 * 지원서 '제출'은 누구나 할 수 있지만, 실제 합격은 IT·지식이 둘 다 이 값을 넘어야 한다.
 * 근거: d스토리 히든 퍼즐이 IT +160, 도서관/스터디가 지식을 꾸준히 올린다. 꿈의 IT 기업이므로
 * 그 위의 상위 문턱(300)에 둔다 — 초반 즉시 합격은 막고, 스탯을 키우면 도달 가능한 수준.
 * ⚠️ systems/employment.canBeHiredByNigl 이 두 값을 읽는다. 판정을 다른 곳에 하드코딩하지 마라.
 */
export const NIGL_REQ_IT = 300;
export const NIGL_REQ_KNOWLEDGE = 300;

/** 스탯 미달로 서류 탈락했을 때의 문구 — ui가 하나 뽑아 인라인/토스트로 쓴다. */
export const NIGL_REJECT_LINES: string[] = [
  "아쉽지만 이번엔 함께하지 못하게 됐어요. IT·지식 역량을 좀 더 다져서 다시 지원해 주세요.",
  "지원서는 잘 받았어요. 다만 니글러가 되기엔 기술·지식 내공이 조금 모자라네요. 성장해서 또 만나요!",
  "서류 검토 결과 이번엔 인연이 닿지 않았어요. IT와 지식을 더 키운 뒤 문을 두드려 주세요.",
];

/** 지원서 제출 화면 텍스트 */
export const NIGL_APPLY: { title: string; intro: string; submitLabel: string } = {
  title: "니글니글 — 인재 지원",
  intro:
    "판교의 어느 통유리 빌딩, 이름만 대면 다들 \"거기?\" 하는 그 회사. 무제한 간식과 낮잠 캡슐, 그리고 사수가 자상하다는 전설의 니글니글이 당신을 기다립니다. 이력서는 필요 없어요. 지원서 제출 버튼을 누르는 순간, 당신은 이미 니글러(Niggler)입니다. 다음 달 1일, 첫 출근에서 만나요.",
  submitLabel: "지원서 제출",
};

/** 제출 직후 합격 순간 문구(다음달 1일 출근 설렘) — ui가 toast로 하나 뽑아 쓴다 */
export const NIGL_HIRED_LINES: string[] = [
  "합격입니다! 다음 달 1일부터 출근이에요. 사원증은 로비에서 받으세요 🎉",
  "축하해요, 오늘부로 니글러! 첫 출근은 다음 달 1일. 편한 신발 신고 오세요.",
  "지원서가 통과됐습니다. 낮잠 캡슐 예약은 이미 열어뒀어요. 다음 달 1일에 봬요!",
];

/**
 * 한 달에 채워야 하는 출근 일수(자유 출근 — 평일 낮 고정인 다른 회사와 달리 주말/심야 포함 아무 때나).
 * 처음부터 정규직이며, 이 일수를 못 채운 달은 월급이 반감된다(economy.maybePayday).
 */
export const NIGL_SHIFT_GOAL = 20;

/**
 * cmd `type 채용.url` 출력 줄들.
 * ⚠️ 마지막 줄에 NIGL_URL을 그대로 노출한다 — 플레이어가 이 주소를 주소창에 친다.
 */
export const NIGL_CMD_TYPE_LINES: string[] = [
  "; 니글니글 사내 추천 링크 (외부 유출 금지)",
  "; 아는 사람만 아는 그 주소. 주소창에 그대로 쳐보세요.",
  NIGL_URL,
];
