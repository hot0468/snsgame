import type { GameContext } from "./context";
import type { BrowserTabId } from "./context";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";
import { renderComposeModal } from "./sns/composeModal";
import { MARKET_ASSETS } from "@/data/market";
import { assetPrice, dayChangePct } from "@/systems/market";
import { SHOP_ITEMS } from "@/data/shop";
import { clockLabel, dateOf } from "@/systems/time";
import { dateLabel, weekdayLabel } from "@/systems/calendar";
import { BANNER_REWARD, canClaimBanner, claimBanner } from "@/systems/economy";
import {
  LOTTO_PRICE,
  LOTTO_PRIZE,
  buyLotto,
  canBuyLotto,
  drawLotto,
  lottoStatus,
} from "@/systems/lotto";
import { canEnterGoblinShop, enterGoblinShop } from "@/systems/goblin";

interface Article {
  id: string;
  title: string;
  source: string;
  time: string;
  /** 상세 기사 본문(문단 배열) */
  body: string[];
}

const NEWS: Article[] = [
  {
    id: "n1",
    title: '"유부남 아이 출산한 딸" 폭로 방송 후폭풍… 가족 갈등 일파만파',
    source: "티브이데일리",
    time: "1시간 전",
    body: [
      "한 예능 방송에서 공개된 가족 이야기가 온라인을 뜨겁게 달구고 있다.",
      "방송 직후 관련 키워드가 실시간 검색어를 점령했고, 누리꾼들은 갑론을박을 이어갔다.",
      "제작진은 \"당사자들의 동의를 얻어 방송했다\"며 확대 해석을 경계했다.",
    ],
  },
  {
    id: "n2",
    title: '유명 방송인, 지인 고소 기자회견에 "현명하게 대처하겠다"',
    source: "뉴스엔",
    time: "2시간 전",
    body: [
      "최근 법적 분쟁에 휘말린 방송인이 취재진 앞에서 입장을 밝혔다.",
      "그는 \"사실관계가 명확히 밝혀질 것\"이라며 담담한 태도를 보였다.",
      "소속사 측은 추가 입장을 조만간 내놓을 예정이라고 전했다.",
    ],
  },
  {
    id: "n3",
    title: "SNS 인플루언서 시대… '팔로워가 곧 돈' 1인 미디어 전성기",
    source: "디지털투데이",
    time: "3시간 전",
    body: [
      "평범한 개인이 하루아침에 수십만 팔로워를 거느리는 사례가 늘고 있다.",
      "업계는 \"꾸준함과 확실한 콘셉트가 성공의 열쇠\"라고 입을 모은다.",
      "전문가들은 무리한 밤샘 활동이 건강을 해칠 수 있다고 경고했다.",
    ],
  },
  {
    id: "n4",
    title: "[속보] '쥬라기 공원' 그 배우 별세… 향년 79세",
    source: "스포츠경향",
    time: "10분 전",
    body: [
      "세계적인 명작에 출연했던 노배우가 노환으로 세상을 떠났다.",
      "유족과 팬들은 고인의 마지막 길을 조용히 배웅하고 있다.",
    ],
  },
  {
    id: "n5",
    title: "'보검매직컬2' 주연 하차 통보… 제작사 \"협의 중\"",
    source: "스포티비뉴스",
    time: "40분 전",
    body: [
      "화제작의 후속 시즌에서 주연 배우의 하차설이 불거졌다.",
      "제작사는 \"일정 조율 문제일 뿐 확정된 것은 없다\"고 해명했다.",
    ],
  },
  {
    id: "n6",
    title: "49세 톱스타, 6개월 금연 성공… \"팬들 덕분\"",
    source: "MK스포츠",
    time: "1시간 전",
    body: [
      "오랜 습관을 끊어낸 스타가 근황을 전하며 팬들에게 감사를 표했다.",
      "그는 \"작은 목표부터 지켜나가는 게 중요하다\"고 조언했다.",
    ],
  },
  {
    id: "n7",
    title: "월세 또 올랐다… 자취생들 '한숨'",
    source: "생활경제",
    time: "2시간 전",
    body: [
      "도심 원룸 월세가 연이어 오르며 1인 가구의 부담이 커지고 있다.",
      "전문가들은 \"고정 지출을 줄이고 부수입을 확보하라\"고 조언했다.",
    ],
  },
  {
    id: "n8",
    title: "10만 팔로워 인플루언서, 뒷광고 논란에 고개 숙였다",
    source: "티브이데일리",
    time: "30분 전",
    body: [
      "인기 SNS 인플루언서가 광고 표기 없이 제품을 홍보했다는 지적을 받았다.",
      "당사자는 \"협찬인 줄 몰랐다\"며 사과했지만 여론은 싸늘하다.",
      "누리꾼들은 과거 게시물까지 들추며 비판을 이어갔다.",
    ],
  },
  {
    id: "n9",
    title: "'팔로워 사고팝니다' 어둠의 계정 거래 기승",
    source: "디지털투데이",
    time: "1시간 전",
    body: [
      "단기간에 팔로워를 늘려준다는 불법 거래가 온라인에서 성행하고 있다.",
      "업계는 \"유령 계정은 결국 계정 신뢰도만 떨어뜨린다\"고 경고했다.",
      "플랫폼 측은 대대적인 계정 정리에 나섰다.",
    ],
  },
  {
    id: "n10",
    title: "편의점 알바 시급 또 동결…청년들 '분통'",
    source: "생활경제",
    time: "2시간 전",
    body: [
      "최저임금 논의가 공전하면서 아르바이트 시급이 제자리걸음이다.",
      "생활비는 오르는데 벌이는 그대로라 청년층의 불만이 커지고 있다.",
    ],
  },
  {
    id: "n11",
    title: "AI가 쓴 소설, 문학 공모전 예심 통과 '충격'",
    source: "디지털투데이",
    time: "3시간 전",
    body: [
      "인공지능이 창작한 단편소설이 한 공모전 예심을 통과해 논란이 됐다.",
      "심사위원단은 \"창작의 정의를 다시 고민해야 할 때\"라고 밝혔다.",
    ],
  },
  {
    id: "n12",
    title: "톱아이돌 그룹, 전격 완전체 컴백 예고…팬덤 '들썩'",
    source: "뉴스엔",
    time: "20분 전",
    body: [
      "활동을 잠정 중단했던 인기 그룹이 완전체 컴백을 예고했다.",
      "티저 공개와 동시에 실시간 검색어를 휩쓸며 기대를 모으고 있다.",
    ],
  },
  {
    id: "n13",
    title: "'구독 취소 러시'…OTT 요금 인상의 역풍",
    source: "디지털투데이",
    time: "1시간 전",
    body: [
      "주요 OTT들이 잇따라 요금을 올리자 이용자 이탈이 가속화되고 있다.",
      "소비자들은 \"볼 게 없는데 값만 오른다\"며 등을 돌리고 있다.",
    ],
  },
  {
    id: "n14",
    title: "길고양이 돌보던 청년, '선한 영향력' 화제",
    source: "생활경제",
    time: "2시간 전",
    body: [
      "동네 길고양이를 꾸준히 돌봐온 한 청년의 사연이 잔잔한 감동을 주고 있다.",
      "누리꾼들은 \"이런 소식이 더 많이 알려졌으면\"이라며 응원했다.",
    ],
  },
  {
    id: "n15",
    title: "코인 하루 만에 반토막…'영끌 투자' 곡소리",
    source: "디지털투데이",
    time: "40분 전",
    body: [
      "급등하던 가상자산이 하루 사이 폭락하며 투자자들이 충격에 빠졌다.",
      "전문가들은 \"감당 가능한 범위에서 투자하라\"고 거듭 경고했다.",
    ],
  },
  {
    id: "n16",
    title: "무명 배우, 단역 30년 만에 첫 주연 '인간승리'",
    source: "스포츠경향",
    time: "3시간 전",
    body: [
      "오랜 무명 시절을 견딘 배우가 마침내 주연으로 발탁돼 화제다.",
      "그는 \"포기하지 않으면 언젠가 기회가 온다\"고 소감을 전했다.",
    ],
  },
  {
    id: "n17",
    title: "직장인 10명 중 7명 '조용한 퇴사' 경험",
    source: "생활경제",
    time: "1시간 전",
    body: [
      "최소한의 일만 하며 버티는 이른바 '조용한 퇴사'가 확산하고 있다.",
      "전문가들은 \"조직 문화 전반을 돌아봐야 한다\"고 지적했다.",
    ],
  },
  {
    id: "n18",
    title: "밈 하나로 매출 대박…'역주행' 노포의 기적",
    source: "생활경제",
    time: "2시간 전",
    body: [
      "한 누리꾼이 올린 밈이 화제가 되며 오래된 노포에 손님이 몰렸다.",
      "사장님은 \"얼떨떨하다\"며 연신 감사 인사를 전했다.",
    ],
  },
  {
    id: "n19",
    title: "'헬스 인증' 열풍…신규 회원 폭증에 헬스장 북적",
    source: "MK스포츠",
    time: "3시간 전",
    body: [
      "SNS 운동 인증 문화가 퍼지며 헬스장 등록이 크게 늘었다.",
      "다만 단기 등록 후 발길을 끊는 경우도 많아 업계는 웃지 못한다.",
    ],
  },
  {
    id: "n20",
    title: "유명 먹방 유튜버, 협찬 거절 맛집 '별점 테러' 의혹",
    source: "티브이데일리",
    time: "30분 전",
    body: [
      "한 먹방 유튜버가 협찬을 거절한 가게에 악평을 남겼다는 의혹이 불거졌다.",
      "당사자는 \"사실무근\"이라며 법적 대응을 예고했다.",
    ],
  },
  {
    id: "n21",
    title: "전세사기 피해 청년들, 거리로…'대책 촉구'",
    source: "생활경제",
    time: "1시간 전",
    body: [
      "전세사기 피해를 입은 청년들이 대책 마련을 촉구하고 나섰다.",
      "피해자들은 \"평생 모은 돈이 사라졌다\"며 울분을 토했다.",
    ],
  },
  {
    id: "n22",
    title: "게임 '확률형 아이템' 정보공개 의무화 초읽기",
    source: "디지털투데이",
    time: "2시간 전",
    body: [
      "확률형 아이템의 확률 공개를 의무화하는 규제가 곧 시행된다.",
      "이용자들은 환영하는 반면 업계는 매출 감소를 우려하고 있다.",
    ],
  },
  {
    id: "n23",
    title: "'퇴근 후 부업' 열풍…N잡러 100만 시대",
    source: "생활경제",
    time: "3시간 전",
    body: [
      "본업 외에 부수입을 올리는 이른바 'N잡러'가 빠르게 늘고 있다.",
      "고물가 시대에 생계형 부업이 일상이 됐다는 분석이다.",
    ],
  },
  {
    id: "n24",
    title: "인기 웹툰, 실사 드라마화 확정…팬들 '기대 반 걱정 반'",
    source: "뉴스엔",
    time: "40분 전",
    body: [
      "누적 조회수 수억 회를 기록한 웹툰이 드라마로 제작된다.",
      "원작 팬들은 캐스팅에 촉각을 곤두세우고 있다.",
    ],
  },
  {
    id: "n25",
    title: "'주 4일제' 시범 도입 기업 늘어…직원 만족도 '쑥'",
    source: "생활경제",
    time: "1시간 전",
    body: [
      "주 4일 근무를 시범 도입하는 기업이 늘고 있다.",
      "참여 직원들은 \"삶의 질이 확 달라졌다\"고 입을 모았다.",
    ],
  },
  {
    id: "n26",
    title: "심야 배달 라이더 급증…'위험한 질주' 우려",
    source: "생활경제",
    time: "2시간 전",
    body: [
      "심야 배달 수요가 늘며 도로 위 라이더도 급증했다.",
      "안전 사각지대에 대한 우려의 목소리가 커지고 있다.",
    ],
  },
  {
    id: "n27",
    title: "'악플 고소' 늘었다…연예계 강경 대응 확산",
    source: "티브이데일리",
    time: "3시간 전",
    body: [
      "악성 댓글에 강경 대응하는 연예인이 늘고 있다.",
      "소속사들은 \"선처는 없다\"며 법적 조치를 이어가고 있다.",
    ],
  },
  {
    id: "n28",
    title: "반려동물 1500만 시대…'펫코노미' 폭풍 성장",
    source: "디지털투데이",
    time: "1시간 전",
    body: [
      "반려동물 관련 산업이 빠르게 성장하고 있다.",
      "고급 사료부터 반려동물 보험까지 시장이 다변화하는 모습이다.",
    ],
  },
  {
    id: "n29",
    title: "명절 앞두고 '용돈 스트레스'…MZ세대 한숨",
    source: "생활경제",
    time: "2시간 전",
    body: [
      "명절을 앞두고 용돈과 선물 부담을 호소하는 목소리가 커지고 있다.",
      "일각에서는 \"마음만 전하자\"는 문화 확산을 제안했다.",
    ],
  },
  {
    id: "n30",
    title: "'숏폼 중독' 경고…하루 3시간 넘게 본다",
    source: "디지털투데이",
    time: "30분 전",
    body: [
      "짧은 영상에 몰입하는 이용자가 늘며 중독 우려가 제기됐다.",
      "전문가들은 \"의식적인 사용 습관이 필요하다\"고 조언했다.",
    ],
  },
  {
    id: "n31",
    title: "무료나눔 사기 주의보…'입금 유도' 기승",
    source: "생활경제",
    time: "1시간 전",
    body: [
      "무료 나눔을 미끼로 개인정보나 소액 입금을 유도하는 사기가 늘고 있다.",
      "경찰은 \"의심되면 즉시 신고하라\"고 당부했다.",
    ],
  },
  {
    id: "n32",
    title: "동네 카페 '오픈런'…한정 굿즈에 새벽부터 줄",
    source: "티브이데일리",
    time: "3시간 전",
    body: [
      "한 카페의 한정판 굿즈를 사기 위해 새벽부터 긴 줄이 늘어섰다.",
      "일부는 되팔이 목적으로 몰려 눈살을 찌푸리게 했다.",
    ],
  },
  {
    id: "n33",
    title: "'과로사회' 여전…직장인 절반 '번아웃' 호소",
    source: "생활경제",
    time: "2시간 전",
    body: [
      "과중한 업무로 번아웃을 겪는 직장인이 여전히 많은 것으로 나타났다.",
      "전문가들은 충분한 휴식과 심리 지원의 중요성을 강조했다.",
    ],
  },
  {
    id: "n34",
    title: "톱스타 열애설에 소속사 주가 '출렁'",
    source: "뉴스엔",
    time: "20분 전",
    body: [
      "한 톱스타의 열애설이 불거지며 소속사 주가가 크게 흔들렸다.",
      "소속사 측은 \"확인해 줄 수 없다\"며 말을 아꼈다.",
    ],
  },
  {
    id: "n35",
    title: "'중고거래 진상' 몸살…판매자들 한숨",
    source: "생활경제",
    time: "1시간 전",
    body: [
      "막무가내식 흥정과 노쇼로 중고거래 판매자들이 골머리를 앓고 있다.",
      "플랫폼은 매너 온도 등 신뢰 지표를 강화하고 나섰다.",
    ],
  },
  {
    id: "n36",
    title: "AI 챗봇 상담 확대…'사람 대신' 논란도",
    source: "디지털투데이",
    time: "3시간 전",
    body: [
      "고객 상담에 AI 챗봇을 도입하는 기업이 늘고 있다.",
      "편리하다는 평가와 함께 \"결국 사람이 필요하다\"는 반발도 나온다.",
    ],
  },
  {
    id: "n37",
    title: "폭염에 전기요금 '폭탄'…에어컨 못 켜는 여름",
    source: "생활경제",
    time: "2시간 전",
    body: [
      "기록적인 폭염에도 전기요금 부담에 에어컨 사용을 망설이는 가구가 많다.",
      "에너지 취약계층 지원 확대를 요구하는 목소리가 높다.",
    ],
  },
];

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** 이미지 대체용 그라데이션 썸네일 */
function thumb(seed: string, className: string): HTMLElement {
  const hue = hashHue(seed);
  return el("div", {
    class: className,
    style:
      `background:linear-gradient(135deg, hsl(${hue}deg 60% 60%), hsl(${(hue + 40) % 360}deg 60% 45%))`,
  });
}

