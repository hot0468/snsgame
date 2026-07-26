import type { Account, AttributeId, Tweet } from "@/core/types";
import { uid, randInt } from "@/utils/random";

/**
 * 고정 NPC 계정들 — 각자 **전용 트윗 풀**만 쓰는 정체성 계정.
 *
 * omenAccount(새벽 세 시의 예언)와 같은 부류다. 일반 남 계정은 카테고리 풀
 * (allTemplatesFor)에서 문구를 뽑지만, 이 계정들은 아래 정의한 전용 풀에서만 뽑는다.
 * 둘러보기 '계정 탐색'에 낮은 확률로 끼어들어 발견된다(exploreSystem.exploreAccounts).
 * id는 고정이라 팔로우하면 상태가 일관되게 유지된다.
 *
 * 새 고정 NPC를 추가하려면 SPECIAL_ACCOUNTS에 정의 하나만 더 넣으면 된다
 * (exploreSystem은 SPECIAL_ACCOUNT_MAKERS를 통째로 굴린다).
 */
interface SpecialAccountDef {
  id: string;
  name: string;
  handle: string;
  bio: string;
  followers: number;
  /** 이 계정 글이 표시될 계열(피드 섞임·궁합용) */
  attribute: AttributeId;
  /** 전용 트윗 풀 */
  tweets: string[];
}

const SPECIAL_ACCOUNTS: SpecialAccountDef[] = [
  // ── 리딩방 '세력' 계정 ──────────────────────────────
  {
    id: "npc_leadroom",
    name: "장마감 리딩방 [무료]",
    handle: "lead_master",
    bio: "무료방 오픈 중 | 수익 인증은 유료방에서 | 종목 문의는 DM",
    followers: 8_888,
    attribute: "finance",
    tweets: [
      "어제 내가 짚어준 종목, 오늘 상한가. 아직도 안 믿는 사람 있나?",
      "개미는 지금 던지고, 세력은 지금 담는다. 그 차이가 계좌를 가른다.",
      "무료방 인원 곧 마감. 유료방 수익률은 차원이 다릅니다.",
      "3일 안에 두 배. 못 기다리는 사람은 애초에 부자 될 그릇이 아니다.",
      "차트는 거짓말 안 한다. 거짓말하는 건 네 손가락이다.",
      "지금 물린 그 종목, 손절해라. 다음 자리는 내가 잡아준다.",
      "오늘 종가 확인했나? 어제 이 방에서 뭐라고 했는지 다시 봐라.",
      "수익 인증 스샷 도배는 안 한다. 진짜는 조용히 담을 뿐이다.",
      "이번 주 목표가 도달. 못 탄 사람은 다음 기회를 기다려라.",
      "고점 물타기는 하수, 저점 분할매수는 고수. 지금 넌 어디 있나.",
      "증권방송에서 떠들 때면 이미 늦은 거다. 우린 그 전에 들어간다.",
      "무료로 이 정도 정보를 주는 곳, 또 있으면 나가도 좋다.",
      "감으로 사지 마라. 세력의 발자국을 읽어라. 방법은 유료방에서.",
      "네 계좌가 파란 건 시장 탓이 아니라 정보 탓이다. 정보는 여기 있다.",
      "지금 이 글 보고 망설이는 순간에도, 누군가는 담고 있다.",
      "떨어질 때 못 파는 게 손실이 아니라, 오를 종목을 못 잡는 게 손실이다.",
    ],
  },

  // ── 감성 명언 봇 ────────────────────────────────────
  {
    id: "npc_quotebot",
    name: "오늘의 위로 한 스푼",
    handle: "warm_words",
    bio: "매일 밤 마음에 한 줄 🌙 | 힘든 당신에게 | 공유는 사랑입니다",
    followers: 12_400,
    attribute: "daily",
    tweets: [
      "당신이 지금 힘든 건, 그만큼 열심히 살고 있다는 증거예요.",
      "괜찮아요. 새벽이 가장 어두운 건, 곧 해가 뜨기 때문이니까요.",
      "지나간 것은 지나간 대로, 다 그런 의미가 있는 거예요.",
      "오늘 하루도 버텨낸 당신, 그것만으로 충분히 대단해요.",
      "비교하지 마세요. 꽃마다 피는 계절이 다른 거니까요.",
      "포기하고 싶은 그 순간이, 사실은 성공에 가장 가까운 순간이에요.",
      "당신을 힘들게 하는 사람에게, 당신의 하루를 내주지 마세요.",
      "완벽하지 않아도 괜찮아요. 우린 사람이니까요.",
      "가끔은 아무것도 하지 않아도 돼요. 쉬는 것도 용기예요.",
      "누군가는 오늘도 당신 덕분에 웃었을 거예요.",
      "실패는 끝이 아니라, 방향을 바꾸라는 신호일 뿐이에요.",
      "당신은 생각보다 훨씬 강한 사람이에요. 여기까지 왔잖아요.",
      "울고 싶을 땐 울어도 돼요. 눈물도 마음의 청소니까요.",
      "오늘 심은 작은 노력이, 언젠가 큰 그늘이 되어줄 거예요.",
      "행복은 크기가 아니라 빈도예요. 오늘 작은 행복 하나 챙기세요.",
      "당신의 속도로 가도 괜찮아요. 인생은 경주가 아니에요.",
      "이 글이 오늘 당신에게 닿았다면, 그건 우연이 아니에요.",
      "(제 계정엔 광고 없어요. 마음만 담습니다.) 오늘도 수고 많았어요.",
    ],
  },

  // ── 게임 내 서비스 공식봇 (네이놈 포털) ──────────────
  {
    id: "npc_naenom_official",
    name: "네이놈 공식",
    handle: "naenom_official",
    bio: "네이놈 서비스 공식 안내 계정입니다. 문의는 고객센터로.",
    followers: 512_000,
    attribute: "it",
    tweets: [
      "[점검] 오늘 새벽 2시~4시 서버 점검이 예정되어 있습니다. 이용에 참고 바랍니다.",
      "[공지] 네이놈 검색 순위는 조작되지 않습니다. 다시 한 번 안내드립니다.",
      "[이벤트] 출석체크하고 포인트 받아가세요! (선착순 소진 시 조기 종료될 수 있습니다.)",
      "[안내] 메일함 용량이 가득 찼습니다. 추가 용량은 유료로 전환 가능합니다.",
      "[업데이트] 새로워진 네이놈 메인, 어떠신가요? 피드백은 소중히 접수됩니다.",
      "[주의] 최근 '무료 홍보' 사칭 계정이 많습니다. 공식 계정은 이 계정 하나뿐입니다.",
      "[점검 지연] 예정된 점검이 다소 길어지고 있습니다. 조금만 더 기다려 주세요.",
      "[공지] 개인정보 처리방침이 개정되었습니다. 자세한 내용은 링크에서 (링크는 곧 첨부됩니다).",
      "[당첨 안내] 지난 이벤트 당첨자께 개별 연락드렸습니다. 미확인 시 자동 소멸됩니다.",
      "[안내] 무료 이모티콘 이벤트가 종료되었습니다. 성원에 감사드립니다.",
      "[긴급] 일시적인 접속 지연이 있었습니다. 현재는 정상화되었습니다. 불편을 드려 죄송합니다.",
      "[공지] 뉴스 댓글 정책이 강화됩니다. 건전한 이용 문화에 동참해 주세요.",
      "[업데이트] 이제 뒤로가기를 두 번 누르셔야 종료됩니다. 더 편리해진 네이놈!",
      "[안내] 고객센터 상담 대기 인원이 많습니다. 예상 대기시간: 무한대.",
      "[이벤트] 친구 초대하고 캐시 받으세요! (친구가 3일 이상 접속해야 지급됩니다.)",
      "[공지] 아이디당 계정 1개 원칙을 다시 안내드립니다. 부계정은 제재 대상입니다.",
    ],
  },
];

