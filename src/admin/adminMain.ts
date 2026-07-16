/**
 * 어드민(개발자용) 도감 — 게임 내 UI가 아니라, 개발자가 숨은 이벤트/트리거를
 * 한눈에 확인하기 위한 별도 페이지. `admin.html`로 진입한다(예: /admin.html).
 * 여기서는 게임 상태를 바꾸지 않고, 데이터/규칙을 읽어와 표로 보여주기만 한다.
 */
import { GAME_EVENTS, type EventEffect, type GameEvent } from "@/data/events";
import { CONTROVERSY_EVENTS } from "@/data/controversies";
import { ATTRIBUTES } from "@/data/attributes";
import { ALL_WORKS, popularWork } from "@/data/works";
import { monthlyNewCosmetics } from "@/data/cosmetics";
import { HOUSINGS } from "@/data/housing";
import { Store } from "@/core/store";
import { createInitialState } from "@/core/state";
import { createUIState, type GameContext } from "@/ui/context";
import { renderWishSite } from "@/ui/wishSite";
import { renderGoblinShop } from "@/ui/goblinShop";
import { WISHES, WISH_MONEY_PENALTY, rollWishOptions } from "@/systems/wish";
import { GOBLIN_ITEMS } from "@/data/goblin";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** EventEffect 데이터를 사람이 읽는 요약으로 */
function fmtEffect(e: EventEffect): string {
  const p: string[] = [];
  if (e.action) p.push(`행동력 ${signed(e.action)}`);
  if (e.mental) p.push(`정신력 ${signed(e.mental)}`);
  if (e.morality) p.push(`도덕성 ${signed(e.morality)}`);
  if (e.reputation) p.push(`평판 ${signed(e.reputation)}`);
  if (e.money) p.push(`돈 ${signed(e.money)}`);
  if (e.followers) p.push(`팔로워 ${signed(e.followers)}`);
  if (e.followersPct) p.push(`팔로워 ${signed(e.followersPct)}%`);
  for (const [k, v] of Object.entries(e.skills ?? {})) p.push(`${k} ${signed(v ?? 0)}`);
  if (e.unlockAttribute) p.push(`속성해금:${e.unlockAttribute}`);
  if (e.customKey) p.push(`특수효과:${e.customKey}`);
  return p.join(", ") || "효과 없음";
}

function eventTable(title: string, events: GameEvent[], note: string): string {
  const rows = events
    .map((ev) => {
      const choices = ev.choices
        .map(
          (c) =>
            `<div class="choice"><b>${esc(c.label)}</b> — <span class="eff">${esc(fmtEffect(c.effect))}</span>` +
            (c.result ? `<div class="res">→ ${esc(c.result)}</div>` : "") +
            (c.requires ? `<span class="req">[노출조건 있음]</span>` : "") +
            `</div>`,
        )
        .join("");
      return `<tr>
        <td class="id">${esc(ev.id)}</td>
        <td>
          <div class="t">${esc(ev.title)}</div>
          <div class="d">${esc(ev.description)}</div>
        </td>
        <td class="meta">
          트리거: ${ev.triggers.length ? esc(ev.triggers.join(", ")) : "(강제/없음)"}<br/>
          가중치: ${ev.weight ?? 1}<br/>
          발생조건: ${ev.condition ? "있음" : "없음"}
        </td>
        <td>${choices}</td>
      </tr>`;
    })
    .join("");
  return `<section>
    <h2>${esc(title)} <span class="count">${events.length}</span></h2>
    <p class="note">${esc(note)}</p>
    <table><thead><tr><th>id</th><th>제목/설명</th><th>발생</th><th>선택지·효과</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </section>`;
}

interface Ref {
  title: string;
  trigger: string;
  effect: string;
}
function refTable(title: string, note: string, rows: Ref[]): string {
  const body = rows
    .map(
      (r) =>
        `<tr><td class="t">${esc(r.title)}</td><td>${esc(r.trigger)}</td><td>${esc(r.effect)}</td></tr>`,
    )
    .join("");
  return `<section>
    <h2>${esc(title)} <span class="count">${rows.length}</span></h2>
    <p class="note">${esc(note)}</p>
    <table><thead><tr><th>이벤트</th><th>트리거(발생 조건)</th><th>효과/보상</th></tr></thead>
    <tbody>${body}</tbody></table>
  </section>`;
}