/** '네이놈' 뉴스 포털 */
export function renderPortal(ctx: GameContext): HTMLElement {
  const selected = ctx.ui.portalArticleId
    ? NEWS.find((a) => a.id === ctx.ui.portalArticleId) ?? null
    : null;

  if (selected) return renderArticle(ctx, selected);
  return renderNewsHome(ctx);
}

/** 특정 키워드에만 반응하는 검색창(장식 + 숨은 키워드). */
function searchBar(ctx: GameContext): HTMLElement {
  const input = el("input", {
    class: "portal-search__field",
    type: "text",
    placeholder: "검색어를 입력하세요",
  }) as HTMLInputElement;

  const submit = (): void => {
    const q = input.value.trim().replace(/\s+/g, "");
    if (!q) return;
    // 숨은 키워드 '열려라 참깨' + 이번 달 아직 접속 안 함 → 도깨비 상점(월 1회)
    if (q === "열려라참깨" && canEnterGoblinShop(ctx.store.getState())) {
      input.value = "";
      ctx.update((st) => enterGoblinShop(st));
      ctx.ui.goblinSiteOpen = true;
      ctx.refresh();
      return;
    }
    // '자격증' → O넷. 도깨비 상점과 달리 조건 없이 언제나 열린다(월 1회 제한 없음).
    if (q === "자격증") {
      input.value = "";
      ctx.ui.onetSiteOpen = true;
      ctx.refresh();
      return;
    }
    // 그 외(모르는 키워드 · 또는 이번 달 이미 다녀간 경우) → 힌트 없이 동일하게 처리
    window.alert("검색 결과가 없습니다");
  };
  input.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") submit();
  });

  return el(
    "div",
    { class: "portal-search" },
    el("span", { class: "portal-search__n" }, "N"),
    input,
    el(
      "span",
      { class: "portal-search__go", onclick: submit, title: "검색" },
      icon("search", { size: 16 }),
    ),
    el(
      "span",
      { class: "portal-search__ai" },
      icon("sparkle", { size: 15, className: "portal-search__ai-icon" }),
      "AI",
    ),
  );
}

