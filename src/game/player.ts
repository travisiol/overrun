import * as THREE from "three";
import { World, WORLD_H } from "./world";
import { weaponById, type UpgradeId, type Weapon } from "./weapons";

const WIDTH = 0.62;
const HEIGHT = 1.78;
const EYE = 1.62;
const GRAVITY = 26;
const JUMP = 8.4;
const ACCEL = 62;
const FRICTION = 11;
const AIR_CONTROL = 0.32;
const BASE_SPEED = 5.4;
const SPRINT = 1.42;
// Must clear a whole voxel: anything less and a one-block kerb stops the player
// dead, because their feet are still inside the block they are trying to mount.
const STEP = 1.05;

export type Keys = Record<string, boolean>;

export class Player {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;

  maxHealth = 100;
  health = 100;
  coins = 0;
  kills = 0;

  owned = new Set<string>(["pistol"]);
  weaponId = "pistol";
  ammo = weaponById("pistol").mag;
  reserve = 999;
  reloading = 0;
  cooldown = 0;

  upgrades: Record<UpgradeId, number> = {
    health: 0,
    damage: 0,
    speed: 0,
    reload: 0,
  };

  /** Screen-space kick, decayed every frame. */
  recoilPitch = 0;
  bob = 0;
  lastHurt = -99;

  constructor(private world: World) {}

  get weapon(): Weapon {
    return weaponById(this.weaponId);
  }

  get damageMultiplier() {
    return 1 + this.upgrades.damage * 0.12;
  }

  get reloadMultiplier() {
    return 1 - this.upgrades.reload * 0.12;
  }

  get speedMultiplier() {
    return 1 + this.upgrades.speed * 0.08;
  }

  applyUpgradeStats() {
    this.maxHealth = 100 + this.upgrades.health * 25;
    this.health = Math.min(this.health, this.maxHealth);
  }

  spawn(x: number, z: number) {
    const y = this.world.heightAt(Math.floor(x), Math.floor(z));
    this.position.set(x, y + 0.2, z);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
    this.onGround = false;
  }

  equip(id: string) {
    if (!this.owned.has(id)) return;
    this.weaponId = id;
    this.ammo = weaponById(id).mag;
    this.reloading = 0;
  }

  startReload() {
    const w = this.weapon;
    if (this.reloading > 0 || this.ammo >= w.mag) return;
    this.reloading = w.reload * this.reloadMultiplier;
  }

  hurt(amount: number, now: number) {
    this.health = Math.max(0, this.health - amount);
    this.lastHurt = now;
  }

  eyePosition(out = new THREE.Vector3()) {
    return out.set(
      this.position.x,
      this.position.y + EYE + Math.sin(this.bob) * 0.045,
      this.position.z,
    );
  }

  lookDirection(out = new THREE.Vector3()) {
    const p = this.pitch + this.recoilPitch;
    return out
      .set(
        -Math.sin(this.yaw) * Math.cos(p),
        Math.sin(p),
        -Math.cos(this.yaw) * Math.cos(p),
      )
      .normalize();
  }

  update(dt: number, keys: Keys) {
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        this.ammo = this.weapon.mag;
      }
    }
    if (this.cooldown > 0) this.cooldown -= dt;
    this.recoilPitch *= Math.max(0, 1 - dt * 9);

    // --- desired direction in world space
    const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wishX = -sin * forward + cos * strafe;
    const wishZ = -cos * forward - sin * strafe;
    const len = Math.hypot(wishX, wishZ);

    const sprinting = keys.ShiftLeft && forward > 0;
    const topSpeed =
      BASE_SPEED * this.speedMultiplier * (sprinting ? SPRINT : 1);

    if (len > 0) {
      const nx = wishX / len;
      const nz = wishZ / len;
      const control = this.onGround ? 1 : AIR_CONTROL;
      this.velocity.x += nx * ACCEL * control * dt;
      this.velocity.z += nz * ACCEL * control * dt;

      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      if (speed > topSpeed) {
        this.velocity.x = (this.velocity.x / speed) * topSpeed;
        this.velocity.z = (this.velocity.z / speed) * topSpeed;
      }
      if (this.onGround) this.bob += dt * speed * 1.7;
    } else if (this.onGround) {
      const drop = 1 - Math.min(1, FRICTION * dt);
      this.velocity.x *= drop;
      this.velocity.z *= drop;
    }

    if (keys.Space && this.onGround) {
      this.velocity.y = JUMP;
      this.onGround = false;
    }

    this.velocity.y -= GRAVITY * dt;
    if (this.velocity.y < -60) this.velocity.y = -60;

    // Horizontal first, so a step-up still sees last frame's grounded state.
    this.moveAxis("x", this.velocity.x * dt);
    this.moveAxis("z", this.velocity.z * dt);
    // Clear it here and let the vertical sweep prove we are still standing on
    // something; otherwise walking off a ledge leaves a free mid-air jump.
    this.onGround = false;
    this.moveAxis("y", this.velocity.y * dt);

    if (this.position.y < -20) {
      // Fell out of the world; drop the player back on the arena floor.
      this.spawn(this.position.x, this.position.z);
      this.health = Math.max(1, this.health - 30);
    }
  }

  /** Sweeps one axis, resolving against voxels and stepping up small ledges. */
  private moveAxis(axis: "x" | "y" | "z", amount: number) {
    if (amount === 0) return;
    const before = this.position[axis];
    this.position[axis] += amount;
    if (!this.collides()) return;

    if (axis === "y") {
      this.position.y = before;
      if (amount < 0) this.onGround = true;
      this.velocity.y = 0;
      return;
    }

    // Try to step over a one-block lip before giving up on the move.
    const raised = this.position.y + STEP;
    const savedY = this.position.y;
    this.position.y = raised;
    if (!this.collides() && this.onGround) return;

    this.position.y = savedY;
    this.position[axis] = before;
    this.velocity[axis] = 0;
  }

  private collides() {
    const half = WIDTH / 2;
    const min = new THREE.Vector3(
      this.position.x - half,
      this.position.y,
      this.position.z - half,
    );
    const max = new THREE.Vector3(
      this.position.x + half,
      this.position.y + HEIGHT,
      this.position.z + half,
    );
    if (max.y > WORLD_H) return true;
    return this.world.boxHitsSolid(min, max);
  }
}

export { HEIGHT as PLAYER_HEIGHT, EYE as PLAYER_EYE };