/* ─────── 코드로 구동되는 숨은 기능(수기 정리) ─────── */

const EGGS: Ref[] = [
  { title: "코인 리딩방 접선", trigger: "코인 이스터에그 트윗에 좋아요", effect: "리딩방 DM 도착(사기 유인)" },
  { title: "다단계 설명회 권유", trigger: "다단계 이스터에그 트윗에 좋아요", effect: "이사님 DM 도착(다단계 유인)" },
  { title: "길고양이 집사 데뷔", trigger: "동물 이스터에그 트윗에 좋아요 3회", effect: "정신력 +12, 동네 주민 카톡" },
  { title: "찐친 되기", trigger: "같은 계정 트윗에 좋아요/리트윗 누적 5회", effect: "친근 DM + 팔로워 +3~10" },
  { title: "유령 팔로우 대숙청", trigger: "봇/유령 계정 누적 5회 팔로우", effect: "팔로워 15%↓, 운영팀 경고 카톡" },
  { title: "트윗 도배 역풍", trigger: "하루 트윗 10개 초과", effect: "팔로워 5~15↓(초과분마다), 친구 핀잔" },
  { title: "밤샘 인플루언서", trigger: "7일 연속 심야(LATE) 트윗", effect: "팔로워 +30~60" },
  { title: "타락 루트 각성", trigger: "도덕성 0 도달", effect: "'내면의 목소리' 카톡(연출)" },
  { title: "박학다식", trigger: "지식 또는 어휘력 100 도달", effect: "정보·시사·IT 트윗 성과 ×1.3" },
  { title: "레전드 BJ", trigger: "음란 100 + 성인모드", effect: "사바나 도네이션 ×1.5, 사바나 가입 시 +30만원" },
];

const OFFERS: Ref[] = [
  { title: "팬 DM(+후원)", trigger: "팔로워 얻는 행동 직후 35%", effect: "팬 스레드 생성, 확률적 후원금" },
  { title: "티켓 양도 DM", trigger: "아이돌덕/배우덕 트윗 직후 40%", effect: "콘서트/GV 티켓 양도 이벤트" },
  { title: "모텔 제안 DM", trigger: "성인 트윗 직후 40%(종류별)", effect: "모텔 플레이 이벤트" },
  { title: "성기 사진 DM", trigger: "성인계정이 성인 트윗 직후 45%", effect: "5단계 크기 랜덤, 긍정+음란40↑ 시 만남 제안" },
  { title: "러닝크루 초대", trigger: "운동 트윗 직후 50%(미가입)", effect: "가입 시 매주 목요일 정기런 약속" },
  { title: "사바나 여캠 제의", trigger: "성인 트윗 직후(확률)", effect: "계약 시 매 심야 라이브방송 해금" },
  { title: "유료 구독 채널", trigger: "성인계정 이벤트(미개설)", effect: "개설 시 매달 구독 수익(음란도 비례)" },
  { title: "작가 계약 제안", trigger: "창작 트윗 20개↑ + 창작 트윗 직후 50%", effect: "코믹웨이브 DM → 월급·작업량 계약" },
  { title: "까칠한외눈 소원 링크", trigger: "둘러보기에 낮은 확률 트윗 → 좋아요", effect: "소원 가게 링크 DM(1회용)" },
  { title: "푸시타임 링크 DM", trigger: "애니덕 트윗 + 성인모드 + 음란 40↑ → 40%", effect: "링크 클릭 시 '푸시타임' 성인 콘텐츠 탭 해금" },
];