function open(ctx: GameContext, id: string): void {
  ctx.ui.portalArticleId = id;
  ctx.refresh();
}

/** 게임 시각 라벨 (예: "07.14. 20:00") */
function marketStamp(ctx: GameContext): string {
  const s = ctx.store.getState();
  const d = dateOf(s.day);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd}. ${clockLabel(s)}`;
}

/** 자산 id + day로 결정되는 장식용 스파크라인 SVG */
function sparkline(seed: string, down: boolean): HTMLElement {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rnd = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return (h % 1000) / 1000;
  };
  const n = 26;
  const w = 132;
  const ht = 48;
  let y = 22 + rnd() * 4;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    y += (rnd() - 0.5) * 9 + (down ? 0.35 : -0.35);
    y = Math.max(5, Math.min(ht - 5, y));
    pts.push(`${((i / (n - 1)) * w).toFixed(1)},${y.toFixed(1)}`);
  }
  const color = down ? "#1763d6" : "#e0413c";
  const line = pts.join(" ");
  const area = `0,${ht} ${line} ${w},${ht}`;
  const svg =
    `<svg viewBox="0 0 ${w} ${ht}" width="100%" height="${ht}" preserveAspectRatio="none" aria-hidden="true">` +
    `<polygon points="${area}" fill="${color}" opacity="0.12"/>` +
    `<polyline points="${line}" fill="none" stroke="${color}" stroke-width="1.6" ` +
    `stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  return el("div", { class: "stk__spark", html: svg });
}

