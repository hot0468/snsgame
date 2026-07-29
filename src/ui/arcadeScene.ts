import Phaser from "phaser";
import { DOLLS } from "@/data/arcade";

/**
 * 오락실 인형뽑기 **물리 미니게임**(Phaser 3 + Matter).
 *
 * ⚠️ **성공/실패를 여기가 정한다.** 예전엔 systems/arcade.ts가 확률로 판정했지만
 *    지금은 전부 물리다: 집게가 실제로 인형에 걸리는지, 들어 올리는 동안 잡는 힘이
 *    무게를 못 이겨 놓치는지, 떨어진 인형이 배출구에 들어가는지.
 *    → 난이도를 만지려면 아래 `TUNING` 하나만 보면 된다.
 *
 * ⚠️ 이 파일은 **동적 import 전용**이다(ui/arcadeModal.ts가 오락실을 열 때만 불러온다).
 *    정적으로 import하면 Phaser 1.1MB가 첫 화면 번들에 들어간다.
 *
 * ⚠️ 씬은 자기 상태만 만지고, 게임 상태(도감·소지금)는 **콜백으로 바깥에 알린다**.
 *    여기서 store를 직접 건드리면 data→systems→ui 단방향이 깨진다.
 */

/** 물리 세계 좌표계(캔버스 픽셀). 유리장 안쪽 크기다. */
const W = 520;
const H = 340;

/**
 * 물리 몸체 크기 ÷ 그림(이모지) 크기.
 * 1보다 작아야 인형들이 **서로 겹쳐 보인다** — 헝겊 인형이 눌리는 그 느낌이다.
 * 1로 두면 강체가 정확히 맞닿아 이모지 사이가 벌어지고, 무더기가 공중부양처럼 보인다.
 */
const BODY_RATIO = 0.66;

/** 갈래 길이(px) — 집게가 무더기 표면에서 멈출 때 이만큼 위에 선다(그림과 같은 값이다) */
const PRONG_LEN = 26;
/** 갈래가 벌어졌을 때 중심에서의 반폭(px). **그림과 판정이 같이 쓰는 값이다.** */
const PRONG_SPAN = 18;

/**
 * 난이도 손잡이. **이 게임이 쉬운지 어려운지는 전부 여기서 정해진다.**
 * (예전 확률판의 '일반 24% · 레어 4%'에 대응하는 자리)
 */
const TUNING = {
  /** 집게가 좌우로 움직이는 속도(px/초) */
  moveSpeed: 190,
  /** 집게가 내려가고 올라오는 속도(px/초) */
  liftSpeed: 210,
  /** 집게가 내려가는 최대 깊이(바닥에서 이만큼 위까지) */
  floorGap: 26,
  /** 집게가 무는 힘. 인형 무게 × 이 값보다 큰 흔들림이 오면 놓친다 */
  gripStrength: 1.0,
  /**
   * 갈래 사이에 들어와야 잡히는 가로 거리(px).
   * ⚠️ **그려지는 갈래 폭(PRONG_SPAN)을 넘기지 마라.** 넘기면 닿지도 않은 인형이
   *    빨려 들어와 자석처럼 보인다. 눈에 보이는 집게가 곧 판정 범위여야 한다.
   */
  grabReach: PRONG_SPAN - 2,
  /** 갈래 끝보다 이만큼까지 아래에 있는 인형만 닿는다(px) */
  grabDepth: 10,
  /** 일반 인형 질량 */
  massCommon: 1.0,
  /** 레어 인형 질량 — 무거워서 잘 미끄러진다(레어가 레어인 이유) */
  massRare: 2.6,
  /** 집게에 물린 인형이 매 프레임 미끄러질 확률의 기준(질량에 비례) */
  slipBase: 0.008,
  /**
   * **덜컹에 인형이 떨어질 확률**(× 질량). 한 판에 한 번, 다 올라온 직후에 온다.
   * 일반(질량 1) ≈ 14% · 레어(질량 2.6) ≈ 36%.
   */
  joltSlip: 0.14,
} as const;

