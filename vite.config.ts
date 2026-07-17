import { defineConfig, type Plugin } from "vite";
import { fileURLToPath, URL } from "node:url";
import { access, mkdir, writeFile } from "node:fs/promises";

/**
 * 중복 이름에 붙는 접미사 구분자(`커피` → `커피__2`).
 *
 * ⚠️ `src/data/mediaImages.ts`·`src/data/youtubeImages.ts`·`src/data/tweetCatImages.ts`가
 *    **같은 값으로** 접미사를 떼어내 키워드/카테고리/속성을 만든다. 한쪽만 바꾸면
 *    `커피__2.webp`의 키워드가 `커피__2`가 되어 영영 어떤 트윗에도 안 붙는다
 *    (너튜브는 `animal__2`가 어떤 영상에도, 트윗 카테고리는 `idol__2`가 어떤 트윗에도 안 붙는다).
 *
 * ⚠️ 왜 그냥 뒤에 숫자(`커피2`)가 아닌가 — 키워드에 숫자가 정당하게 들어갈 수 있어서다.
 *    숫자만 떼는 규칙이면 `아이폰15`가 `아이폰`으로 뭉개진다. 구분자를 둬야 모호함이 없다.
 */
const DEDUP_SEP = "__";

/** 파일명 화이트리스트 — 한글·영문·숫자·밑줄·하이픈만. `../`·경로구분자·널바이트·절대경로를 전부 막는다. */
const SAFE_NAME = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9_-]{1,50}$/;
const WEBP_PREFIX = "data:image/webp;base64,";

/**
 * 저장 가능한 폴더 — **키 조회지 문자열 결합이 아니다.**
 * 요청이 준 값을 경로에 붙이면 `../`로 어디든 쓸 수 있으므로, 아는 키만 받고 나머지는 400.
 * media=트윗 이미지(파일명=키워드) · items=아이템 이미지(파일명=아이템 id)
 * · youtube=너튜브 썸네일(파일명=영상 카테고리)
 * · adult=성인 트윗 이미지(파일명은 **매칭에 안 쓰인다** — 어드민이 `adult` 고정으로 보낸다)
 * · tweetcat=트윗 카테고리 이미지(파일명=트윗 속성 AttributeId — 어드민이 목록에서 고른다).
 */
const DIRS: Record<string, string> = {
  media: "src/assets/media",
  items: "src/assets/items",
  youtube: "src/assets/youtube",
  adult: "src/assets/adult",
  tweetcat: "src/assets/tweetcat",
};

/**
 * 같은 이름을 또 저장하면 "한 장 더 추가"인 폴더들 — `uniqueName`으로 번호를 비켜 간다.
 * items는 여기 넣지 마라(파일명이 아이템 id라 덮어쓰는 게 맞다 — uniqueName 주석).
 * adult는 이름이 `adult` 고정이라 **번호가 유일한 구분**이다 — 빼면 매번 한 장을 덮어쓴다.
 * tweetcat은 한 속성에 여러 장을 두고 트윗 id 해시로 택1하는 설계다(youtube와 같다) —
 * 빼면 아이돌 이미지를 두 장 넣을 수 없다.
 */
const DEDUP_DIRS = new Set(["media", "youtube", "adult", "tweetcat"]);

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * 안 쓰인 파일명을 찾는다 — 이미 있으면 `이름__2`, `이름__3` … 순으로 비켜간다.
 *
 * ⚠️ **DEDUP_DIRS(media·youtube·adult) 전용이다. 아이템(items)에 쓰지 마라.**
 *    트윗·너튜브 이미지는 한 키워드/카테고리에 여러 장을 두고 그중 하나가 해시로 붙는
 *    설계라(imageForTweet·imageForVideo), 같은 이름을 또 저장하는 건 "한 장 더 추가"다.
 *    반면 아이템은 파일명이 아이템 id이고
 *    1:1이라, 다시 저장하는 건 "그 아이템의 사진 교체"다 — 여기에 번호를 붙이면
 *    `pm_yoga_mat__2.webp`가 생기고 그건 어떤 아이템 id와도 일치하지 않아 영영 안 쓰인다.
 */
async function uniqueName(dir: string, name: string): Promise<string> {
  if (!(await exists(`${dir}/${name}.webp`))) return name;
  for (let i = 2; i <= 99; i++) {
    const candidate = `${name}${DEDUP_SEP}${i}`;
    if (!(await exists(`${dir}/${candidate}.webp`))) return candidate;
  }
  throw new Error(`'${name}' 이름이 이미 99개입니다.`);
}

/**
 * 어드민(개발 도구)이 크롭한 이미지를 src/assets/ 아래에 직접 쓰는 개발 전용 엔드포인트.
 * 백엔드가 없어 dev 서버 미들웨어로 처리한다 — 빌드된 사이트에선 저장이 동작하지 않는 게 정상이다.
 */
function adminMediaSave(): Plugin {
  return {
    name: "admin-media-save",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__admin/save-media", (req, res, next) => {
        if (req.method !== "POST") return next();
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", async () => {
          const send = (status: number, body: object) => {
            res.statusCode = status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(body));
          };
          try {
            const { name, dataUrl, dir: dirKey = "media" } = JSON.parse(
              Buffer.concat(chunks).toString("utf8"),
            );
            const rel = typeof dirKey === "string" ? DIRS[dirKey] : undefined;
            if (!rel) {
              return send(400, {
                ok: false,
                error: `폴더는 ${Object.keys(DIRS).join(" · ")} 만 가능합니다.`,
              });
            }
            if (typeof name !== "string" || !SAFE_NAME.test(name)) {
              return send(400, { ok: false, error: "파일명은 한글·영문·숫자·_·- 만 쓸 수 있습니다." });
            }
            if (typeof dataUrl !== "string" || !dataUrl.startsWith(WEBP_PREFIX)) {
              return send(400, { ok: false, error: "WebP data URL이 아닙니다." });
            }
            const dir = fileURLToPath(new URL(`./${rel}`, import.meta.url));
            await mkdir(dir, { recursive: true });
            // 트윗·너튜브만 중복을 비켜간다. 아이템은 id 1:1이라 덮어쓰는 게 맞다(uniqueName 주석).
            const finalName = DEDUP_DIRS.has(dirKey) ? await uniqueName(dir, name) : name;
            const file = `${dir}/${finalName}.webp`;
            await writeFile(file, Buffer.from(dataUrl.slice(WEBP_PREFIX.length), "base64"));
            // 실제로 쓰인 이름을 돌려준다 — 어드민이 '커피가 아니라 커피__2로 저장됐다'를 보여줘야 한다.
            send(200, { ok: true, path: `${rel}/${finalName}.webp`, name: finalName });
          } catch (e) {
            send(400, { ok: false, error: String(e) });
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [adminMediaSave()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        // 게임 본편과, 개발자용 어드민 페이지들(도감·미디어 편집기)을 함께 빌드
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        admin: fileURLToPath(new URL("./admin.html", import.meta.url)),
        adminMedia: fileURLToPath(new URL("./admin-media.html", import.meta.url)),
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