/** 로고 하단 광고 배너. 하루 1회 클릭 시 100원 적립. */
function adBanner(ctx: GameContext): HTMLElement {
  const claimable = canClaimBanner(ctx.store.getState());
  return el(
    "button",
    {
      class: "portal-ad" + (claimable ? "" : " portal-ad--done"),
      onclick: () => {
        let got = 0;
        ctx.update((s) => {
          got = claimBanner(s);
        });
        if (got > 0) ctx.toast(`적립 +${got}원 💰`);
        else ctx.toast("오늘 적립은 이미 받았어요. 내일 다시!");
      },
    },
    el(
      "span",
      { class: "portal-ad__logo" },
      el("span", { class: "portal-ad__logo-n" }, "N"),
      el("span", { class: "portal-ad__logo-plus" }, "+"),
      el("span", { class: "portal-ad__logo-txt" }, "멤버십"),
    ),
    el(
      "span",
      { class: "portal-ad__copy" },
      el("span", { class: "portal-ad__title" }, "구독료보다 더 큰 적립 혜택"),
      el(
        "span",
        { class: "portal-ad__sub" },
        claimable
          ? `지금 클릭하면 ${BANNER_REWARD}원 적립 (하루 1회)`
          : "오늘 적립 완료 · 내일 다시 받으세요",
      ),
    ),
    el("span", { class: "portal-ad__gift" }, "🎁"),
  );
}

