/**
 * 미디어 트윗 키워드 이미지를 Pexels에서 받아 src/assets/media/<키워드>.webp로 저장한다.
 * data/mediaImages.ts가 그 폴더를 glob하므로 앱 코드는 손댈 필요가 없다(파일명 = 키워드).
 *
 * 키는 .env.local(PEXELS_KEY=...)에 둔다 — .gitignore의 `*.local`에 걸려 커밋되지 않는다.
 *
 *   node --env-file=.env.local scripts/fetch-media-images.mjs           # 목록 파일 전체
 *   node --env-file=.env.local scripts/fetch-media-images.mjs 커피 라면  # 키워드 직접 지정
 *   ... --count 3    한 키워드당 3장(커피.webp, 커피__2.webp, 커피__3.webp)
 *
 * 키워드 파일은 한 줄에 하나. `등산=hiking`처럼 검색어를 따로 줄 수 있다(한글 검색이 부실할 때).
 * 크기 83x40은 의도된 저해상도다 — 화면에서 6배로 늘어나 원본이 뭔지 못 알아보게 한다
 * (data/mediaImages.ts 주석 참고). 이미 있는 파일은 건너뛴다.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src/assets/media");
const KEY = process.env.PEXELS_KEY;
if (!KEY) throw new Error("PEXELS_KEY 환경변수가 필요하다");

const argv = process.argv.slice(2);
const countAt = argv.indexOf("--count");
const perKeyword = countAt >= 0 ? Number(argv[countAt + 1]) : 1;
const words = argv.filter((a, i) => !a.startsWith("--") && i !== countAt + 1);
const lines = words.length
  ? words
  : readFileSync(join(ROOT, "scripts/media-keywords.txt"), "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));

mkdirSync(OUT_DIR, { recursive: true });

/** n번째 장의 파일명(1장째는 접미사 없음 — DEDUP_SEP 규칙과 동일). */
const fileFor = (kw, n) => join(OUT_DIR, `${kw}${n === 1 ? "" : `__${n}`}.webp`);

for (const line of lines) {
  const [kw, query = kw] = line.split("=").map((s) => s.trim());
  const url =
    "https://api.pexels.com/v1/search?orientation=landscape&locale=ko-KR" +
    `&per_page=${perKeyword}&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: KEY } });
  if (!res.ok) {
    console.error(`✗ ${kw}: 검색 실패 ${res.status}`);
    continue;
  }
  const photos = (await res.json()).photos ?? [];
  if (photos.length === 0) {
    console.error(`✗ ${kw}: 검색 결과 없음 (검색어를 '${kw}=english'로 지정해봐라)`);
    continue;
  }
  for (let n = 1; n <= photos.length; n++) {
    const out = fileFor(kw, n);
    if (existsSync(out)) continue; // 이미 등록된 장은 건드리지 않는다
    // Pexels CDN이 리사이즈·webp 변환까지 해준다 — sharp 같은 이미지 라이브러리가 필요 없다.
    const src = `${photos[n - 1].src.original}?auto=compress&cs=tinysrgb&fit=crop&w=83&h=40&fm=webp`;
    const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
    // 실제로 webp가 왔는지 확인 — jpeg가 오면 확장자만 webp인 파일이 되어 브라우저가 거른다.
    if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") {
      console.error(`✗ ${kw}: webp 변환 실패(fm=webp 미지원). 원본 포맷 그대로 저장하려면 glob 확장 필요`);
      continue;
    }
    writeFileSync(out, buf);
    console.log(`✓ ${out.replace(ROOT, ".")} (${buf.length}B)`);
  }
}
