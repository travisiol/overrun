import * as THREE from "three";
import { World } from "./world";

export type ZombieKind = "walker" | "runner" | "brute";

type KindDef = {
  health: number;
  speed: number;
  damage: number;
  scale: number;
  reward: number;
  skin: number;
  shirt: number;
};

const KINDS: Record<ZombieKind, KindDef> = {
  walker: {
    health: 100,
    speed: 1.9,
    damage: 12,
    scale: 1,
    reward: 100,
    skin: 0x7f9159,
    shirt: 0x46402f,
  },
  runner: {
    health: 55,
    speed: 4.3,
    damage: 8,
    scale: 0.9,
    reward: 100,
    skin: 0x93a06a,
    shirt: 0x6a3a2c,
  },
  brute: {
    health: 320,
    speed: 1.4,
    damage: 26,
    scale: 1.45,
    reward: 300,
    skin: 0x5e7040,
    shirt: 0x2f3a22,
  },
};

export type Zombie = {
  kind: ZombieKind;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  facing: number;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  scale: number;
  reward: number;
  phase: number;
  attackCd: number;
  /** >0 while the red damage flash is showing. */
  flash: number;
  /** >0 while collapsing; removed when it reaches 0. */
  dying: number;
  onGround: boolean;
};

/** Local transform of each body part, in zombie units (feet at y=0). */
const PARTS = [
  { name: "legL", size: [0.22, 0.82, 0.26], at: [-0.16, 0.41, 0], swing: 1 },
  { name: "legR", size: [0.22, 0.82, 0.26], at: [0.16, 0.41, 0], swing: -1 },
  { name: "torso", size: [0.64, 0.76, 0.36], at: [0, 1.2, 0], swing: 0 },
  { name: "armL", size: [0.2, 0.74, 0.24], at: [-0.42, 1.28, 0.22], swing: -0.6 },
  { name: "armR", size: [0.2, 0.74, 0.24], at: [0.42, 1.28, 0.22], swing: 0.6 },
  { name: "head", size: [0.46, 0.44, 0.44], at: [0, 1.82, 0], swing: 0 },
] as const;

const MAX_ZOMBIES = 90;
const ATTACK_RANGE = 1.55;
const ATTACK_CD = 1.05;

export class ZombieField {
  readonly list: Zombie[] = [];
  readonly group = new THREE.Group();
  private parts: THREE.InstancedMesh[] = [];
  private dummy = new THREE.Object3D();
  private tint = new THREE.Color();