/** 네이놈 증시 블록: 대표 지수 + 인기 종목. 클릭 시 증권 탭으로. */
function stocksBlock(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const goStocks = () => {
    ctx.ui.activeTab = "stocks";
    ctx.refresh();
  };

  const featured = MARKET_ASSETS[1] ?? MARKET_ASSETS[0]; // 네이놈
  const fPrice = assetPrice(s, featured.id);
  const fChg = dayChangePct(s, featured.id);
  const fDown = fChg < 0;
  const fDelta = Math.round((fPrice * fChg) / 100);

  const changeChip = (chg: number) => {
    const dir = chg > 0 ? "up" : chg < 0 ? "down" : "flat";
    const arrow = chg > 0 ? "▲" : chg < 0 ? "▼" : "-";
    return el(
      "span",
      { class: `stk__chg stk__chg--${dir}` },
      `${arrow}${Math.abs(chg).toFixed(2)}%`,
    );
  };

  const rows = MARKET_ASSETS.filter((a) => a.id !== featured.id).slice(0, 3);
  const list = el(
    "div",
    { class: "stk__list" },
    ...rows.map((a) => {
      const chg = dayChangePct(s, a.id);
      return el(
        "button",
        { class: "stk__row", onclick: goStocks },
        el("span", { class: "stk__row-name" }, a.name),
        el(
          "span",
          { class: "stk__row-right" },
          changeChip(chg),
          el("span", { class: "stk__row-price" }, formatNumber(assetPrice(s, a.id))),
        ),
      );
    }),
    el(
      "button",
      { class: "stk__more", onclick: goStocks },
      el("span", {}, "인기종목 더보기"),
      icon("chevron", { size: 14, className: "stk__more-chev" }),
    ),
  );

  const featuredCol = el(
    "button",
    { class: "stk__featured", onclick: goStocks },
    el("div", { class: "stk__f-name" }, featured.name),
    el("div", { class: "stk__f-price" }, formatNumber(fPrice)),
    el(
      "div",
      { class: `stk__f-chg stk__f-chg--${fDown ? "down" : fChg > 0 ? "up" : "flat"}` },
      `${fDown ? "▼" : fChg > 0 ? "▲" : "-"} ${formatNumber(Math.abs(fDelta))} ${fChg >= 0 ? "+" : ""}${fChg.toFixed(2)}%`,
    ),
    sparkline(featured.id + s.day, fDown),
  );

  return el(
    "section",
    { class: "portal-block stk" },
    el(
      "div",
      { class: "portal-block__head" },
      el(
        "div",
        { class: "portal-block__title" },
        "증시",
        el("span", { class: "portal-block__i" }, "ⓘ"),
      ),
      el(
        "div",
        { class: "portal-block__stamp" },
        marketStamp(ctx),
        icon("refresh", { size: 13, className: "portal-block__refresh" }),
      ),
    ),
    el("div", { class: "stk__body" }, featuredCol, list),
  );
}

