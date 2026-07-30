import Phaser from "phaser";

/**
 * 오락실 농구 슛 **물리 미니게임** — 정면 뷰(Phaser 3, 2.5D).
 *
 * ⚠️ **득점은 물리가 정한다.** 확률 추첨이 아니다 — 공이 실제로 림 높이를 **내려오면서**
 *    링 안쪽(반지름 RIM_R)을 통과했을 때만 1점이다(ui/arcadeScene.ts 인형뽑기와 같은 원칙).
 *
 * ⚠️ **Matter를 쓰지 않는다.** 정면 뷰는 공이 화면 안쪽(깊이 z)으로 날아가는데 Matter는 2D라
 *    그 축이 없다. 그래서 (x 좌우 · y 높이 · z 깊이) 3축을 직접 적분하고, 화면에는 원근 투영으로
 *    그린다. 포물선 하나에 물리 엔진을 얹는 것보다 이쪽이 짧고 통제하기 쉽다.
 *    → 좌표는 **월드 단위**(px 아님)다. 화면 좌표는 project()만 만든다.
 *
 * ⚠️ 이 파일은 **동적 import 전용**이다(ui/hoopModal.ts가 농구기를 열 때만 불러온다).
 *    정적으로 import하면 Phaser 1.1MB가 첫 화면 번들에 들어간다.
 *
 * ⚠️ 씬은 자기 상태만 만지고, 게임 상태(소지금·최고기록)는 **콜백으로 바깥에 알린다**.
 */

/** 캔버스 크기(px) */
const W = 520;
const H = 340;

/* ── 원근 투영 ──────────────────────────────────────────────
   카메라는 슛 지점 뒤 FOCAL만큼, 바닥에서 CAM_H만큼 위에 있다.
   월드 (x, y, z) → 화면: 멀수록(z가 클수록) 작고 지평선에 가까워진다. */
const FOCAL = 300;
const CAM_H = 130;
const HORIZON = 96;

/** 공 반지름(월드) */
const BALL_R = 15;
/** 림 안쪽 반지름(월드). 공보다 넉넉해야 들어간다 */
const RIM_R = 34;
/** 림 높이(월드, 바닥 0 기준) */
const RIM_Y = 175;
/** 림까지의 거리(월드 깊이) */
const RIM_Z = 430;

/**
 * 난이도 손잡이. **이 게임이 쉬운지 어려운지는 전부 여기서 정해진다.**
 */
const TUNING = {
  /** 당긴 거리 1px당 붙는 속도(월드/초). 새총 세기다 */
  power: 6,
  /**
   * 최대 당김 거리(px).
   * ⚠️ **반드시 클램프한다.** 안 하면 화면 밖까지 끌어 아무 힘이나 낼 수 있다.
   */
  maxPull: 150,
  /** 발사 각도(도) — 던지는 높이. 세기는 플레이어가, 각도는 기계가 정한다 */
  angleDeg: 52,
  /** 좌우 조준 감도: 가로로 당긴 1px이 만드는 옆속도 */
  sway: 1.6,
  /** 중력(월드/초²) */
  gravity: 900,
  /** 림·백보드 반발 */
  restitution: 0.55,
  /** 슛한 공이 이 시간(ms) 뒤에도 안 끝나면 강제 리셋한다(끼임 방지) */
  deadMs: 4_000,
  /** 공이 끝난 뒤 다음 공까지 기다리는 시간(ms) */
  resetMs: 420,
} as const;

/** 씬이 바깥(모달)에 알리는 사건 */
export interface HoopSceneEvents {
  /** 1골 넣었다 — 누계는 모달이 센다 */
  onScore: (total: number) => void;
  /** 빗나갔다 */
  onMiss: () => void;
  /** 남은 시간이 바뀌었다(ms) */
  onTick: (remainMs: number) => void;
  /** 제한시간이 끝났다 — 최종 득점 */
  onEnd: (score: number) => void;
}