const LIFE: Ref[] = [
  { title: "강아지/고양이 줍기", trigger: "산책(현생) 시 40%, 미보유 종류", effect: "데려오면 강아지계/고양이계 주접 트윗 해금" },
  { title: "야외노출 이벤트", trigger: "심야 산책 + 성인모드 + 음란 40↑ → 40%", effect: "감행 시 35% 적발(도박): 성공 팔로워↑ / 적발 평판·팔로워↓" },
  { title: "취업 결과 통보", trigger: "채용공고 지원 → 지원 익일", effect: "피메일로 합격/불합격, 합격 메일에서 출근/거절 선택" },
  { title: "스팸 메일 해킹", trigger: "피메일에 하루 25%로 스팸 도착 → 스팸 첫 열람", effect: "15% 확률 해킹: 팔로워 -15%(최소 20), 정신력 -12, 스팸 트윗 도배" },
];

const SPECIAL: Ref[] = [
  { title: "파이어족 엔딩", trigger: "소지금 100억 도달", effect: "'그렇지' 선택 시 FIRE 엔딩 / '더 벌어야지' 시 계속" },
  { title: "연예인 데뷔 엔딩", trigger: "총 팔로워 50만 이상 + 미용 60 이상", effect: "캐스팅 제안 → 데뷔 선택 시 엔딩 / 거절 시 계속" },
  { title: "전업 작가 엔딩", trigger: "작가 계약 정산(근무) 6개월 이상", effect: "작가의 길 제안 → 정착 선택 시 엔딩 / 거절 시 계속" },
  { title: "네이놈 로또 1등", trigger: "복권 구매 → 다음 토요일 이후 확인, 당첨확률 0.5%", effect: "20억 지급" },
  { title: "소원 가게(몽키스포)", trigger: "소원 가게에서 소원 선택", effect: "소원 대상 제외 랜덤 스탯 대폭↓ 또는 돈 410만↓, 정신력↓ (소원은 안 이뤄짐)" },
  { title: "2차창작 인기작 적중", trigger: "애니 2차창작 + 이달의 인기작 선택", effect: "팔로워 증가분 ×2.0" },
  { title: "뷰티 신상품 홍보", trigger: "이달 신상 화장품 보유 + 뷰티 트윗에 홍보", effect: "팔로워 증가분 ×1.6" },
  { title: "주거 단계업(남의방)", trigger: "집 계약(계약금 지불)", effect: "월세↑·기상 회복↑, 아파트↑ 영구 스탯업" },
  { title: "세일 시즌", trigger: "블프(11/22~30)·연말(12/24~31)·신년(1/1~3)·여름(7/10~20)", effect: "쇼핑 전 상품 25~40% 할인" },
  { title: "포토카드/굿즈 가챠", trigger: "쇼핑 → 뽑기(5,000원)", effect: "일반70·레어20·SR8·SSR2% · SR/SSR 자랑 트윗 가능" },
];

const SEASONAL: Ref[] = [
  { title: "🎄 크리스마스", trigger: "매년 12/25", effect: "정신력 +10, 친구 카톡" },
  { title: "🎊 새해", trigger: "매년 1/1", effect: "정신력 +12, 행동력 +15, 새해 다짐" },
  { title: "🧾 연말정산", trigger: "매년 12/31", effect: "75% 환급(+15~60만원) / 25% 추징(-10~35만원)" },
];

/* ─────── 이달의 로테이션 미리보기 ─────── */

function rotationPreview(): string {
  const rows: string[] = [];
  for (let mk = 0; mk < 6; mk++) {
    const pw = popularWork(mk);
    const cos = monthlyNewCosmetics(mk).map((c) => c.name).join(", ");
    rows.push(
      `<tr><td>monthKey ${mk}</td><td>${esc(pw.title)} <span class="tag">${pw.kind}</span></td><td>${esc(cos)}</td></tr>`,
    );
  }
  return `<section>
    <h2>이달 로테이션 미리보기 <span class="count">monthKey 0~5</span></h2>
    <p class="note">monthKey = 연*12 + 월. 2차창작 인기작과 신상 화장품이 달마다 이렇게 바뀝니다. 전체 작품 ${ALL_WORKS.length}종.</p>
    <table><thead><tr><th>달</th><th>2차창작 인기작</th><th>신상 화장품(4종)</th></tr></thead><tbody>${rows.join("")}</tbody></table>
  </section>`;
}