/** 풀에서 서로 다른 n개를 뽑는다(풀이 작으면 있는 만큼). */
function pickDistinct(pool: string[], n: number): string[] {
  const out: string[] = [];
  const used = new Set<number>();
  const count = Math.min(n, pool.length);
  while (out.length < count) {
    const i = randInt(0, pool.length - 1);
    if (used.has(i)) continue;
    used.add(i);
    out.push(pool[i]);
  }
  return out;
}

/** 고정 NPC 계정 객체를 만든다(전용 풀에서 서로 다른 3개를 뽑아 타임라인 구성). */
function makeSpecialAccount(def: SpecialAccountDef, day: number): Account {
  const timeline: Tweet[] = pickDistinct(def.tweets, 3).map((text, i) => ({
    id: uid("special"),
    authorName: def.name,
    authorHandle: def.handle,
    attribute: def.attribute,
    isAdult: false,
    text,
    createdDay: day - i,
    likes: randInt(120, 2_400),
    retweets: randInt(20, 600),
    gainedFollowers: 0,
  }));
  return {
    id: def.id,
    name: def.name,
    handle: def.handle,
    attribute: def.attribute,
    isAdult: false,
    bio: def.bio,
    followers: def.followers,
    timeline,
    followed: false,
  };
}

/** exploreSystem이 굴리는 고정 NPC 팩토리 목록(각 (day)=>Account). */
export const SPECIAL_ACCOUNT_MAKERS: ((day: number) => Account)[] = SPECIAL_ACCOUNTS.map(
  (def) => (day: number) => makeSpecialAccount(def, day),
);