/** 월드 좌표 한 점 */
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export class HoopScene extends Phaser.Scene {
  private ev!: HoopSceneEvents;

  private ballG!: Phaser.GameObjects.Arc;
  private shadowG!: Phaser.GameObjects.Ellipse;
  private back!: Phaser.GameObjects.Graphics;
  private front!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private flash!: Phaser.GameObjects.Text;

  /** ready=조준 가능 / flying=공이 날아가는 중 / over=시간 종료 */
  private phase: "ready" | "flying" | "over" = "ready";
  private score = 0;
  private remainMs = 30_000;

  /** 공의 월드 위치·속도 */
  private p: Vec3 = { x: 0, y: BALL_R, z: 0 };
  private v: Vec3 = { x: 0, y: 0, z: 0 };

  private dragging = false;
  private dragX = 0;
  private dragY = 0;
  /** 새총을 당기기 시작한 지점(여기서 지금 지점까지가 당김 벡터다) */
  private grabX = 0;
  private grabY = 0;

  /** 이번 슛이 이미 득점 처리됐는지 — 한 번의 슛으로 두 번 세지 않는다 */
  private scoredThisShot = false;
  private shotAt = 0;
  private resetting = false;

  constructor() {
    super("hoop");
  }

  init(data: { events: HoopSceneEvents; durationMs: number }): void {
    this.ev = data.events;
    // 남은 시간만 들고 있으면 된다 — 판이 한 번뿐이라 원래 길이를 되돌아볼 일이 없다.
    this.remainMs = data.durationMs;
  }

  create(): void {
    this.back = this.add.graphics().setDepth(1);
    this.shadowG = this.add.ellipse(0, 0, 30, 10, 0x000000, 0.22).setDepth(2);
    this.ballG = this.add.circle(0, 0, BALL_R, 0xe8763a).setDepth(5);
    this.front = this.add.graphics().setDepth(6);

    this.hud = this.add
      .text(12, 10, "", { fontSize: "18px", color: "#ffffff", fontStyle: "bold" })
      .setDepth(20);
    this.flash = this.add
      .text(W / 2, 210, "", { fontSize: "26px", color: "#ffd166", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0);

    this.resetBall();
    this.setupDrag();
    this.updateHud();
  }

  /**
   * 월드 → 화면 투영. 멀수록 작아지고 지평선에 붙는다.
   * `scale`은 그 지점의 축소율이라 공 반지름·림 크기에도 그대로 쓴다.
   */
  private project(p: Vec3): { x: number; y: number; scale: number } {
    const scale = FOCAL / (FOCAL + Math.max(-FOCAL * 0.8, p.z));
    return {
      x: W / 2 + p.x * scale,
      y: HORIZON + (CAM_H - p.y) * scale,
      scale,
    };
  }

  /**
   * 드래그(새총) 입력. **pointer 단일 경로**라 마우스와 터치를 함께 받는다.
   * ⚠️ 정면 뷰라 공은 화면 아래 가운데 한 곳에 고정이다. 그래서 당김은 **누른 지점 기준**이다 —
   *    공 위치 기준으로 재면 화면 아무 데나 눌렀을 때 당김 길이가 제멋대로 튄다.
   */
  private setupDrag(): void {
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.phase !== "ready") return;
      this.dragging = true;
      this.grabX = p.x;
      this.grabY = p.y;
      this.dragX = p.x;
      this.dragY = p.y;
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      this.dragX = p.x;
      this.dragY = p.y;
    });

    const release = (): void => {
      if (!this.dragging) return;
      this.dragging = false;
      this.shoot();
    };
    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);
  }

  /** 지금 당긴 벡터(아래로 당길수록 세다). 최대 거리로 클램프 */
  private pullVector(): { x: number; y: number; len: number } {
    const dx = this.dragX - this.grabX;
    const dy = this.dragY - this.grabY;
    const raw = Math.hypot(dx, dy);
    if (raw < 0.001) return { x: 0, y: 0, len: 0 };
    const len = Math.min(raw, TUNING.maxPull);
    return { x: (dx / raw) * len, y: (dy / raw) * len, len };
  }

  /**
   * 손을 뗐다 — 당긴 만큼 세게, 당긴 좌우만큼 비껴 던진다.
   * ⚠️ 각도는 고정이다. 세기(거리)와 좌우(가로)만 플레이어가 정한다 —
   *    정면 뷰에서 각도까지 주면 조작이 3축이 되어 감을 못 잡는다.
   */
  private shoot(): void {
    if (this.phase !== "ready") return;
    const pull = this.pullVector();
    // 살짝 눌렀다 뗀 것은 슛이 아니다(오터치 방지).
    if (pull.len < 12) return;

    const speed = pull.len * TUNING.power;
    const rad = Phaser.Math.DegToRad(TUNING.angleDeg);
    this.v = {
      // 아래로 당기면 앞으로 나간다. 오른쪽으로 당기면 왼쪽으로 나간다(새총 그대로).
      x: -pull.x * TUNING.sway,
      y: speed * Math.sin(rad),
      z: speed * Math.cos(rad),
    };
    this.p = { x: 0, y: BALL_R, z: 0 };

    this.phase = "flying";
    this.scoredThisShot = false;
    this.shotAt = this.time.now;
    this.resetting = false;
  }

  update(_t: number, deltaMs: number): void {
    if (this.phase !== "over") {
      this.remainMs = Math.max(0, this.remainMs - deltaMs);
      this.ev.onTick(this.remainMs);
      if (this.remainMs <= 0) {
        this.endGame();
        return;
      }
    }

    if (this.phase === "flying") this.step(Math.min(deltaMs, 40) / 1000);

    this.drawScene();
    this.drawBall();
    this.updateHud();
  }

  /** 한 프레임 적분 — 중력·림·백보드·바닥 순서로 본다 */
  private step(dt: number): void {
    const prevY = this.p.y;
    this.v.y -= TUNING.gravity * dt;
    this.p.x += this.v.x * dt;
    this.p.y += this.v.y * dt;
    this.p.z += this.v.z * dt;

    this.checkGoal(prevY);
    this.hitRim(prevY);
    this.hitBackboard();
    this.checkSettled();
  }

  /**
   * 득점 판정 — 공이 림 높이를 **내려오면서** 링 안을 통과했는가.
   *
   * ⚠️ 방향 판정(내려오는 중)이 없으면 아래에서 위로 솟은 공도 득점으로 잡힌다.
   *    그래서 직전 프레임의 높이와 비교해 **위→아래로 가로지른 그 순간**만 본다.
   */
  private checkGoal(prevY: number): void {
    if (this.scoredThisShot) return;
    const crossed = prevY > RIM_Y && this.p.y <= RIM_Y;
    if (!crossed || this.v.y >= 0) return;
    const dist = Math.hypot(this.p.x, this.p.z - RIM_Z);
    if (dist > RIM_R - BALL_R * 0.4) return;

    this.scoredThisShot = true;
    this.score += 1;
    this.ev.onScore(this.score);
    this.showFlash("들어갔다!");
  }

  /**
   * 링(테)에 맞고 튕기는 판정. 림 높이 근처에서 **링 테두리 거리**에 걸리면 밖으로 밀어낸다.
   * 이게 없으면 아깝게 빗나간 공이 그냥 통과해 버려서 '림을 맞혔다'는 감각이 사라진다.
   */
  private hitRim(prevY: number): void {
    if (this.scoredThisShot) return;
    const nearRimY = Math.abs(this.p.y - RIM_Y) < BALL_R || (prevY > RIM_Y) !== (this.p.y > RIM_Y);
    if (!nearRimY) return;
    const dx = this.p.x;
    const dz = this.p.z - RIM_Z;
    const dist = Math.hypot(dx, dz);
    if (Math.abs(dist - RIM_R) > BALL_R) return;

    // 링 테두리에서 바깥/안쪽으로 반사 — 공을 테두리 밖으로 밀어내고 속도를 꺾는다.
    const nx = dist < 0.001 ? 1 : dx / dist;
    const nz = dist < 0.001 ? 0 : dz / dist;
    const outward = dist > RIM_R ? 1 : -1;
    this.p.x = RIM_R * nx + nx * BALL_R * outward;
    this.p.z = RIM_Z + RIM_R * nz + nz * BALL_R * outward;
    this.v.x = nx * Math.abs(this.v.x + this.v.z) * 0.25 * outward;
    this.v.z = nz * Math.abs(this.v.z) * 0.25 * outward;
    this.v.y *= -TUNING.restitution * 0.5;
  }

  /** 백보드(림 뒤 판)에 맞으면 앞으로 튕긴다 */
  private hitBackboard(): void {
    const boardZ = RIM_Z + 34;
    if (this.p.z < boardZ || this.v.z <= 0) return;
    if (Math.abs(this.p.x) > 92) return;
    if (this.p.y < RIM_Y - 14 || this.p.y > RIM_Y + 108) return;
    this.p.z = boardZ;
    this.v.z = -Math.abs(this.v.z) * TUNING.restitution;
  }

  /** 공이 바닥에 닿았거나 너무 오래 굴러다니면 다음 공을 올린다 */
  private checkSettled(): void {
    if (this.resetting) return;
    const landed = this.p.y <= BALL_R && this.v.y < 0;
    const tooLong = this.time.now - this.shotAt > TUNING.deadMs;
    const gone = this.p.z > RIM_Z + 260 || Math.abs(this.p.x) > 320;
    if (!landed && !tooLong && !gone) return;

    if (landed) {
      this.p.y = BALL_R;
      this.v = { x: 0, y: 0, z: 0 };
    }
    this.resetting = true;
    if (!this.scoredThisShot) this.ev.onMiss();
    this.time.delayedCall(TUNING.resetMs, () => this.resetBall());
  }

  /** 다음 슛을 위해 공을 출발 지점에 되돌린다 */
  private resetBall(): void {
    if (this.phase === "over") return;
    this.p = { x: 0, y: BALL_R, z: 0 };
    this.v = { x: 0, y: 0, z: 0 };
    this.phase = "ready";
    this.resetting = false;
    this.scoredThisShot = false;
  }

  /** 제한시간 종료 */
  private endGame(): void {
    this.phase = "over";
    this.dragging = false;
    this.remainMs = 0;
    this.ev.onTick(0);
    this.ev.onEnd(this.score);
  }

  /** 캔버스 가운데 잠깐 뜨는 문구 */
  private showFlash(text: string): void {
    this.flash.setText(text).setAlpha(1);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 900, delay: 260 });
  }

  private updateHud(): void {
    const sec = Math.ceil(this.remainMs / 1000);
    this.hud.setText(`⏱ ${sec}초   🏀 ${this.score}골`);
  }

  /** 공과 그림자를 화면에 옮긴다(멀수록 작다) */
  private drawBall(): void {
    const s = this.project(this.p);
    this.ballG.setPosition(s.x, s.y).setRadius(BALL_R * s.scale);
    // 그림자는 같은 x·z의 **바닥 점**에 그린다 — 공이 얼마나 멀리 갔는지 알려주는 유일한 단서다.
    const g = this.project({ x: this.p.x, y: 0, z: this.p.z });
    this.shadowG
      .setPosition(g.x, g.y)
      .setSize(34 * g.scale, 11 * g.scale)
      .setAlpha(0.25);
    // 공이 림보다 멀리 가면 림 뒤로 숨는다(앞뒤 관계가 안 맞으면 원근이 깨져 보인다).
    this.ballG.setDepth(this.p.z > RIM_Z ? 3 : 5);
  }

  /** 코트·백보드·림·조준선을 그린다 */
  private drawScene(): void {
    const g = this.back;
    g.clear();
    this.front.clear();

    // 코트 바닥(사다리꼴) — 원근을 알려주는 기준면
    const nearL = this.project({ x: -300, y: 0, z: -40 });
    const nearR = this.project({ x: 300, y: 0, z: -40 });
    const farL = this.project({ x: -300, y: 0, z: RIM_Z + 220 });
    const farR = this.project({ x: 300, y: 0, z: RIM_Z + 220 });
    g.fillStyle(0xc98b4b, 0.55);
    g.beginPath();
    g.moveTo(nearL.x, nearL.y);
    g.lineTo(nearR.x, nearR.y);
    g.lineTo(farR.x, farR.y);
    g.lineTo(farL.x, farL.y);
    g.closePath();
    g.fillPath();

    // 깊이 가늠용 가로줄
    g.lineStyle(1.5, 0xffffff, 0.25);
    for (const z of [120, 260, 420, 560]) {
      const a = this.project({ x: -300, y: 0, z });
      const b = this.project({ x: 300, y: 0, z });
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.strokePath();
    }

    // 백보드
    const bz = RIM_Z + 34;
    const bl = this.project({ x: -92, y: RIM_Y + 108, z: bz });
    const br = this.project({ x: 92, y: RIM_Y - 14, z: bz });
    g.fillStyle(0xf6f6f6, 0.92);
    g.fillRoundedRect(bl.x, bl.y, br.x - bl.x, br.y - bl.y, 4);
    g.lineStyle(3, 0xc0335f, 1);
    const il = this.project({ x: -40, y: RIM_Y + 62, z: bz });
    const ir = this.project({ x: 40, y: RIM_Y - 6, z: bz });
    g.strokeRect(il.x, il.y, ir.x - il.x, ir.y - il.y);

    // 림 — 정면에서는 납작한 타원으로 보인다
    const rimC = this.project({ x: 0, y: RIM_Y, z: RIM_Z });
    const rx = RIM_R * rimC.scale;
    const ry = rx * 0.34;
    g.lineStyle(5, 0xe0426f, 1);
    g.strokeEllipse(rimC.x, rimC.y, rx * 2, ry * 2);

    // 그물 — 림 타원에서 아래로 좁아지며 내려온다
    const netBottom = this.project({ x: 0, y: RIM_Y - 46, z: RIM_Z });
    g.lineStyle(1.4, 0xffffff, 0.7);
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      g.beginPath();
      g.moveTo(rimC.x + Math.cos(a) * rx, rimC.y + Math.sin(a) * ry);
      g.lineTo(netBottom.x + Math.cos(a) * rx * 0.45, netBottom.y + Math.sin(a) * ry * 0.45);
      g.strokePath();
    }

    if (this.dragging && this.phase === "ready") this.drawAim();
  }

  /**
   * 당김 고무줄 + 예상 궤적.
   * ⚠️ 궤적은 **실제 적분과 같은 식**으로 그린다. 근사치를 쓰면 점선과 공이 따로 놀아
   *    조준 보조가 오히려 방해가 된다.
   */
  private drawAim(): void {
    const g = this.front;
    const pull = this.pullVector();
    if (pull.len < 1) return;

    const from = this.project(this.p);
    g.lineStyle(3, 0xffd166, 0.9);
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(from.x + pull.x, from.y + pull.y);
    g.strokePath();

    const speed = pull.len * TUNING.power;
    const rad = Phaser.Math.DegToRad(TUNING.angleDeg);
    const p: Vec3 = { x: 0, y: BALL_R, z: 0 };
    const v: Vec3 = {
      x: -pull.x * TUNING.sway,
      y: speed * Math.sin(rad),
      z: speed * Math.cos(rad),
    };
    const dt = 1 / 60;
    g.fillStyle(0xffffff, 0.6);
    for (let step = 1; step <= 130; step += 1) {
      v.y -= TUNING.gravity * dt;
      p.x += v.x * dt;
      p.y += v.y * dt;
      p.z += v.z * dt;
      if (p.y < 0) break;
      if (step % 5 === 0) {
        const s = this.project(p);
        g.fillCircle(s.x, s.y, 2.4 * s.scale);
      }
    }
  }
}

/** 캔버스를 만들어 씬을 띄운다. 반환값의 destroy를 반드시 불러야 한다(누수 방지). */
export function mountHoopGame(
  parent: HTMLElement,
  events: HoopSceneEvents,
  durationMs: number,
): { game: Phaser.Game; scene: () => HoopScene | undefined } {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    transparent: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // ⚠️ 물리 엔진 없음 — 3축 적분을 씬이 직접 한다(파일 상단 주석 참고).
    scene: HoopScene,
  });
  game.scene.start("hoop", { events, durationMs });
  return { game, scene: () => game.scene.getScene("hoop") as HoopScene | undefined };
}