function housingTable(): string {
  const rows = HOUSINGS.map(
    (h, i) =>
      `<tr><td>${i}</td><td class="t">${esc(h.name)}</td><td>${h.rent.toLocaleString("ko-KR")}</td>` +
      `<td>${h.price.toLocaleString("ko-KR")}</td><td>행+${h.actionBonus} / 정+${h.mentalBonus}</td>` +
      `<td>${h.permaSkills ? esc(Object.entries(h.permaSkills).map(([k, v]) => `${k}+${v}`).join(" ")) : "-"}</td></tr>`,
  ).join("");
  return `<section>
    <h2>주거 단계 <span class="count">${HOUSINGS.length}</span></h2>
    <p class="note">단계가 오를수록 월세·회복↑. 아파트(구축)부터 영구 스탯업.</p>
    <table><thead><tr><th>tier</th><th>집</th><th>월세</th><th>계약금</th><th>기상 회복</th><th>영구 스탯업</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

/* ─────── 단발 사이트 미리보기(샌드박스) ─────── */

/** 소원 가게·도깨비 상점 등 링크/키워드로만 진입하는 단발 사이트를 미리보기 섹션 HTML로 */
function oneShotSitesSection(): string {
  const wishRows = WISHES.map(
    (w) => `<tr><td class="t">${esc(w.label)}</td><td>${esc(w.target)}</td></tr>`,
  ).join("");
  const gobRows = GOBLIN_ITEMS.map(
    (g) =>
      `<tr><td class="t">${esc(g.name)}</td><td>${g.price.toLocaleString("ko-KR")}냥</td>` +
      `<td>${esc(Object.entries(g.boosts).map(([k, v]) => `${k}+${v}`).join(" "))}</td></tr>`,
  ).join("");
  return `<section>
    <h2>단발 사이트 미리보기 <span class="count">소원 가게 · 도깨비 상점</span></h2>
    <p class="note">링크/키워드로만 들어갈 수 있는 단발 사이트를 여기서 직접 눌러볼 수 있어요. <b>샌드박스</b>라 실제 게임 진행에는 전혀 영향을 주지 않습니다.</p>

    <h3 class="admin-sub">소원 가게 (까칠한외눈 좋아요 → DM 링크)</h3>
    <button id="wish-reset" class="admin-btn">🔄 소원 다시 뽑기 / 리셋</button>
    <div id="wish-sandbox" class="wish-embed"></div>
    <p class="note" style="margin-top:10px">페널티: <b>소원이 가리키는 대상 제외</b> 랜덤 스탯 <b>-30~50</b> 또는 돈 <b>-${WISH_MONEY_PENALTY.toLocaleString("ko-KR")}원</b> + 정신력 <b>-15~25</b>. (소원은 안 이뤄짐)</p>
    <table><thead><tr><th>소원</th><th>대상(하락 제외)</th></tr></thead><tbody>${wishRows}</tbody></table>

    <h3 class="admin-sub" style="margin-top:22px">도깨비 상점 (네이놈 검색 '열려라 참깨' · 월 1회)</h3>
    <button id="goblin-reset" class="admin-btn">🔄 리셋(금화 100억 지급)</button>
    <div id="goblin-sandbox" class="wish-embed"></div>
    <p class="note" style="margin-top:10px">스탯을 크게 올려주는 레어 아이템을 비싼 값에 판매(아이템당 1회 구매).</p>
    <table><thead><tr><th>아이템</th><th>가격</th><th>스탯 상승</th></tr></thead><tbody>${gobRows}</tbody></table>
  </section>`;
}

/** 소원 가게를 샌드박스 컨텍스트로 실제 렌더링해 붙인다. */
function mountWishSandbox(host: HTMLElement): void {
  const site = document.createElement("div");
  site.className = "wish-embed__frame";

  let store = new Store(createInitialState());
  const ui = createUIState();
  const ctx: GameContext = {
    store,
    ui,
    update: (fn) => store.dispatch(fn),
    refresh: () => {
      // 사이트를 닫으면(소원 안 빎/나가기) 다시 뽑아 계속 눌러볼 수 있게 한다.
      if (ui.wishOptions.length === 0) {
        ui.wishOptions = rollWishOptions();
        ui.wishSiteOpen = true;
      }
      site.replaceChildren(renderWishSite(ctx));
    },
    openModal: () => {},
    closeModal: () => {},
    toast: () => {},
    afterAction: () => {},
  };

  const reset = (): void => {
    store = new Store(createInitialState());
    ctx.store = store;
    ui.wishOptions = rollWishOptions();
    ui.wishSiteOpen = true;
    site.replaceChildren(renderWishSite(ctx));
  };

  host.replaceChildren(site);
  reset();

  const btn = document.getElementById("wish-reset");
  if (btn) btn.addEventListener("click", reset);
}

/** 도깨비 상점을 샌드박스로 렌더링(금화 100억 지급해 구매까지 눌러볼 수 있게). */
function mountGoblinSandbox(host: HTMLElement): void {
  const site = document.createElement("div");
  site.className = "wish-embed__frame";

  let store = new Store(createInitialState());
  const ui = createUIState();
  const ctx: GameContext = {
    store,
    ui,
    update: (fn) => store.dispatch(fn),
    refresh: () => site.replaceChildren(renderGoblinShop(ctx)),
    openModal: () => {},
    closeModal: () => {},
    toast: () => {},
    afterAction: () => {},
  };

  const reset = (): void => {
    store = new Store(createInitialState());
    ctx.store = store;
    store.dispatch((s) => {
      s.money = 10_000_000_000; // 미리보기: 구매 눌러볼 수 있게 금화 넉넉히
    });
    ui.goblinSiteOpen = true;
    site.replaceChildren(renderGoblinShop(ctx));
  };

  host.replaceChildren(site);
  reset();

  const btn = document.getElementById("goblin-reset");
  if (btn) btn.addEventListener("click", reset);
}

function attrTable(): string {
  const rows = Object.values(ATTRIBUTES)
    .map((a) => `<tr><td class="t">${esc(a.label)}</td><td>${esc(a.id)}</td><td>${esc(a.relatedSkills.join(", "))}</td><td>${a.adultOnly ? "성인전용" : "-"}</td></tr>`)
    .join("");
  return `<section>
    <h2>카테고리(속성) <span class="count">${Object.keys(ATTRIBUTES).length}</span></h2>
    <table><thead><tr><th>라벨</th><th>id</th><th>관련 스탯</th><th>비고</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

const STYLE = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0e1116; color: #d7dde6; font: 13px/1.55 -apple-system, "Pretendard", system-ui, sans-serif; }
  header.top { position: sticky; top: 0; z-index: 5; background: #12161d; border-bottom: 1px solid #232a35; padding: 14px 20px; }
  header.top h1 { margin: 0; font-size: 17px; color: #fff; }
  header.top .sub { color: #8b95a3; font-size: 12px; margin-top: 3px; }
  .wrap { padding: 20px; max-width: 1200px; margin: 0 auto; }
  section { margin: 0 0 30px; }
  h2 { font-size: 15px; color: #86b7ff; border-left: 3px solid #3d6fd6; padding-left: 9px; margin: 0 0 6px; }
  .count { color: #6b7686; font-size: 12px; font-weight: 400; }
  .note { color: #8b95a3; margin: 0 0 10px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; background: #141922; border: 1px solid #232a35; border-radius: 8px; overflow: hidden; }
  th { text-align: left; background: #1a212c; color: #9fb0c3; font-weight: 600; padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #232a35; }
  td { padding: 9px 10px; border-bottom: 1px solid #1c232e; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  td.id { color: #6b7686; font-family: ui-monospace, monospace; font-size: 11.5px; white-space: nowrap; }
  td.t, .t { color: #fff; font-weight: 600; }
  td.meta { color: #9aa6b4; font-size: 11.5px; white-space: nowrap; }
  .d { color: #93a0af; font-size: 12px; margin-top: 3px; }
  .choice { padding: 3px 0; border-bottom: 1px dashed #232a35; }
  .choice:last-child { border-bottom: none; }
  .eff { color: #ffd479; }
  .res { color: #7f8b99; font-size: 11.5px; margin-top: 1px; }
  .req { color: #ff8f6b; font-size: 11px; margin-left: 4px; }
  .tag { background: #24405f; color: #9fd0ff; border-radius: 4px; padding: 1px 5px; font-size: 10.5px; }
  .admin-btn { background: #24405f; color: #cfe4ff; border: 1px solid #3d6fd6; border-radius: 6px; padding: 7px 12px; font-size: 12.5px; cursor: pointer; margin-bottom: 10px; }
  .admin-btn:hover { background: #2d4f74; }
  .wish-embed { border: 1px solid #232a35; border-radius: 10px; overflow: hidden; }
  .wish-embed__frame { height: 520px; overflow: auto; }
  /* 소원 가게 자체 스타일(게임 CSS 없이도 보이도록 복제) */
  .wish-site { position: relative; min-height: 100%; display: flex; align-items: center; justify-content: center; padding: 32px 18px; background: radial-gradient(120% 90% at 50% 0%, #241033 0%, #120720 55%, #0a0412 100%); }
  .wish-site__veil { position: absolute; inset: 0; background: radial-gradient(60% 40% at 50% 30%, rgba(180,120,255,0.12), transparent 70%); pointer-events: none; }
  .wish-site__card { position: relative; width: 100%; max-width: 460px; background: rgba(20,10,34,0.86); border: 1px solid rgba(178,130,255,0.35); border-radius: 16px; box-shadow: 0 0 40px rgba(140,70,220,0.25), inset 0 0 24px rgba(120,60,200,0.15); padding: 26px 22px; text-align: center; color: #efe6ff; }
  .wish-site__title { font-size: 20px; font-weight: 800; letter-spacing: .5px; color: #d9b8ff; text-shadow: 0 0 14px rgba(190,130,255,0.6); margin-bottom: 12px; }
  .wish-site__lead { font-size: 14px; line-height: 1.8; white-space: pre-line; color: #c9b8e8; margin: 0 0 20px; }
  .wish-site__result { font-size: 14.5px; line-height: 1.85; white-space: pre-line; color: #e7d8ff; margin: 6px 0 0; }
  .wish-option { display: block; width: 100%; margin: 10px 0; padding: 13px 16px; border-radius: 12px; border: 1px solid rgba(178,130,255,0.4); background: linear-gradient(180deg, rgba(70,36,110,0.6), rgba(44,22,72,0.6)); color: #f2e9ff; font-size: 14.5px; font-weight: 600; cursor: pointer; }
  .wish-option:hover { background: linear-gradient(180deg, rgba(96,50,150,0.75), rgba(60,30,100,0.75)); }
  .wish-option--refuse { margin-top: 18px; border-style: dashed; border-color: rgba(200,200,220,0.3); background: transparent; color: #b7add0; font-weight: 500; }
  .btn { background: #3d6fd6; color: #fff; border: none; border-radius: 8px; padding: 10px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
  .admin-sub { font-size: 13px; color: #cdb99c; margin: 8px 0 8px; }
  /* 도깨비 상점 스타일(게임 CSS 없이도 보이도록 복제) */
  .goblin-site { position: relative; min-height: 100%; display: flex; align-items: flex-start; justify-content: center; padding: 30px 18px; background: radial-gradient(120% 90% at 50% 0%, #3a1d10 0%, #1e1108 55%, #0c0704 100%); }
  .goblin-site__veil { position: absolute; inset: 0; background: radial-gradient(60% 40% at 50% 20%, rgba(255,180,90,0.14), transparent 70%); pointer-events: none; }
  .goblin-site__card { position: relative; width: 100%; max-width: 560px; background: rgba(34,20,10,0.9); border: 1px solid rgba(230,170,90,0.4); border-radius: 16px; box-shadow: 0 0 40px rgba(200,120,40,0.25), inset 0 0 24px rgba(180,110,40,0.15); padding: 24px 22px; text-align: center; color: #f6e9d6; }
  .goblin-site__title { font-size: 21px; font-weight: 800; color: #ffcf87; text-shadow: 0 0 14px rgba(255,180,90,0.55); margin-bottom: 10px; }
  .goblin-site__lead { font-size: 13.5px; line-height: 1.75; white-space: pre-line; color: #e2cfb2; margin: 0 0 16px; }
  .goblin-list { display: flex; flex-direction: column; gap: 10px; text-align: left; }
  .goblin-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(230,170,90,0.28); background: linear-gradient(180deg, rgba(70,42,20,0.6), rgba(46,28,14,0.6)); }
  .goblin-item__body { flex: 1; min-width: 0; }
  .goblin-item__name { font-size: 15px; font-weight: 800; color: #ffe0ad; }
  .goblin-item__desc { font-size: 12px; color: #cdb99c; margin: 2px 0 5px; line-height: 1.5; }
  .goblin-item__boost { font-size: 12px; font-weight: 700; color: #9fe6a0; }
  .goblin-item__buy { flex: 0 0 auto; text-align: right; }
  .goblin-item__price { font-size: 13.5px; font-weight: 800; color: #ffcf87; margin-bottom: 6px; }
  .goblin-item__owned { font-size: 12px; color: #b7ab97; }
  .goblin-buy { border: 1px solid #e6aa5a; background: linear-gradient(180deg, #d98b34, #b06a1f); color: #fff5e6; font-weight: 800; font-size: 13.5px; padding: 8px 18px; border-radius: 9px; cursor: pointer; }
  .goblin-buy--off { opacity: 0.45; cursor: not-allowed; }
  .goblin-leave { margin-top: 18px; border: 1px dashed rgba(230,200,160,0.4); background: transparent; color: #d8c6ab; font-size: 13.5px; padding: 9px 18px; border-radius: 9px; cursor: pointer; }
  .goblin-site__foot { font-size: 11.5px; color: #a8977f; margin: 12px 0 0; }
`;

function render(): void {
  const root = document.getElementById("admin");
  if (!root) return;
  root.innerHTML =
    `<style>${STYLE}</style>` +
    `<header class="top"><h1>🛠 어드민 · 숨은 이벤트 도감</h1>` +
    `<div class="sub">개발자용 참고 페이지 · 게임 상태를 바꾸지 않습니다 · admin.html</div></header>` +
    `<div class="wrap">` +
    refTable("이스터에그", "특정 조건에서 조용히 발동되는 숨은 이벤트(1회성 위주).", EGGS) +
    refTable("DM·오퍼", "특정 행동 직후 확률적으로 도착하는 제안 DM.", OFFERS) +
    refTable("현생·산책·취업", "현생 살기(오프라인)에서 발생하는 특수 이벤트.", LIFE) +
    refTable("엔딩·특수·부스트", "엔딩 조건과 특수 배율/보상.", SPECIAL) +
    refTable("계절·연말 이벤트", "실제 달력 날짜에 1회 발생.", SEASONAL) +
    oneShotSitesSection() +
    eventTable("랜덤 이벤트 풀", GAME_EVENTS, "행동(트리거) 직후 기본 30% 확률로 조건을 만족하는 후보 중 가중 추첨.") +
    eventTable("논란/박제 시나리오", CONTROVERSY_EVENTS, "사기·성인·저평판 상태에서 강제로 터지는 논란 이벤트.") +
    rotationPreview() +
    housingTable() +
    attrTable() +
    `</div>`;

  // 문자열 렌더 후, 단발 사이트는 실제 컴포넌트를 샌드박스로 마운트
  const wishHost = document.getElementById("wish-sandbox");
  if (wishHost) mountWishSandbox(wishHost);
  const goblinHost = document.getElementById("goblin-sandbox");
  if (goblinHost) mountGoblinSandbox(goblinHost);
}

render();
