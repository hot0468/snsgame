/**
 * snsgame 브라우저 드라이버 골격.
 *
 * 스크래치패드에 복사해 쓴다(프로젝트에 남기지 마라). 사용법은 SKILL.md 참조.
 *   1) cd $SCRATCH/driver && npm init -y && npm install puppeteer-core
 *   2) 프로젝트에서 `npm run dev` (백그라운드)
 *   3) node driver.mjs
 *
 * 아래 "여기부터 시나리오"만 목적에 맞게 바꾸면 된다.
 */
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = process.env.APP_URL || "http://localhost:5173/";
const OUT = process.env.SHOT_DIR || ".";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--window-size=1280,860"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 860 });
// 하얀 화면의 원인은 대개 여기 찍힌다.
page.on("pageerror", (e) => console.log("  [PAGE ERROR] " + e.message));

const wait = (ms = 600) => new Promise((r) => setTimeout(r, ms));
const shot = async (n) => {
  await page.screenshot({ path: `${OUT}/${n}.png` });
  console.log(`  📸 ${n}.png  ← Read로 반드시 열어서 봐라`);
};
/** 모달 안 텍스트. body.innerText는 페이지 전체를 긁어와 쓸모없다. */
const modalText = () =>
  page.$eval(".modal", (el) => el.innerText).catch(() => "(모달 없음)");
/** 정확한 라벨의 버튼을 누른다. scope로 좁히면 중복 라벨을 피할 수 있다. */
const clickByText = (label, scope = "body") =>
  page.evaluate(
    (l, s) => {
      const root = document.querySelector(s);
      const b = [...(root?.querySelectorAll("button") ?? [])].find(
        (x) => x.textContent.trim() === l,
      );
      if (!b) return false;
      b.click();
      return true;
    },
    label,
    scope,
  );

/** 로그인 화면을 통과해 게임 화면까지 간다. 아이디는 영문·숫자·밑줄만 받는다. */
async function login(name = "테스터", handle = "tester") {
  await page.goto(URL, { waitUntil: "networkidle2" });
  // 저장본이 있으면 로그인 화면을 건너뛴다 — 깨끗한 상태로 시작하려면 필수.
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle2" });
  await wait();

  const inputs = await page.$$("input");
  if (inputs.length < 2) throw new Error("로그인 input을 못 찾았다: " + inputs.length);
  await inputs[0].type(name);
  await inputs[1].type(handle);
  if (!(await clickByText("로그인"))) throw new Error("로그인 버튼을 못 찾았다");
  await wait(900);
}

// ── 여기부터 시나리오 ─────────────────────────────────────
await login();
await shot("01_game");

// 예: 트윗 작성 2단계까지
await clickByText("게시하기"); // 네비·컴포저에 하나씩 있다. 둘 다 모달을 연다.
await wait(700);
console.log("=== 1단계 ===\n" + (await modalText()));
await shot("02_step1");

await page.click(".modal .chip"); // 초기 계정은 '일상' 하나뿐이다
await wait(400);
await clickByText("다음", ".modal");
await wait(600);
console.log("=== 2단계 ===\n" + (await modalText()));
await shot("03_step2");

// 예: CSS 실측 — 눈으로 보는 것과 함께 쓰면 확실하다
console.log(
  "실측: " +
    JSON.stringify(
      await page.evaluate(() => {
        const el = document.querySelector(".compose-step");
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, textAlign: cs.textAlign };
      }),
    ),
);

await browser.close();
