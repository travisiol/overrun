/**
 * Headless smoke test for the game simulation.
 *
 * Everything under src/game except the renderer is plain maths, so it can be
 * driven with a fixed timestep in Node and asserted on. Each section builds its
 * own World: sections used to share one, and test geometry from an early
 * section landed on a later section's spawn point.
 *
 * Run with:  npx --yes tsx scripts/smoke-test.mts
 */
import * as THREE from "three";
import { World, WORLD_D, WORLD_W } from "../src/game/world.ts";
import { PLANK, AIR, CONCRETE } from "../src/game/blocks.ts";
import { Player } from "../src/game/player.ts";
import { ZombieField } from "../src/game/zombies.ts";
import { WEAPONS, weaponById } from "../src/game/weapons.ts";

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail = "") {
  checks++;
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const section = (name: string) => console.log(`\n${name}`);

const DT = 1 / 60;
const step = (n: number, fn: (dt: number) => void) => {
  for (let i = 0; i < n; i++) fn(DT);
};

const CX = WORLD_W / 2;
const CZ = WORLD_D / 2;
const FLOOR = 10;

// ---------------------------------------------------------------- world
section("world generation");
{
  const world = new World(1337);
  let minH = Infinity;
  let maxH = -Infinity;
  for (let x = 0; x < WORLD_W; x += 3) {
    for (let z = 0; z < WORLD_D; z += 3) {
      const h = world.heightAt(x, z);
      minH = Math.min(minH, h);
      maxH = Math.max(maxH, h);
    }
  }
  check("every column has ground", minH > 0, `min height ${minH}`);
  check("terrain has relief", maxH - minH >= 4, `range ${minH}..${maxH}`);
  check(
    "arena centre is flattened",
    world.heightAt(CX, CZ) === FLOOR,
    `got ${world.heightAt(CX, CZ)}`,
  );
  check("arena floor is concrete", world.get(CX, FLOOR - 1, CZ) === CONCRETE);
  check("chunk meshes were built", world.group.children.length > 0);

  // The spawn ring must be walkable, or wave one starts inside a wall.
  let clear = true;
  for (let a = 0; a < 16; a++) {
    const x = Math.round(CX + Math.cos(a) * 10);
    const z = Math.round(CZ + Math.sin(a) * 10);
    if (world.heightAt(x, z) !== FLOOR) clear = false;
  }
  check("the arena floor is level all round the spawn", clear);
}

// ---------------------------------------------------------------- raycast
section("voxel raycast");
{
  const world = new World(1337);
  const down = world.raycast(
    new THREE.Vector3(CX + 0.5, 20, CZ + 0.5),
    new THREE.Vector3(0, -1, 0),
    40,
  );
  check("ray straight down hits the floor", down !== null);
  check("hit is the top solid block", down?.hit.y === FLOOR - 1, `y=${down?.hit.y}`);
  check("placement cell sits above the hit", down?.place.y === FLOOR, `y=${down?.place.y}`);

  const across = world.raycast(
    new THREE.Vector3(CX + 0.5, FLOOR + 1.5, CZ + 0.5),
    new THREE.Vector3(1, 0, 0),
    4,
  );
  check("clear air returns no hit", across === null);

  world.set(CX + 3, FLOOR + 1, CZ, PLANK);
  const toBlock = world.raycast(
    new THREE.Vector3(CX + 0.5, FLOOR + 1.5, CZ + 0.5),
    new THREE.Vector3(1, 0, 0),
    10,
  );
  check("a placed block is hit by a level ray", toBlock?.hit.x === CX + 3);
}

// ---------------------------------------------------------------- player
section("player");
{
  const world = new World(1337);
  const player = new Player(world);
  const keys: Record<string, boolean> = {};

  player.spawn(CX + 0.5, CZ + 0.5);
  step(90, (dt) => player.update(dt, keys));
  check(
    "gravity settles the player on the floor",
    Math.abs(player.position.y - FLOOR) < 0.05,
    `y=${player.position.y.toFixed(3)}`,
  );
  check("standing counts as grounded", player.onGround);

  player.yaw = 0; // faces -Z
  const fromZ = player.position.z;
  keys.KeyW = true;
  step(60, (dt) => player.update(dt, keys));
  keys.KeyW = false;
  check(
    "W walks forward",
    fromZ - player.position.z > 2,
    `moved ${(fromZ - player.position.z).toFixed(2)}m`,
  );

  // jumping
  step(30, (dt) => player.update(dt, keys));
  keys.Space = true;
  player.update(DT, keys);
  keys.Space = false;
  let peak = player.position.y;
  step(40, (dt) => {
    player.update(dt, keys);
    peak = Math.max(peak, player.position.y);
  });
  check("space clears the ground", peak > FLOOR + 1, `peak ${peak.toFixed(2)}`);
  step(90, (dt) => player.update(dt, keys));
  check(
    "the player lands again",
    player.onGround && Math.abs(player.position.y - FLOOR) < 0.05,
    `y=${player.position.y.toFixed(2)}`,
  );
}

{
  // A wall stops the player.
  const world = new World(1337);
  const player = new Player(world);
  const keys: Record<string, boolean> = {};
  player.spawn(CX + 0.5, CZ + 0.5);
  step(60, (dt) => player.update(dt, keys));

  const wallZ = CZ - 4;
  for (let y = FLOOR; y < FLOOR + 4; y++)
    for (let dx = -3; dx <= 3; dx++) world.set(CX + dx, y, wallZ, CONCRETE);

  player.yaw = 0;
  keys.KeyW = true;
  step(180, (dt) => player.update(dt, keys));
  check(
    "a four-high wall stops the player",
    player.position.z > wallZ + 1,
    `z=${player.position.z.toFixed(2)}, wall at ${wallZ}`,
  );
  check("the player reached the wall", player.position.z < wallZ + 2.2);
}

{
  // A one-block kerb gets climbed rather than blocking.
  const world = new World(1337);
  const player = new Player(world);
  const keys: Record<string, boolean> = {};
  player.spawn(CX + 0.5, CZ + 0.5);
  step(60, (dt) => player.update(dt, keys));

  const ledgeZ = CZ - 4;
  for (let dx = -3; dx <= 3; dx++) world.set(CX + dx, FLOOR, ledgeZ, PLANK);

  player.yaw = 0;
  keys.KeyW = true;
  let peak = player.position.y;
  step(120, (dt) => {
    player.update(dt, keys);
    peak = Math.max(peak, player.position.y);
  });
  check(
    "a one-block kerb is climbed, not blocked",
    peak >= FLOOR + 1,
    `peak y=${peak.toFixed(2)}`,
  );
  check(
    "and the player got past it",
    player.position.z < ledgeZ,
    `z=${player.position.z.toFixed(2)}`,
  );
}

// ---------------------------------------------------------------- zombies
section("zombies");
{
  const world = new World(1337);
  const field = new ZombieField(world);
  const target = new THREE.Vector3(CX + 0.5, FLOOR, CZ + 0.5);

  field.spawn("walker", target.x + 14, target.z, 1);
  const zombie = field.list[0];
  const before = Math.hypot(zombie.pos.x - target.x, zombie.pos.z - target.z);

  let hits = 0;
  step(240, (dt) => field.update(dt, target, () => hits++));
  const after = Math.hypot(zombie.pos.x - target.x, zombie.pos.z - target.z);
  check(
    "a zombie closes on its target",
    after < before - 3,
    `${before.toFixed(1)}m -> ${after.toFixed(1)}m`,
  );
  check(
    "a zombie stays on the ground",
    Math.abs(zombie.pos.y - FLOOR) < 1.5,
    `y=${zombie.pos.y.toFixed(2)}`,
  );

  step(600, (dt) => field.update(dt, target, () => hits++));
  check("a zombie in contact attacks", hits > 0, `${hits} hits`);

  field.clear();
  check("clearing empties the field", field.list.length === 0 && field.alive === 0);

  field.spawn("runner", target.x + 10, target.z, 1);
  field.spawn("brute", target.x - 10, target.z, 1);
  check(
    "a runner outruns a brute",
    field.list[0].speed > field.list[1].speed,
    `${field.list[0].speed} vs ${field.list[1].speed}`,
  );
}

// ---------------------------------------------------------------- combat
section("combat");
{
  const world = new World(1337);
  const field = new ZombieField(world);
  const eye = new THREE.Vector3(CX + 0.5, FLOOR + 1.62, CZ + 0.5);

  field.spawn("walker", CX + 0.5, CZ + 0.5 - 8, 1);
  const victim = field.list[0];

  const hit = field.pick(eye, new THREE.Vector3(0, 0, -1), 60);
  check("the crosshair picks a zombie in front", hit?.zombie === victim);
  check(
    "the pick reports the distance to its near side",
    (hit?.dist ?? 0) > 7 && (hit?.dist ?? 0) < 8,
    `dist=${hit?.dist?.toFixed(2)}`,
  );
  check(
    "level fire at 8m lands on the upper body",
    hit?.headshot === true,
    "eye height should clear the chest at that range",
  );
  check("looking away picks nothing", field.pick(eye, new THREE.Vector3(1, 0, 0), 60) === null);
  check(
    "a zombie beyond the weapon's range is out of reach",
    field.pick(eye, new THREE.Vector3(0, 0, -1), 5) === null,
  );

  // aiming at the feet should still connect, but not as a headshot
  const low = new THREE.Vector3(0, -(1.62 - 0.3), -8).normalize();
  const lowHit = field.pick(eye, low, 60);
  check("aiming low still connects", lowHit?.zombie === victim);
  check("a body shot is not a headshot", lowHit?.headshot === false);

  let reward = 0;
  let shots = 0;
  const pistol = weaponById("pistol");
  while (victim.dying === 0 && shots < 40) {
    reward += field.damage(victim, pistol.damage);
    shots++;
  }
  check("sustained fire kills a walker", victim.dying > 0, `${shots} shots`);
  check("a kill pays 100 coins", reward === 100, `paid ${reward}`);
  check(
    "a walker takes a plausible number of pistol rounds",
    shots >= 4 && shots <= 6,
    `${shots} shots`,
  );
  check("a corpse is no longer targetable", field.pick(eye, new THREE.Vector3(0, 0, -1), 60) === null);

  check(
    "every weapon has a positive fire rate, magazine and damage",
    WEAPONS.every((w) => w.rpm > 0 && w.mag > 0 && w.damage > 0),
  );
  check(
    "weapon prices rise with the shotgun and rifle",
    weaponById("rifle").price > weaponById("shotgun").price &&
      weaponById("shotgun").price > weaponById("smg").price,
  );
}

// ---------------------------------------------------------------- building
section("building");
{
  const world = new World(1337);
  const bx = CX + 3;
  const bz = CZ;

  world.set(bx, FLOOR, bz, PLANK);
  check("a barricade block is placed", world.get(bx, FLOOR, bz) === PLANK);
  check("placing raises the column height", world.heightAt(bx, bz) === FLOOR + 1);

  let broke = false;
  for (let i = 0; i < 400 && !broke; i++)
    broke = world.damageBlock(bx, FLOOR, bz, 0.05);
  check("a barricade can be chewed through", broke && world.get(bx, FLOOR, bz) === AIR);
  check("breaking lowers the column height", world.heightAt(bx, bz) === FLOOR);

  // A zombie walled off from its target should break through rather than idle.
  const field = new ZombieField(world);
  for (let y = FLOOR; y < FLOOR + 3; y++)
    for (let dz = -2; dz <= 2; dz++) world.set(bx, y, bz + dz, PLANK);

  field.spawn("walker", bx + 1.5, bz + 0.5, 1);
  const digger = field.list[0];
  const behindWall = new THREE.Vector3(bx - 6, FLOOR, bz + 0.5);
  step(1800, (dt) => field.update(dt, behindWall, () => {}));
  check(
    "a walled-in zombie breaks through",
    world.get(bx, FLOOR + 1, bz) === AIR || digger.pos.x < bx,
    `block=${world.get(bx, FLOOR + 1, bz)} x=${digger.pos.x.toFixed(2)}`,
  );
}

// ---------------------------------------------------------------- result
console.log(
  `\n${checks - failures}/${checks} checks passed${failures ? ` — ${failures} FAILED` : ""}`,
);
process.exit(failures ? 1 : 0);