/** 씬이 바깥(모달)에 알리는 사건 */
export interface ClawSceneEvents {
  /** 동전을 넣어도 되는지 물어본다. false면 집게가 안 내려간다. */
  canPay: () => boolean;
  /** 집게를 내렸다(동전 소모 시점) */
  onDrop: () => void;
  /** 상태 문구가 바뀌었다 */
  onStatus: (text: string) => void;
  /** 인형이 배출구에 떨어졌다 — 판 종료 */
  onCollect: (dollId: string) => void;
  /** 집게가 빈손이거나 놓쳐서 한 판이 끝났다 */
  onFail: (reason: "empty" | "slip") => void;
}

type Body = MatterJS.BodyType;

/** 인형 한 마리의 물리 몸체 + 화면 표시 */
interface DollBody {
  id: string;
  body: Body;
  text: Phaser.GameObjects.Text;
  rare: boolean;
}

export class ClawScene extends Phaser.Scene {
  private ev!: ClawSceneEvents;
  private dolls: DollBody[] = [];
  private clawX = W / 2;
  private clawY = 40;
  /** idle=조준 중 / down=내려가는 중 / grab=집는 중 / up=올라오는 중 */
  private phase: "idle" | "down" | "grab" | "up" = "idle";
  private moveDir = 0;
  private held: DollBody | null = null;
  /** 잡은 순간 인형이 집게에서 얼마나 어긋나 있었는지(그 자세 그대로 올린다) */
  private grabOffX = 0;
  private grabOffY = 0;
  private prongOpen = 1;
  private g!: Phaser.GameObjects.Graphics;
  /** 배출구(왼쪽 아래) 판정 영역 */
  private chute = new Phaser.Geom.Rectangle(6, H - 52, 78, 52);

  constructor() {
    super("claw");
  }

  init(data: { events: ClawSceneEvents }): void {
    this.ev = data.events;
  }

  create(): void {
    const M = this.matter;
    M.world.setBounds(0, 0, W, H, 40, true, true, true, true);

    // 바닥 양 끝의 경사판 — 유리장을 '그릇'으로 만들어 인형이 가운데로 모이게 한다.
    // ⚠️ 이게 없으면 인형이 바닥 전체에 한 겹으로 깔려서 무더기가 생기지 않는다.
    for (const s of [-1, 1] as const) {
      M.add.rectangle(W / 2 + s * (W / 2 - 46), H - 30, 230, 16, {
        isStatic: true,
        angle: s * 0.5,
        friction: 0.9,
      });
    }

    // 인형을 유리장 **가운데로 쏟아붓는다** — 쌓이는 모양은 물리가 정한다(직접 배치하지 않는다).
    // ⚠️ 처음에 폭 전체로 흩뿌렸더니 전부 바닥에 한 줄로 깔려 무더기가 안 생겼다.
    //    좁은 범위에 위에서부터 떨구어야 서로 타고 올라가 산이 된다.
    // 인형이 커진 만큼 마릿수는 줄인다 — 유리장에 안 들어가면 서로 밀어내며 튄다.
    const commons = DOLLS.filter((d) => d.rarity === "common");
    const list = [...DOLLS, ...commons.slice(0, 4)];
    list.forEach((d, i) => {
      const rare = d.rarity === "rare";
      // ⚠️ 반드시 **세계 안**에 만들어야 한다. y<0에 만들면 천장 밖이라 그대로 사라진다.
      //    가운데 좁은 범위에 겹쳐 놓으면 물리가 서로 밀어내며 산으로 정리해준다.
      const x = W / 2 + (((i * 71) % 160) - 80);
      // 레어는 위쪽에 둬서 무더기 꼭대기에 얹히게 한다.
      const y = rare ? 50 + (i % 3) * 40 : 110 + ((i * 47) % 150);
      // ⚠️ 원형으로 만들면 **굴러서 흩어진다**(실제로 바닥에 한 줄로 깔렸다).
      //    모서리를 둥글린 사각형이라야 서로 걸려 쌓인다 — 진짜 인형도 안 구른다.
      // ⚠️ 몸체는 그림보다 **작게** 잡는다(BODY_RATIO). 같은 크기로 두면 강체끼리 밀어내
      //    이모지 사이에 빈틈이 생겨 인형들이 공중에 뜬 것처럼 보인다 — 실제 인형은 눌리고 겹친다.
      const size = (rare ? 60 : 52) * BODY_RATIO;
      const body = M.add.rectangle(x, y, size, size, {
        chamfer: { radius: size * 0.3 },
        restitution: 0.02,
        friction: 1,
        frictionStatic: 1.5,
        mass: rare ? TUNING.massRare : TUNING.massCommon,
      }) as unknown as Body;
      const text = this.add.text(x, y, d.emoji, { fontSize: rare ? "60px" : "52px" }).setOrigin(0.5);
      this.dolls.push({ id: d.id, body, text, rare });
    });

    this.g = this.add.graphics().setDepth(10);

    // 키보드로도 조작할 수 있게 한다(버튼은 모달이 그린다).
    const keys = this.input.keyboard;
    if (keys) {
      keys.on("keydown-LEFT", () => this.setMove(-1));
      keys.on("keydown-RIGHT", () => this.setMove(1));
      keys.on("keyup-LEFT", () => this.setMove(0));
      keys.on("keyup-RIGHT", () => this.setMove(0));
      keys.on("keydown-SPACE", () => this.drop());
    }
  }

