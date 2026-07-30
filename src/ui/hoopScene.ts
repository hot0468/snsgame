import Phaser from "phaser";

/**
 * 오락실 농구 슛 **물리 미니게임**(Phaser 3 + Matter).
 *
 * ⚠️ **득점은 물리가 정한다.** 확률 추첨이 아니다 — 공이 실제로 림 두 기둥 사이를
 *    위에서 아래로 통과했을 때만 1점이다(ui/arcadeScene.ts 인형뽑기와 같은 원칙).
 *    난이도를 만지려면 아래 `TUNING` 하나만 보면 된다.
 *
 * ⚠️ 이 파일은 **동적 import 전용**이다(ui/hoopModal.ts가 농구기를 열 때만 불러온다).
 *    정적으로 import하면 Phaser 1.1MB가 첫 화면 번들에 들어간다.
 *
 * ⚠️ 씬은 자기 상태만 만지고, 게임 상태(소지금·최고기록)는 **콜백으로 바깥에 알린다**.
 *    여기서 store를 직접 건드리면 data→systems→ui 단방향이 깨진다.
 */

/** 물리 세계 좌표계(캔버스 픽셀) */
const W = 520;
const H = 340;

/** 공 반지름(px) */
const BALL_R = 17;
/** 공이 출발하는 자리 — 화면 아래 왼쪽(오른쪽 위 림을 향해 쏜다) */
const START_X = 120;
const START_Y = H - 52;

/** 림 중심 x — 오른쪽에 매단다 */
const RIM_X = 400;
/** 림 높이(작을수록 높다) */
const RIM_Y = 132;
/** 림 안쪽 반폭(px). 공 반지름보다 넉넉해야 들어간다 */
const RIM_HALF = 30;
/** 림 기둥(좌우 작은 강체) 반지름 */
const RIM_POST_R = 5;

/**
 * 난이도 손잡이. **이 게임이 쉬운지 어려운지는 전부 여기서 정해진다.**
 */
