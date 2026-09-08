import * as THREE from "three";
import { PLANK } from "./blocks";
import { World, WORLD_D, WORLD_W } from "./world";
import { Player, type Keys } from "./player";
import { ZombieField, type ZombieKind } from "./zombies";
import { WEAPONS, weaponById, type UpgradeId } from "./weapons";
import { UPGRADES } from "./weapons";

export const BLOCK_COST = 25;

export type HudState = {
  health: number;
  maxHealth: number;
  coins: number;
  kills: number;
  wave: number;
  waveLeft: number;
  ammo: number;
  magazine: number;
  reloading: boolean;
  weaponId: string;
  weaponName: string;
  owned: string[];
  upgrades: Record<UpgradeId, number>;
  hitFlash: number;
  hurtFlash: number;
  dead: boolean;
  banner: string | null;
  locked: boolean;
  message: string | null;
};

export type EngineOptions = {
  canvas: HTMLCanvasElement;
  onHud: (state: HudState) => void;
  onDeath: (summary: { kills: number; coins: number; wave: number }) => void;
  initial?: {
    coins?: number;
    kills?: number;
    owned?: string[];
    upgrades?: Partial<Record<UpgradeId, number>>;
  };
};

const WAVE_GAP = 6;

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private world: World;
  private zombies: ZombieField;
  player: Player;

  private keys: Keys = {};
  private raf = 0;
  private last = 0;
  private clock = 0;
  private running = false;
  private disposed = false;

  private wave = 0;
  private waveTimer = 3;
  private spawnQueue: ZombieKind[] = [];
  private spawnCd = 0;
  private banner: string | null = "GET READY";
  private bannerUntil = 3;
  private message: string | null = null;
  private messageUntil = 0;

  private hitFlash = 0;
  private dead = false;
  private locked = false;

  private highlight: THREE.LineSegments;
  private tracers: {
    line: THREE.Line;
    life: number;
  }[] = [];
  private muzzle: THREE.PointLight;
  private tracerMaterial: THREE.LineBasicMaterial;

  private firing = false;
  private hudAccum = 0;

  constructor(private opts: EngineOptions) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0xc76b3a);

    this.camera = new THREE.PerspectiveCamera(78, 1, 0.1, 400);

    this.scene.fog = new THREE.Fog(0xb9663a, 40, 190);
    this.scene.background = new THREE.Color(0xc76b3a);

    const hemi = new THREE.HemisphereLight(0xffd6a5, 0x3a2412, 1.15);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb066, 1.35);
    sun.position.set(-60, 80, 30);
    this.scene.add(sun);

    this.world = new World(1337);
    this.scene.add(this.world.group);

    this.zombies = new ZombieField(this.world);
    this.scene.add(this.zombies.group);

    this.player = new Player(this.world);
    const init = opts.initial;
    if (init) {
      this.player.coins = init.coins ?? 0;
      this.player.kills = init.kills ?? 0;
      for (const id of init.owned ?? []) this.player.owned.add(id);
      for (const [k, v] of Object.entries(init.upgrades ?? {})) {
        this.player.upgrades[k as UpgradeId] = v ?? 0;
      }
    }
    this.player.applyUpgradeStats();
    this.player.spawn(WORLD_W / 2, WORLD_D / 2);
    this.player.health = this.player.maxHealth;

    // block highlight wireframe
    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }),
    );
    box.dispose();
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this.tracerMaterial = new THREE.LineBasicMaterial({
      color: 0xffd9a0,
      transparent: true,
      opacity: 0.85,
    });

    this.muzzle = new THREE.PointLight(0xffc27a, 0, 14, 2);
    this.scene.add(this.muzzle);

    this.bindEvents();
    this.resize();
  }

  // ---- lifecycle ---------------------------------------------------

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.loop();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    // Clamp so an alt-tab does not teleport everything on the next frame.
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.clock += dt;
    this.tick(dt);
    this.render();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unbindEvents();
    this.world.dispose();
    this.zombies.dispose();
    for (const t of this.tracers) t.line.geometry.dispose();
    this.tracerMaterial.dispose();
    this.renderer.dispose();
  }

  // ---- input -------------------------------------------------------

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
    if (e.code === "Space") e.preventDefault();
    if (this.dead) return;

    if (e.code === "KeyR") this.player.startReload();
    if (e.code === "KeyQ") this.breakBlock();
    if (e.code === "KeyE") this.placeBlock();

    const slot = Number(e.key);
    if (slot >= 1 && slot <= WEAPONS.length) {
      const w = WEAPONS[slot - 1];
      if (this.player.owned.has(w.id)) this.player.equip(w.id);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    const s = 0.0022;
    this.player.yaw -= e.movementX * s;
    this.player.pitch -= e.movementY * s;
    const limit = Math.PI / 2 - 0.02;
    this.player.pitch = Math.max(-limit, Math.min(limit, this.player.pitch));
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.locked || this.dead) return;
    if (e.button === 0) {
      this.firing = true;
      this.tryFire();
    } else if (e.button === 2) {
      this.placeBlock();
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.firing = false;
      // Semi-auto guns need one click per shot, so the latch clears on release.
      this.firingLatch = false;
    }
  };

  private onContext = (e: Event) => e.preventDefault();

  private onPointerLockChange = () => {
    this.locked = document.pointerLockElement === this.opts.canvas;
    if (!this.locked) {
      this.firing = false;
      this.keys = {};
    }
    this.pushHud(true);
  };

  private bindEvents() {
    addEventListener("keydown", this.onKeyDown);
    addEventListener("keyup", this.onKeyUp);
    addEventListener("mousemove", this.onMouseMove);
    addEventListener("mouseup", this.onMouseUp);
    addEventListener("resize", this.resize);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    this.opts.canvas.addEventListener("mousedown", this.onMouseDown);
    this.opts.canvas.addEventListener("contextmenu", this.onContext);
  }

  private unbindEvents() {
    removeEventListener("keydown", this.onKeyDown);
    removeEventListener("keyup", this.onKeyUp);
    removeEventListener("mousemove", this.onMouseMove);
    removeEventListener("mouseup", this.onMouseUp);
    removeEventListener("resize", this.resize);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.opts.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.opts.canvas.removeEventListener("contextmenu", this.onContext);
  }

  requestLock() {
    if (!this.dead) this.opts.canvas.requestPointerLock();
  }

  releaseLock() {
    if (document.pointerLockElement === this.opts.canvas) document.exitPointerLock();
  }

  resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  // ---- simulation --------------------------------------------------

  private tick(dt: number) {
    if (this.dead) {
      this.zombies.sync(this.clock);
      return;
    }

    if (this.locked) {
      this.player.update(dt, this.keys);
    }

    if (this.firing) this.tryFire();

    this.zombies.update(dt, this.player.position, (damage) => {
      this.player.hurt(damage, this.clock);
      if (this.player.health <= 0) this.die();
    });

    this.updateWaves(dt);
    this.world.flush();
    this.zombies.sync(this.clock);

    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.muzzle.intensity > 0) {
      this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 30);
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      const mat = t.line.material as THREE.LineBasicMaterial;
      mat.opacity = Math.max(0, t.life * 12);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        mat.dispose();
        this.tracers.splice(i, 1);
      }
    }

    if (this.bannerUntil > 0) {
      this.bannerUntil -= dt;
      if (this.bannerUntil <= 0) this.banner = null;
    }
    if (this.messageUntil > 0) {
      this.messageUntil -= dt;
      if (this.messageUntil <= 0) this.message = null;
    }

    this.updateHighlight();

    this.hudAccum += dt;
    if (this.hudAccum > 0.06) {
      this.hudAccum = 0;
      this.pushHud();
    }
  }

  private updateWaves(dt: number) {
    if (this.spawnQueue.length > 0) {
      this.spawnCd -= dt;
      if (this.spawnCd <= 0) {
        this.spawnCd = 0.28;
        const kind = this.spawnQueue.pop()!;
        this.spawnAtRing(kind);
      }
      return;
    }

    if (this.zombies.alive > 0) return;

    this.waveTimer -= dt;
    if (this.waveTimer > 0) return;

    this.wave += 1;
    this.waveTimer = WAVE_GAP;
    this.banner = `WAVE ${this.wave}`;
    this.bannerUntil = 2.4;

    const count = 4 + Math.floor(this.wave * 2.2);
    const queue: ZombieKind[] = [];
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      if (this.wave >= 4 && roll > 0.88) queue.push("brute");
      else if (this.wave >= 2 && roll > 0.58) queue.push("runner");
      else queue.push("walker");
    }
    this.spawnQueue = queue;
    this.spawnCd = 0.6;
  }

  private spawnAtRing(kind: ZombieKind) {
    const healthScale = 1 + (this.wave - 1) * 0.16;
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 24 + Math.random() * 14;
      const x = this.player.position.x + Math.cos(angle) * radius;
      const z = this.player.position.z + Math.sin(angle) * radius;
      if (x < 2 || z < 2 || x > WORLD_W - 2 || z > WORLD_D - 2) continue;
      this.zombies.spawn(kind, x, z, healthScale);
      return;
    }
    // Fell through: drop it near the arena edge rather than skipping a spawn.
    this.zombies.spawn(kind, WORLD_W / 2 + 20, WORLD_D / 2, healthScale);
  }

  // ---- combat ------------------------------------------------------

  private tryFire() {
    const p = this.player;
    const w = p.weapon;
    if (p.cooldown > 0 || p.reloading > 0) return;
    if (p.ammo <= 0) {
      p.startReload();
      return;
    }
    if (!w.auto && this.firingLatch) return;

    this.firingLatch = !w.auto;
    p.cooldown = 60 / w.rpm;
    p.ammo -= 1;
    p.recoilPitch += w.recoil * 0.012;

    const origin = p.eyePosition();
    const base = p.lookDirection();
    this.muzzle.position.copy(origin);
    this.muzzle.intensity = 3.2;

    let anyHit = false;

    for (let pellet = 0; pellet < w.pellets; pellet++) {
      const dir = base.clone();
      if (w.spread > 0) {
        dir.x += (Math.random() - 0.5) * w.spread * 2;
        dir.y += (Math.random() - 0.5) * w.spread * 2;
        dir.z += (Math.random() - 0.5) * w.spread * 2;
        dir.normalize();
      }

      const wallHit = this.world.raycast(origin, dir, w.range);
      const wallDist = wallHit ? wallHit.dist : w.range;
      const zombieHit = this.zombies.pick(origin, dir, w.range);

      let end: THREE.Vector3;
      if (zombieHit && zombieHit.dist < wallDist) {
        const mult = zombieHit.headshot ? 2.1 : 1;
        const reward = this.zombies.damage(
          zombieHit.zombie,
          w.damage * p.damageMultiplier * mult,
        );
        if (reward) {
          p.coins += reward;
          p.kills += 1;
        }
        anyHit = true;
        end = origin.clone().addScaledVector(dir, zombieHit.dist);
      } else {
        end = origin.clone().addScaledVector(dir, wallDist);
      }

      if (pellet < 4) this.addTracer(origin, end);
    }

    if (anyHit) this.hitFlash = 0.14;
    if (p.ammo === 0) p.startReload();
  }

  private firingLatch = false;

  private addTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      // Start the streak just below the eye so it reads as coming from the gun.
      from.clone().add(new THREE.Vector3(0, -0.16, 0)),
      to,
    ]);
    const line = new THREE.Line(geo, this.tracerMaterial.clone());
    this.scene.add(line);
    this.tracers.push({ line, life: 0.07 });
  }

  private die() {
    if (this.dead) return;
    this.dead = true;
    this.releaseLock();
    this.pushHud(true);
    this.opts.onDeath({
      kills: this.player.kills,
      coins: this.player.coins,
      wave: this.wave,
    });
  }

  // ---- building ----------------------------------------------------

  private targetBlock() {
    const origin = this.player.eyePosition();
    const dir = this.player.lookDirection();
    return this.world.raycast(origin, dir, 6);
  }

  private updateHighlight() {
    const hit = this.targetBlock();
    if (!hit) {
      this.highlight.visible = false;
      return;
    }
    this.highlight.visible = true;
    this.highlight.position.set(
      hit.hit.x + 0.5,
      hit.hit.y + 0.5,
      hit.hit.z + 0.5,
    );
  }

  private breakBlock() {
    const hit = this.targetBlock();
    if (!hit) return;
    this.world.set(hit.hit.x, hit.hit.y, hit.hit.z, 0);
  }

  private placeBlock() {
    if (this.player.coins < BLOCK_COST) {
      this.flash(`Need ${BLOCK_COST} coins to place a barricade`);
      return;
    }
    const hit = this.targetBlock();
    if (!hit) return;
    const { place } = hit;

    // Never seal the player inside their own barricade.
    const px = Math.floor(this.player.position.x);
    const pz = Math.floor(this.player.position.z);
    const py = Math.floor(this.player.position.y);
    for (let dy = 0; dy <= 1; dy++) {
      if (place.x === px && place.z === pz && place.y === py + dy) return;
    }

    this.world.set(place.x, place.y, place.z, PLANK);
    this.player.coins -= BLOCK_COST;
  }

  private flash(text: string) {
    this.message = text;
    this.messageUntil = 1.8;
  }

  // ---- shop --------------------------------------------------------

  buyWeapon(id: string) {
    const w = weaponById(id);
    if (this.player.owned.has(id)) {
      this.player.equip(id);
      return true;
    }
    if (this.player.coins < w.price) {
      this.flash("Not enough coins");
      return false;
    }
    this.player.coins -= w.price;
    this.player.owned.add(id);
    this.player.equip(id);
    this.pushHud(true);
    return true;
  }

  buyUpgrade(id: UpgradeId) {
    const up = UPGRADES.find((u) => u.id === id);
    if (!up) return false;
    const level = this.player.upgrades[id];
    if (level >= up.max) return false;
    const cost = up.cost(level);
    if (this.player.coins < cost) {
      this.flash("Not enough coins");
      return false;
    }
    this.player.coins -= cost;
    this.player.upgrades[id] = level + 1;
    this.player.applyUpgradeStats();
    if (id === "health") this.player.health = this.player.maxHealth;
    this.pushHud(true);
    return true;
  }

  // ---- output ------------------------------------------------------

  private render() {
    const eye = this.player.eyePosition();
    this.camera.position.copy(eye);
    this.camera.rotation.set(0, 0, 0, "YXZ");
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch + this.player.recoilPitch;
    this.renderer.render(this.scene, this.camera);
  }

  pushHud(force = false) {
    if (this.disposed && !force) return;
    const p = this.player;
    this.opts.onHud({
      health: Math.round(p.health),
      maxHealth: p.maxHealth,
      coins: p.coins,
      kills: p.kills,
      wave: this.wave,
      waveLeft: this.zombies.alive + this.spawnQueue.length,
      ammo: p.ammo,
      magazine: p.weapon.mag,
      reloading: p.reloading > 0,
      weaponId: p.weaponId,
      weaponName: p.weapon.name,
      owned: [...p.owned],
      upgrades: { ...p.upgrades },
      hitFlash: Math.max(0, this.hitFlash),
      hurtFlash: Math.max(0, 1 - (this.clock - p.lastHurt) * 2.2),
      dead: this.dead,
      banner: this.banner,
      locked: this.locked,
      message: this.message,
    });
  }

  /** Clears the once-per-click latch so semi-auto guns fire again. */
  releaseTrigger() {
    this.firingLatch = false;
  }
}