/** 네이놈 쇼핑 블록: 요즘 많이 찾는 상품(가로 스크롤). 클릭 시 쇼핑 탭으로. */
function shopBlock(ctx: GameContext): HTMLElement {
  const goShop = () => {
    ctx.ui.activeTab = "shop";
    ctx.refresh();
  };

  const items = SHOP_ITEMS.filter((it) => !it.adultOnly).slice(0, 5);
  const cards = el(
    "div",
    { class: "shopb__row" },
    ...items.map((it) =>
      el(
        "button",
        { class: "shopb__card", onclick: goShop },
        thumb(it.id, "shopb__thumb"),
        el("div", { class: "shopb__name" }, it.name),
      ),
    ),
  );

  return el(
    "section",
    { class: "portal-block shopb" },
    el(
      "div",
      { class: "shopb__side" },
      el("div", { class: "shopb__lead" }, "요즘\n많이 찾는\n상품은"),
      el("span", { class: "shopb__ad" }, "AD"),
    ),
    cards,
  );
}

/** 네이놈 로또 배너: 클릭 시 복권 구입/추첨 확인 모달. */
function lottoBlock(ctx: GameContext): HTMLElement {
  const st = lottoStatus(ctx.store.getState());
  const sub =
    st.kind === "none"
      ? `1등 ${formatNumber(LOTTO_PRIZE)}원! 한 장 ${formatNumber(LOTTO_PRICE)}원`
      : st.kind === "waiting"
        ? `추첨일 ${dateLabel(st.drawDay!)}(${weekdayLabel(st.drawDay!)})에 확인하세요`
        : "추첨일이 지났어요! 결과를 확인하세요";
  return el(
    "button",
    { class: "portal-ad", onclick: () => openLottoModal(ctx) },
    el(
      "span",
      { class: "portal-ad__logo" },
      el("span", { class: "portal-ad__logo-n", style: "background:#d81b60" }, "L"),
      el("span", { class: "portal-ad__logo-txt" }, "로또"),
    ),
    el(
      "span",
      { class: "portal-ad__copy" },
      el("span", { class: "portal-ad__title" }, "네이놈 로또 — 인생역전 한 방"),
      el("span", { class: "portal-ad__sub" }, sub),
    ),
    el("span", { class: "portal-ad__gift" }, "🎟️"),
  );
}