const TUNING = {
  /** 당긴 거리 1px당 붙는 속도. 새총 세기다 */
  power: 0.135,
  /**
   * 최대 당김 거리(px).
   * ⚠️ **반드시 클램프한다.** 안 하면 캔버스 밖까지 끌어 공이 화면을 벗어난다.
   */
  maxPull: 150,
  /** 공 반발(림·백보드에 튄다) */
  restitution: 0.6,
  /** 공 마찰 — 너무 낮으면 림 위에서 미끄러지기만 한다 */
  friction: 0.04,
  /** 슛한 공이 이 시간(ms) 뒤에도 안 멈추면 강제 리셋한다(끼임 방지) */
  deadMs: 4_000,
  /** 이 속도 아래로 떨어지면 '멈췄다'고 본다 */
  restSpeed: 0.6,
  /** 멈춘 뒤 다음 공까지 기다리는 시간(ms) */
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

type Body = MatterJS.BodyType;

export class HoopScene extends Phaser.Scene {
  private ev!: HoopSceneEvents;

  private ball!: Body;
  private ballG!: Phaser.GameObjects.Arc;
  private g!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private flash!: Phaser.GameObjects.Text;

  /** ready=조준 가능 / flying=공이 날아가는 중 / over=시간 종료 */
  private phase: "ready" | "flying" | "over" = "ready";
  private score = 0;
  private remainMs = 30_000;

  /** 드래그 중인지와 현재 당긴 지점 */
  private dragging = false;
  private dragX = 0;
  private dragY = 0;

  /** 이번 슛이 이미 득점 처리됐는지 — 한 번의 슛으로 두 번 세지 않는다 */
  private scoredThisShot = false;
  /** 공이 림 높이 위쪽에 있었는지 — 위→아래 통과 판정에 쓴다 */
  private wasAboveRim = false;
  /** 슛한 시각(끼임 강제 리셋용) */
  private shotAt = 0;
  /** 리셋이 예약됐는지 */
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
    const M = this.matter;
    // 좌우와 바닥만 막는다. 천장을 막으면 세게 쏜 공이 위에서 튕겨 되돌아와 어색하다.
    M.world.setBounds(0, -200, W, H + 200, 40, true, true, false, true);

    // 백보드(림 뒤쪽 정적 사각형)
    M.add.rectangle(RIM_X + RIM_HALF + 26, RIM_Y - 34, 12, 92, {
      isStatic: true,
      restitution: 0.4,
    });

    // 림 좌우 두 기둥 — **이 사이를 통과해야 득점**이다.
    for (const s of [-1, 1] as const) {
      M.add.circle(RIM_X + s * RIM_HALF, RIM_Y, RIM_POST_R, {
        isStatic: true,
        restitution: 0.5,
      });
    }

    // 공
    this.ball = M.add.circle(START_X, START_Y, BALL_R, {
      restitution: TUNING.restitution,
      friction: TUNING.friction,
      frictionAir: 0.006,
      density: 0.0018,
    }) as unknown as Body;
    M.body.setStatic(this.ball, true);

    this.ballG = this.add.circle(START_X, START_Y, BALL_R, 0xe8763a).setDepth(5);
    this.g = this.add.graphics().setDepth(4);

    this.hud = this.add
      .text(12, 10, "", { fontSize: "18px", color: "#ffffff", fontStyle: "bold" })
      .setDepth(20);
    this.flash = this.add
      .text(W / 2, 76, "", { fontSize: "26px", color: "#ffd166", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0);

    this.setupDrag();
    this.updateHud();
  }

  /**
   * 드래그(새총) 입력. **pointer 단일 경로**라 마우스와 터치를 함께 받는다.
   * ⚠️ 캔버스 어디를 눌러도 당길 수 있게 했다 — 공(반지름 17px)만 잡게 하면
   *    모바일에서 조준이 지나치게 까다롭다.
   */
  private setupDrag(): void {
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.phase !== "ready") return;
      this.dragging = true;
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

  /** 지금 당긴 벡터(공 → 포인터의 반대 방향, 최대 거리로 클램프) */
  private pullVector(): { x: number; y: number; len: number } {
    const dx = START_X - this.dragX;
    const dy = START_Y - this.dragY;
    const raw = Math.hypot(dx, dy);
    if (raw < 0.001) return { x: 0, y: 0, len: 0 };
    const len = Math.min(raw, TUNING.maxPull);
    return { x: (dx / raw) * len, y: (dy / raw) * len, len };
  }

  /** 손을 뗐다 — 당긴 반대 방향으로 공을 던진다 */
  private shoot(): void {
    if (this.phase !== "ready") return;
    const pull = this.pullVector();
    // 살짝 눌렀다 뗀 것은 슛이 아니다(오터치 방지).
    if (pull.len < 12) return;

    const M = this.matter;
    M.body.setStatic(this.ball, false);
    M.body.setPosition(this.ball, { x: START_X, y: START_Y }, false);
    M.body.setAngularVelocity(this.ball, 0);
    M.body.setVelocity(this.ball, {
      x: pull.x * TUNING.power,
      y: pull.y * TUNING.power,
    });

    this.phase = "flying";
    this.scoredThisShot = false;
    // 출발 지점은 림보다 아래다 — 그래서 처음엔 '위에 없었다'로 시작한다.
    this.wasAboveRim = false;
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

    const pos = this.ball.position;
    this.ballG.setPosition(pos.x, pos.y);

    if (this.phase === "flying") {
      this.checkGoal();
      this.checkSettled();
    }

    this.updateHud();
    this.draw();
  }

  /**
   * 득점 판정 — 공이 림 두 기둥 **사이를 위에서 아래로** 통과했는가.
   *
   * ⚠️ 방향 판정(`velocity.y > 0`)이 없으면 아래에서 위로 튀어 오른 공이 득점으로
   *    잡힌다(실제로 흔한 버그다). 그래서 '림 위에 있었다'는 사실을 먼저 기록해두고,
   *    내려오면서 통과할 때만 인정한다.
   */
  private checkGoal(): void {
    if (this.scoredThisShot) return;
    const { x, y } = this.ball.position;

    // 림보다 확실히 위에 올라간 적이 있어야 한다(공 반지름만큼 여유).
    if (y < RIM_Y - BALL_R && Math.abs(x - RIM_X) < RIM_HALF) {
      this.wasAboveRim = true;
      return;
    }
    if (!this.wasAboveRim) return;

    const goingDown = this.ball.velocity.y > 0;
    const insideRim = Math.abs(x - RIM_X) < RIM_HALF - 2;
    const belowRim = y > RIM_Y + BALL_R * 0.4;

    if (goingDown && insideRim && belowRim) {
      this.scoredThisShot = true;
      this.score += 1;
      this.ev.onScore(this.score);
      this.showFlash("들어갔다!");
    }
  }

  /** 공이 멈췄거나 너무 오래 굴러다니면 다음 공을 올린다 */
  private checkSettled(): void {
    if (this.resetting) return;
    const v = this.ball.velocity;
    const speed = Math.hypot(v.x, v.y);
    const tooLong = this.time.now - this.shotAt > TUNING.deadMs;
    const offscreen = this.ball.position.y > H + 80;

    if (speed < TUNING.restSpeed || tooLong || offscreen) {
      this.resetting = true;
      if (!this.scoredThisShot) this.ev.onMiss();
      this.time.delayedCall(TUNING.resetMs, () => this.resetBall());
    }
  }

  /** 다음 슛을 위해 공을 출발 지점에 되돌린다 */
  private resetBall(): void {
    if (this.phase === "over") return;
    const M = this.matter;
    M.body.setVelocity(this.ball, { x: 0, y: 0 });
    M.body.setAngularVelocity(this.ball, 0);
    M.body.setPosition(this.ball, { x: START_X, y: START_Y }, false);
    M.body.setStatic(this.ball, true);
    this.phase = "ready";
    this.resetting = false;
    this.scoredThisShot = false;
    this.wasAboveRim = false;
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

  /** 림·백보드·조준선을 그린다 */
  private draw(): void {
    const g = this.g;
    g.clear();

    // 백보드
    g.fillStyle(0xf2f2f2, 0.9);
    g.fillRoundedRect(RIM_X + RIM_HALF + 20, RIM_Y - 80, 12, 92, 3);
    g.lineStyle(3, 0xc0335f, 1);
    g.strokeRect(RIM_X + RIM_HALF - 4, RIM_Y - 44, 26, 30);

    // 림(두 기둥을 잇는 선) + 그물
    g.lineStyle(5, 0xe0426f, 1);
    g.beginPath();
    g.moveTo(RIM_X - RIM_HALF, RIM_Y);
    g.lineTo(RIM_X + RIM_HALF, RIM_Y);
    g.strokePath();

    g.lineStyle(1.5, 0xffffff, 0.65);
    for (let i = 0; i <= 6; i += 1) {
      const t = i / 6;
      const topX = RIM_X - RIM_HALF + t * (RIM_HALF * 2);
      const botX = RIM_X - RIM_HALF * 0.5 + t * RIM_HALF;
      g.beginPath();
      g.moveTo(topX, RIM_Y);
      g.lineTo(botX, RIM_Y + 30);
      g.strokePath();
    }

    // 조준 중이면 당김 화살표와 예상 궤적을 그린다
    if (this.dragging && this.phase === "ready") this.drawAim();
  }

  /**
   * 당김 화살표 + 예상 궤적 점선.
   * ⚠️ 텍스트 게임 플레이어에게 물리 감각을 주는 장치다 — 궤적 없이 던지면
   *    첫 판이 통째로 감 잡기에 날아간다.
   */
  private drawAim(): void {
    const g = this.g;
    const pull = this.pullVector();
    if (pull.len < 1) return;

    // 당긴 방향(공에서 손가락 쪽으로) 고무줄
    g.lineStyle(3, 0xffd166, 0.9);
    g.beginPath();
    g.moveTo(START_X, START_Y);
    g.lineTo(START_X - pull.x, START_Y - pull.y);
    g.strokePath();

    // 예상 궤적 — **실제 Matter 적분과 같은 식**으로 그린다. 근사치를 쓰면 점선과
    // 공이 따로 놀아서 조준 보조가 오히려 방해가 된다(실제로 그랬다).
    //   Engine: force.y = mass × gravity.y × 0.001  →  Body.update:
    //   velocity += (force/mass) × dt²  =  0.001 × 1 × (1000/60)² ≈ 0.2778 px/프레임²
    //   그리고 매 프레임 frictionAir(0.006)만큼 감쇠한다.
    const GRAVITY_PER_FRAME = 0.001 * (1000 / 60) ** 2;
    const AIR = 1 - 0.006;
    let px = START_X;
    let py = START_Y;
    let vx = pull.x * TUNING.power;
    let vy = pull.y * TUNING.power;
    g.fillStyle(0xffffff, 0.55);
    for (let step = 1; step <= 90; step += 1) {
      vx *= AIR;
      vy = vy * AIR + GRAVITY_PER_FRAME;
      px += vx;
      py += vy;
      if (px < 0 || px > W || py > H) break;
      if (step % 4 === 0) g.fillCircle(px, py, 2.5);
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
    physics: { default: "matter", matter: { gravity: { x: 0, y: 1 }, debug: false } },
    scene: HoopScene,
  });
  game.scene.start("hoop", { events, durationMs });
  return { game, scene: () => game.scene.getScene("hoop") as HoopScene | undefined };
}