  /** 좌우 이동(누르고 있는 동안). 모달의 ◀▶ 버튼이 호출한다. */
  setMove(dir: -1 | 0 | 1): void {
    if (this.phase !== "idle") return;
    this.moveDir = dir;
  }

  /** 집게를 내린다. 모달의 '집게 내리기' 버튼이 호출한다. */
  drop(): void {
    if (this.phase !== "idle") return;
    if (!this.ev.canPay()) return;
    this.moveDir = 0;
    this.phase = "down";
    this.ev.onDrop();
    this.ev.onStatus("집게가 내려간다...");
  }

  update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;

    if (this.phase === "idle" && this.moveDir !== 0) {
      this.clawX = Phaser.Math.Clamp(
        this.clawX + this.moveDir * TUNING.moveSpeed * dt,
        30,
        W - 30,
      );
    }

    if (this.phase === "down") {
      this.clawY += TUNING.liftSpeed * dt;
      this.prongOpen = 1;
      // ⚠️ 바닥까지 뚫고 내려가면 안 된다 — **무더기 표면에서 멈춰야** 위에 쌓인 인형부터 집는다.
      //    (예전엔 항상 바닥 깊이까지 내려가서, 산더미 위를 노려도 맨 아래 인형을 집었다.)
      const stopY = Math.min(H - TUNING.floorGap, this.pileTopUnderClaw() - PRONG_LEN);
      if (this.clawY >= stopY) {
        this.clawY = stopY;
        this.phase = "grab";
        this.time.delayedCall(320, () => this.closeClaw());
      }
    }

    if (this.phase === "grab") {
      // 갈래가 오므라드는 동안 인형이 밀린다(진짜 기계처럼 무더기가 흐트러진다)
      this.prongOpen = Math.max(0, this.prongOpen - dt * 3);
    }

    if (this.phase === "up") {
      this.clawY -= TUNING.liftSpeed * dt;
      if (this.held) this.carry(this.held, dt);
      if (this.clawY <= 40) {
        this.clawY = 40;
        this.finish();
      }
    }

    // 올라온 뒤(덜컹·배출구 이동 구간)에도 물고 있는 인형은 집게를 따라다녀야 한다 —
    // 이 구간은 트윈이 집게만 움직이므로 여기서 매 프레임 붙여준다.
    if (this.phase === "grab" && this.held) this.attach(this.held);