function openLottoModal(ctx: GameContext): void {
  ctx.openModal((c) => {
    const container = el("div", { class: "modal" });
    function head(title: string): HTMLElement {
      return el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, "🎟️ " + title),
        el("button", { class: "popup__close", onclick: () => c.closeModal() }, "✕"),
      );
    }
    function paint(): void {
      const s = c.store.getState();
      const st = lottoStatus(s);
      if (st.kind === "none") {
        const buyable = canBuyLotto(s);
        container.replaceChildren(
          head("네이놈 로또"),
          el(
            "div",
            { class: "modal__body" },
            el(
              "p",
              { style: "font-size:15px;line-height:1.7;margin:0 0 14px" },
              `복권을 사시겠습니까? (한 장 ${formatNumber(LOTTO_PRICE)}원)\n1등에 당첨되면 ${formatNumber(LOTTO_PRIZE)}원을 드려요. 추첨은 다음 토요일입니다.`,
            ),
            el(
              "div",
              { class: "compose-actions", style: "gap:10px" },
              el("button", { class: "btn btn--ghost", onclick: () => c.closeModal() }, "안 산다"),
              el(
                "button",
                {
                  class: "btn" + (buyable ? "" : " btn--ghost"),
                  disabled: !buyable,
                  onclick: () => {
                    if (!buyable) {
                      c.toast(`잔고가 부족해요 (필요 ${formatNumber(LOTTO_PRICE)}원)`);
                      return;
                    }
                    c.update((g) => buyLotto(g));
                    c.toast("복권을 샀어요! 다음 토요일에 확인하세요 🎟️");
                    paint();
                  },
                },
                "복권 사기",
              ),
            ),
          ),
        );
      } else if (st.kind === "waiting") {
        container.replaceChildren(
          head("추첨 대기 중"),
          el(
            "div",
            { class: "modal__body" },
            el(
              "p",
              { style: "font-size:15px;line-height:1.7;margin:0 0 14px" },
              `이미 복권을 구입했어요.\n추첨일은 ${dateLabel(st.drawDay!)}(${weekdayLabel(st.drawDay!)})입니다. 그날 이후 다시 눌러 결과를 확인하세요!`,
            ),
            el("button", { class: "btn", onclick: () => c.closeModal() }, "확인"),
          ),
        );
      } else {
        // ready — 추첨 확인
        container.replaceChildren(
          head("추첨 결과 확인"),
          el(
            "div",
            { class: "modal__body" },
            el(
              "p",
              { style: "font-size:15px;line-height:1.7;margin:0 0 14px" },
              "추첨일이 지났습니다. 결과를 확인할까요?",
            ),
            el(
              "div",
              { class: "compose-actions", style: "gap:10px" },
              el("button", { class: "btn btn--ghost", onclick: () => c.closeModal() }, "나중에"),
              el(
                "button",
                {
                  class: "btn",
                  onclick: () => {
                    let won = false;
                    c.update((g) => {
                      won = drawLotto(g).won;
                    });
                    container.replaceChildren(
                      head(won ? "🎉 1등 당첨!" : "낙첨"),
                      el(
                        "div",
                        { class: "modal__body" },
                        el(
                          "p",
                          { style: "font-size:15px;line-height:1.8;margin:0 0 14px" },
                          won
                            ? `축하합니다! 1등에 당첨되어 ${formatNumber(LOTTO_PRIZE)}원이 입금됐어요! 인생역전이다!!`
                            : "아쉽지만 이번엔 꽝이에요. 다음 기회에 다시 도전해보세요.",
                        ),
                        el("button", { class: "btn", onclick: () => c.closeModal() }, "확인"),
                      ),
                    );
                    if (won) c.toast(`복권 1등! +${formatNumber(LOTTO_PRIZE)}원 🎉`);
                  },
                },
                "결과 확인",
              ),
            ),
          ),
        );
      }
    }
    paint();
    return container;
  });
}

/**
 * 네이놈 하단 사이트 광고 카드(남의방·마켓걸리버).
 * 상단 탭이 아니라 여기서 진입한다(증권·쇼핑과 동일 패턴).
 */