  constructor(private world: World) {
    for (const part of PARTS) {
      const geo = new THREE.BoxGeometry(...part.size);
      const mat = new THREE.MeshLambertMaterial({ vertexColors: false });
      const mesh = new THREE.InstancedMesh(geo, mat, MAX_ZOMBIES);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(MAX_ZOMBIES * 3),
        3,
      );
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.parts.push(mesh);
    }
  }

  get alive() {
    return this.list.filter((z) => z.dying === 0).length;
  }

  clear() {
    this.list.length = 0;
    for (const p of this.parts) p.count = 0;
  }

  spawn(kind: ZombieKind, x: number, z: number, healthScale: number) {
    if (this.list.length >= MAX_ZOMBIES) return;
    const def = KINDS[kind];
    const y = this.world.heightAt(Math.floor(x), Math.floor(z));
    this.list.push({
      kind,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(),
      facing: Math.random() * Math.PI * 2,
      health: def.health * healthScale,
      maxHealth: def.health * healthScale,
      speed: def.speed,
      damage: def.damage,
      scale: def.scale,
      reward: def.reward,
      phase: Math.random() * Math.PI * 2,
      attackCd: Math.random() * 0.6,
      flash: 0,
      dying: 0,
      onGround: false,
    });
  }

  /**
   * Steps every zombie. `onHitPlayer` fires when one lands a blow; the world is
   * chewed directly when a zombie is walled in.
   */
  update(
    dt: number,
    target: THREE.Vector3,
    onHitPlayer: (damage: number) => void,
  ) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const z = this.list[i];

      if (z.dying > 0) {
        z.dying -= dt;
        if (z.dying <= 0) this.list.splice(i, 1);
        continue;
      }

      if (z.flash > 0) z.flash -= dt;
      if (z.attackCd > 0) z.attackCd -= dt;

      const dx = target.x - z.pos.x;
      const dz = target.z - z.pos.z;
      const dist = Math.hypot(dx, dz);
      z.facing = Math.atan2(dx, dz);

      if (dist <= ATTACK_RANGE && Math.abs(target.y - z.pos.y) < 2.4) {
        if (z.attackCd <= 0) {
          z.attackCd = ATTACK_CD;
          onHitPlayer(z.damage);
        }
        z.vel.x = 0;
        z.vel.z = 0;
      } else if (dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        z.vel.x = nx * z.speed;
        z.vel.z = nz * z.speed;
        z.phase += dt * z.speed * 2.4;
      }

      // gravity + ground
      z.vel.y -= 26 * dt;
      const nextY = z.pos.y + z.vel.y * dt;
      const floor = this.groundUnder(z.pos.x, z.pos.z, z.pos.y);
      if (nextY <= floor) {
        z.pos.y = floor;
        z.vel.y = 0;
        z.onGround = true;
      } else {
        z.pos.y = nextY;
        z.onGround = false;
      }

      this.stepAxis(z, "x", z.vel.x * dt, dt);
      this.stepAxis(z, "z", z.vel.z * dt, dt);
    }
  }

  /** Highest solid surface at or below `fromY` in this column. */
  private groundUnder(x: number, z: number, fromY: number) {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    for (let y = Math.min(Math.ceil(fromY), 39); y >= 0; y--) {
      if (this.world.solid(bx, y, bz)) return y + 1;
    }
    return 0;
  }

  /**
   * Moves one axis. A zombie that cannot fit either climbs a one-block ledge or
   * starts breaking the block in its way, which is what makes barricades a
   * delaying tactic rather than a win button.
   */
  private stepAxis(z: Zombie, axis: "x" | "z", amount: number, dt: number) {
    if (amount === 0) return;
    const before = z.pos[axis];
    z.pos[axis] += amount;

    const bx = Math.floor(z.pos.x);
    const bz = Math.floor(z.pos.z);
    const feet = Math.floor(z.pos.y + 0.1);
    const chest = Math.floor(z.pos.y + 1.1);

    const blockedFeet = this.world.solid(bx, feet, bz);
    const blockedChest = this.world.solid(bx, chest, bz);

    if (!blockedFeet && !blockedChest) return;

    if (blockedFeet && !blockedChest && z.onGround) {
      // one-block step up
      z.pos.y = feet + 1;
      return;
    }

    // Walled in: chew through it.
    const y = blockedChest ? chest : feet;
    this.world.damageBlock(bx, y, bz, dt * 3.2);
    z.pos[axis] = before;
  }

  /**
   * Hitscan against zombie capsules. Returns the nearest zombie hit within
   * `maxDist`, or null.
   */
  pick(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) {
    let best: { zombie: Zombie; dist: number; headshot: boolean } | null = null;

    for (const z of this.list) {
      if (z.dying > 0) continue;
      const height = 1.95 * z.scale;
      // Widen slightly with distance so long shots still feel fair.
      const radius = 0.42 * z.scale + Math.min(0.1, maxDist * 0.002);

      // Ray vs. upright cylinder: solve the circle in XZ, then check that the
      // ray is within the body's vertical span where it crosses.
      const ox = origin.x - z.pos.x;
      const oz = origin.z - z.pos.z;
      const a = dir.x * dir.x + dir.z * dir.z;

      let t: number;
      if (a < 1e-6) {
        // Looking straight up or down: only a hit if we are inside the circle.
        if (ox * ox + oz * oz > radius * radius) continue;
        t = dir.y > 0 ? z.pos.y + height - origin.y : origin.y - z.pos.y;
        if (t < 0) continue;
      } else {
        const b = 2 * (ox * dir.x + oz * dir.z);
        const c = ox * ox + oz * oz - radius * radius;
        const disc = b * b - 4 * a * c;
        if (disc < 0) continue;
        const root = Math.sqrt(disc);
        t = (-b - root) / (2 * a);
        // Standing inside the cylinder: take the far crossing instead.
        if (t < 0) t = (-b + root) / (2 * a);
        if (t < 0) continue;
      }

      if (t > maxDist) continue;

      const y = origin.y + dir.y * t;
      if (y < z.pos.y || y > z.pos.y + height) continue;

      if (!best || t < best.dist) {
        best = {
          zombie: z,
          dist: t,
          headshot: y > z.pos.y + height * 0.78,
        };
      }
    }
    return best;
  }

  /** Applies damage. Returns the coin reward when the hit was lethal. */
  damage(z: Zombie, amount: number): number {
    if (z.dying > 0) return 0;
    z.health -= amount;
    z.flash = 0.12;
    if (z.health <= 0) {
      z.dying = 0.55;
      return z.reward;
    }
    return 0;
  }

  /** Rebuilds every instance matrix. Called once per rendered frame. */
  sync(time: number) {
    const counts = new Array(PARTS.length).fill(0);
    const m = new THREE.Matrix4();
    const rot = new THREE.Matrix4();
    const local = new THREE.Matrix4();

    for (const z of this.list) {
      const def = KINDS[z.kind];
      const collapse = z.dying > 0 ? 1 - z.dying / 0.55 : 0;
      rot.makeRotationY(z.facing + (collapse ? 0 : 0));

      for (let p = 0; p < PARTS.length; p++) {
        const part = PARTS[p];
        const mesh = this.parts[p];
        const swing = part.swing
          ? Math.sin(z.phase) * 0.42 * part.swing
          : Math.sin(z.phase * 0.5) * 0.03;

        // Limb pivots at the top for legs/arms, so offset then rotate.
        const pivotY = part.name.startsWith("leg")
          ? 0.82
          : part.name.startsWith("arm")
            ? 0.74
            : 0;

        local.makeTranslation(
          part.at[0] * z.scale,
          (part.at[1] + (pivotY ? pivotY / 2 : 0)) * z.scale,
          part.at[2] * z.scale,
        );
        if (swing) {
          const swingM = new THREE.Matrix4().makeRotationX(swing);
          local.multiply(swingM);
        }
        if (pivotY) {
          local.multiply(new THREE.Matrix4().makeTranslation(0, (-pivotY / 2) * z.scale, 0));
        }
        if (z.scale !== 1) {
          local.multiply(new THREE.Matrix4().makeScale(z.scale, z.scale, z.scale));
        }

        m.makeTranslation(z.pos.x, z.pos.y, z.pos.z);
        m.multiply(rot);
        if (collapse) {
          // Fold forward as it goes down.
          m.multiply(new THREE.Matrix4().makeRotationX(collapse * Math.PI * 0.48));
        }
        m.multiply(local);

        const i = counts[p]++;
        mesh.setMatrixAt(i, m);

        const base = part.name === "torso" ? def.shirt : def.skin;
        this.tint.setHex(base);
        if (z.flash > 0) this.tint.lerp(new THREE.Color(0xff3b2e), 0.75);
        // Subtle idle shimmer so a crowd does not look like one flat colour.
        const v = 0.9 + Math.sin(time * 1.4 + z.phase) * 0.05;
        mesh.setColorAt(i, this.tint.multiplyScalar(v));
      }
    }

    for (let p = 0; p < PARTS.length; p++) {
      const mesh = this.parts[p];
      mesh.count = counts[p];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    for (const p of this.parts) {
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    }
  }
}

export { KINDS as ZOMBIE_KINDS };