    // 인형 그림을 물리 몸체 위에 얹는다
    for (const d of this.dolls) {
      d.text.setPosition(d.body.position.x, d.body.position.y);
      d.text.setRotation(d.body.angle);
    }
    this.drawClaw();
  }

  /**
   * 지금 집게 바로 아래에 있는 인형 무더기의 **꼭대기 y**(작을수록 높다).
   * 아무것도 없으면 바닥을 돌려준다 — 그때만 집게가 끝까지 내려간다.
   */
  private pileTopUnderClaw(): number {
    let top = H;
    for (const d of this.dolls) {
      if (d === this.held) continue;
      if (Math.abs(d.body.position.x - this.clawX) > TUNING.grabReach) continue;
      top = Math.min(top, d.body.bounds.min.y);
    }
    return top;
  }

  /** 갈래를 오므려 집게 사이에 있는 인형을 잡는다 */
  private closeClaw(): void {
    // ⚠️ **맨 위에 있는 인형**을 집는다(무더기에 파묻힌 아래 인형이 아니라).
    //    집게는 이미 무더기 표면에서 멈춰 있으므로, 갈래 끝 근처에서 가장 높은 놈이 후보다.
    let best: DollBody | null = null;
    let bestTop = Infinity;
    for (const d of this.dolls) {
      if (Math.abs(d.body.position.x - this.clawX) > TUNING.grabReach) continue;
      const top = d.body.bounds.min.y;
      // 갈래 끝보다 아래로 처져 있으면 손이 안 닿는다.
      if (top - (this.clawY + PRONG_LEN) > TUNING.grabDepth) continue;
      if (top < bestTop) {
        bestTop = top;
        best = d;
      }
    }
    // 잡은 순간의 어긋남을 기억해 그대로 끌어올린다.
    // ⚠️ 집게 정중앙으로 옮겨버리면(순간이동) 삐딱하게 걸린 인형이 스르륵 빨려드는
    //    자석처럼 보인다. 걸린 자세 그대로 올라와야 물리로 보인다.
    if (best) {
      this.grabOffX = best.body.position.x - this.clawX;
      this.grabOffY = best.body.position.y - this.clawY;
    }
    this.held = best;
    this.phase = "up";
    if (!best) this.ev.onStatus("집게가 허공을 움켜쥐었다...");
    else this.ev.onStatus("뭔가 잡았다! 올라오는 중...");
  }

  /**
   * 물린 인형을 집게에 붙여 끌어올린다.
   * ⚠️ 여기가 슬립 판정이다 — 무거울수록(레어) 매 프레임 미끄러질 확률이 커진다.
   *    확률표가 아니라 **질량**이 난이도를 만든다는 게 이 재설계의 핵심이다.
   */
  private carry(d: DollBody, dt: number): void {
    this.attach(d);
    const slip = TUNING.slipBase * (d.body.mass / TUNING.gripStrength) * (dt * 60);
    if (Math.random() < slip) {
      this.releaseHeld();
      this.ev.onStatus("다 올라와서 미끄러졌다!");
    }
  }

  /** 물고 있는 인형을 집게에 붙여 둔다(잡은 순간의 어긋남을 유지) */
  private attach(d: DollBody): void {
    const M = this.matter;
    M.body.setPosition(
      d.body,
      { x: this.clawX + this.grabOffX, y: this.clawY + this.grabOffY },
      false,
    );
    M.body.setVelocity(d.body, { x: 0, y: 0 });
  }

  /** 물고 있던 인형을 놓는다(그 자리에서 그대로 떨어진다) */
  private releaseHeld(): void {
    const d = this.held;
    if (!d) return;
    this.held = null;
    this.matter.body.setVelocity(d.body, { x: 0, y: 1.5 });
  }

  /**
   * **덜컹.** 집게가 좌우로 크게 흔들린다 — 진짜 기계가 다 잡은 인형을 떨구는 그 순간이다.
   * 무거운 인형(레어)일수록 이 흔들림에 떨어질 확률이 높다.
   */
  private jolt(onDone: (dropped: boolean) => void): void {
    const base = this.clawX;
    const held = this.held;
    const dropped = held !== null && Math.random() < TUNING.joltSlip * held.body.mass;
    this.ev.onStatus("덜컹!");
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 300,
      onUpdate: (tw) => {
        // 감쇠 진동 — 뒤로 갈수록 잦아든다
        const t = tw.getValue() ?? 0;
        this.clawX = base + Math.sin(t * Math.PI * 7) * 7 * (1 - t);
      },
      onComplete: () => {
        this.clawX = base;
        // 떨어질 운명이면 흔들림이 끝나는 순간 손에서 빠진다.
        if (dropped) this.releaseHeld();
        onDone(dropped);
      },
    });
  }

  /** 집게를 x까지 옮긴다(물고 있으면 같이 간다) */
  private moveTo(x: number, ms: number, onDone: () => void): void {
    this.tweens.addCounter({
      from: this.clawX,
      to: x,
      duration: ms,
      onUpdate: (tw) => {
        this.clawX = tw.getValue() ?? this.clawX;
      },
      onComplete: onDone,
    });
  }

  /** 한 판이 실패로 끝났다 */
  private failRound(reason: "empty" | "slip"): void {
    this.phase = "idle";
    this.prongOpen = 1;
    this.ev.onFail(reason);
  }

  /**
   * 집게가 원위치로 돌아왔다 — 여기가 마지막 고비다.
   * ⚠️ **덜컹은 딱 한 번이다**(다 올라온 직후). 배출구 직전에 한 번 더 넣어봤는데,
   *    구멍 바로 옆에 떨어뜨리는 그림이라 잔인하기만 하고 고장처럼 보였다.
   */
  private finish(): void {
    const held = this.held;
    if (!held) {
      this.failRound("empty");
      return;
    }
    this.phase = "grab";

    this.jolt((dropped) => {
      if (dropped) {
        this.failRound("slip");
        return;
      }
      // 덜컹을 넘겼으면 구멍 위로 옮겨 갈래를 벌린다.
      this.moveTo(this.chute.centerX, 700, () => {
        this.prongOpen = 1;
        this.held = null;
        this.phase = "idle";
        this.ev.onCollect(held.id);
      });
    });
  }

  /** 집게(줄 + 두 갈래)를 그린다 */
  private drawClaw(): void {
    const g = this.g;
    g.clear();
    g.lineStyle(4, 0xc0335f, 1);
    g.beginPath();
    g.moveTo(this.clawX, 0);
    g.lineTo(this.clawX, this.clawY);
    g.strokePath();

    g.fillStyle(0xa82a4f, 1);
    g.fillRoundedRect(this.clawX - 13, this.clawY - 6, 26, 11, 4);

    const spread = 6 + this.prongOpen * (PRONG_SPAN - 6);
    g.fillStyle(0xe0426f, 1);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(this.clawX + s * 4, this.clawY);
      g.lineTo(this.clawX + s * spread, this.clawY + 26);
      g.lineTo(this.clawX + s * (spread + 8), this.clawY + 20);
      g.lineTo(this.clawX + s * 10, this.clawY);
      g.closePath();
      g.fillPath();
    }

    // 경품 배출구
    g.lineStyle(3, 0xff8fb8, 1);
    g.strokeRoundedRect(this.chute.x, this.chute.y, this.chute.width, this.chute.height, 8);
  }
}

/** 캔버스를 만들어 씬을 띄운다. 반환값의 destroy를 반드시 불러야 한다(누수 방지). */
export function mountClawGame(
  parent: HTMLElement,
  events: ClawSceneEvents,
): { game: Phaser.Game; scene: () => ClawScene | undefined } {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    transparent: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: "matter", matter: { gravity: { x: 0, y: 1 }, debug: false } },
    scene: ClawScene,
  });
  game.scene.start("claw", { events });
  return { game, scene: () => game.scene.getScene("claw") as ClawScene | undefined };
}