function sitesBlock(ctx: GameContext): HTMLElement {
  interface SiteAd {
    tab: BrowserTabId;
    brand: string;
    color: string;
    title: string;
    desc: string;
    mark: string;
  }

  const housingMark =
    `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">` +
    `<rect width="24" height="24" rx="6" fill="#ff6f3c"/>` +
    `<path d="M12 5 5 11h2v7h10v-7h2z" fill="#fff"/></svg>`;
  const groceryMark =
    `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">` +
    `<rect width="24" height="24" rx="6" fill="#5f0080"/>` +
    `<path d="M6 8h12l-1.2 8H7.2z" fill="#fff"/>` +
    `<path d="M9 8a3 3 0 0 1 6 0" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`;

  const ads: SiteAd[] = [
    {
      tab: "housing",
      brand: "남의방",
      color: "#ff6f3c",
      title: "남의방",
      desc: "요즘 뜨는 자취방, 남의방에서 미리 구경하세요",
      mark: housingMark,
    },
    {
      tab: "grocery",
      brand: "마켓걸리버",
      color: "#5f0080",
      title: "마켓걸리버",
      desc: "오늘 밤 주문하면 내일 새벽 문 앞에 도착",
      mark: groceryMark,
    },
  ];

  return el(
    "div",
    { class: "portal-sites" },
    ...ads.map((ad) =>
      el(
        "button",
        {
          class: "site-card",
          onclick: () => {
            ctx.ui.activeTab = ad.tab;
            ctx.refresh();
          },
        },
        el("span", { class: "site-card__mark", html: ad.mark }),
        el(
          "span",
          { class: "site-card__copy" },
          el(
            "span",
            { class: "site-card__brand", style: `color:${ad.color}` },
            ad.brand,
          ),
          el("span", { class: "site-card__title" }, ad.title),
          el("span", { class: "site-card__desc" }, ad.desc),
        ),
      ),
    ),
  );
}

function renderNewsHome(ctx: GameContext): HTMLElement {
  const featured = NEWS.slice(0, 2);
  const list = NEWS.slice(2, 7);

  const featuredCol = el(
    "div",
    { class: "news-featured" },
    ...featured.map((a) =>
      el(
        "button",
        { class: "news-card", onclick: () => open(ctx, a.id) },
        thumb(a.id, "news-card__thumb"),
        el(
          "div",
          { class: "news-card__body" },
          el("div", { class: "news-card__title" }, a.title),
          el("div", { class: "news-card__meta" }, `${a.source} · ${a.time}`),
        ),
      ),
    ),
  );

  const listCol = el(
    "div",
    { class: "news-list" },
    ...list.map((a) =>
      el(
        "button",
        { class: "news-row", onclick: () => open(ctx, a.id) },
        el("span", { class: "news-row__title" }, a.title),
        el("span", { class: "news-row__source" }, a.source),
      ),
    ),
  );

  return el(
    "div",
    { class: "portal" },
    el("div", { class: "portal__hero" }, searchBar(ctx)),
    adBanner(ctx),
    lottoBlock(ctx),
    el("div", { class: "portal-blocks" }, stocksBlock(ctx), shopBlock(ctx)),
    el(
      "div",
      { class: "portal-news-wrap" },
      el("div", { class: "portal-news-head" }, "뉴스"),
      el("div", { class: "portal-news-grid" }, featuredCol, listCol),
    ),
    sitesBlock(ctx),
  );
}

function renderArticle(ctx: GameContext, a: Article): HTMLElement {
  return el(
    "div",
    { class: "portal" },
    el(
      "div",
      { class: "article-page" },
      el(
        "button",
        {
          class: "article-back",
          onclick: () => {
            ctx.ui.portalArticleId = null;
            ctx.refresh();
          },
        },
        "← 뉴스 목록",
      ),
      el("div", { class: "article-source" }, a.source),
      el("h1", { class: "article-title" }, a.title),
      el("div", { class: "article-meta" }, a.time),
      thumb(a.id, "article-thumb"),
      ...a.body.map((p) => el("p", { class: "article-body" }, p)),
      el(
        "button",
        {
          class: "article-tweet-btn",
          onclick: () => ctx.openModal((c) => renderComposeModal(c, undefined, a.title)),
        },
        icon("pen", { size: 16 }),
        "이 기사로 트윗 쓰기",
      ),
      el("div", { class: "article-footer" }, `ⓒ ${a.source} · 무단 전재 및 재배포 금지`),
    ),
  );
}
