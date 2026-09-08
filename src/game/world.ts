import * as THREE from "three";
import {
  AIR,
  BLOCKS,
  CONCRETE,
  DIRT,
  GRASS,
  LEAVES,
  PLANK,
  RUST,
  STONE,
  WOOD,
  type BlockId,
} from "./blocks";

export const WORLD_W = 96;
export const WORLD_H = 40;
export const WORLD_D = 96;
const CHUNK = 16;
const CX = WORLD_W / CHUNK;
const CZ = WORLD_D / CHUNK;

/** Deterministic 32-bit hash -> [0,1). Keeps map generation reproducible. */
function hash2(x: number, z: number, seed: number) {
  let h = (x * 374761393 + z * 668265263 + seed * 1442695040) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise: bilinear blend of hashed lattice points. */
function noise2(x: number, z: number, seed: number) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const tx = smooth(x - xi);
  const tz = smooth(z - zi);
  const a = hash2(xi, zi, seed);
  const b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed);
  const d = hash2(xi + 1, zi + 1, seed);
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

const FACES = [
  // dir, corner offsets (ccw), shade
  {
    dir: [0, 1, 0],
    corners: [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
    shade: 1.0,
    kind: "top" as const,
  },
  {
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    shade: 0.45,
    kind: "bottom" as const,
  },
  {
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    shade: 0.82,
    kind: "side" as const,
  },
  {
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    shade: 0.68,
    kind: "side" as const,
  },
  {
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    shade: 0.9,
    kind: "side" as const,
  },
  {
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    shade: 0.6,
    kind: "side" as const,
  },
];

export class World {
  readonly blocks = new Uint8Array(WORLD_W * WORLD_H * WORLD_D);
  /** Remaining hit points for blocks zombies have started chewing on. */
  private damage = new Map<number, number>();
  readonly group = new THREE.Group();
  private meshes: (THREE.Mesh | null)[] = new Array(CX * CZ).fill(null);
  private dirty = new Set<number>();
  private material: THREE.Material;
  /** Highest solid block per column, for spawn placement. */
  private heights = new Int16Array(WORLD_W * WORLD_D);

  constructor(private seed = 1337) {
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.generate();
    for (let i = 0; i < CX * CZ; i++) this.dirty.add(i);
    this.flush();
  }

  private idx(x: number, y: number, z: number) {
    return (y * WORLD_D + z) * WORLD_W + x;
  }

  inBounds(x: number, y: number, z: number) {
    return (
      x >= 0 && y >= 0 && z >= 0 && x < WORLD_W && y < WORLD_H && z < WORLD_D
    );
  }

  get(x: number, y: number, z: number): BlockId {
    if (!this.inBounds(x, y, z)) return y < 0 ? STONE : AIR;
    return this.blocks[this.idx(x, y, z)];
  }

  solid(x: number, y: number, z: number) {
    return this.get(x, y, z) !== AIR;
  }

  set(x: number, y: number, z: number, id: BlockId) {
    if (!this.inBounds(x, y, z)) return;
    const i = this.idx(x, y, z);
    if (this.blocks[i] === id) return;
    this.blocks[i] = id;
    this.damage.delete(i);
    this.recomputeHeight(x, z);

    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    this.dirty.add(cz * CX + cx);
    // A block on a chunk seam changes the neighbour's hidden faces too.
    if (x % CHUNK === 0 && cx > 0) this.dirty.add(cz * CX + cx - 1);
    if (x % CHUNK === CHUNK - 1 && cx < CX - 1) this.dirty.add(cz * CX + cx + 1);
    if (z % CHUNK === 0 && cz > 0) this.dirty.add((cz - 1) * CX + cx);
    if (z % CHUNK === CHUNK - 1 && cz < CZ - 1) this.dirty.add((cz + 1) * CX + cx);
  }

  /** Returns true when the block broke. */
  damageBlock(x: number, y: number, z: number, amount: number) {
    const id = this.get(x, y, z);
    if (id === AIR) return false;
    const max = BLOCKS[id]?.hp ?? 8;
    if (max === 0) return false;
    const i = this.idx(x, y, z);
    const left = (this.damage.get(i) ?? max) - amount;
    if (left <= 0) {
      this.set(x, y, z, AIR);
      return true;
    }
    this.damage.set(i, left);
    return false;
  }

  heightAt(x: number, z: number) {
    if (x < 0 || z < 0 || x >= WORLD_W || z >= WORLD_D) return 0;
    return this.heights[z * WORLD_W + x];
  }

  private recomputeHeight(x: number, z: number) {
    let h = 0;
    for (let y = WORLD_H - 1; y >= 0; y--) {
      if (this.blocks[this.idx(x, y, z)] !== AIR) {
        h = y + 1;
        break;
      }
    }
    this.heights[z * WORLD_W + x] = h;
  }

  // ---- generation -------------------------------------------------

  private generate() {
    const base = 8;
    for (let x = 0; x < WORLD_W; x++) {
      for (let z = 0; z < WORLD_D; z++) {
        const n =
          noise2(x / 26, z / 26, this.seed) * 0.6 +
          noise2(x / 11, z / 11, this.seed + 7) * 0.3 +
          noise2(x / 5, z / 5, this.seed + 13) * 0.1;
        const h = Math.max(3, Math.floor(base + n * 12));
        for (let y = 0; y < h; y++) {
          const id = y === h - 1 ? GRASS : y > h - 4 ? DIRT : STONE;
          this.blocks[this.idx(x, y, z)] = id;
        }
        this.heights[z * WORLD_W + x] = h;
      }
    }

    this.carveArena();
    this.scatterTrees();
    this.scatterRuins();
  }

  /** Flattens the middle so the player always spawns somewhere sane. */
  private carveArena() {
    const cx = WORLD_W / 2;
    const cz = WORLD_D / 2;
    const r = 14;
    for (let x = cx - r; x < cx + r; x++) {
      for (let z = cz - r; z < cz + r; z++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > r) continue;
        const target = 10;
        for (let y = target; y < WORLD_H; y++) this.blocks[this.idx(x, y, z)] = AIR;
        for (let y = 0; y < target; y++) {
          this.blocks[this.idx(x, y, z)] =
            y === target - 1 ? (d > r - 3 ? GRASS : CONCRETE) : y > target - 4 ? DIRT : STONE;
        }
        this.heights[z * WORLD_W + x] = target;
      }
    }
  }

  private scatterTrees() {
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(hash2(i, 1, this.seed) * WORLD_W);
      const z = Math.floor(hash2(i, 2, this.seed) * WORLD_D);
      if (Math.hypot(x - WORLD_W / 2, z - WORLD_D / 2) < 18) continue;
      const y = this.heightAt(x, z);
      if (y < 4) continue;
      const trunk = 4 + Math.floor(hash2(i, 3, this.seed) * 3);
      for (let t = 0; t < trunk; t++) this.setRaw(x, y + t, z, WOOD);
      // Sparse, dead-looking canopy.
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          for (let dy = 0; dy <= 2; dy++) {
            if (Math.abs(dx) + Math.abs(dz) + dy > 3) continue;
            if (hash2(x + dx * 31, z + dz * 17 + dy, this.seed) > 0.55) continue;
            this.setRaw(x + dx, y + trunk + dy - 1, z + dz, LEAVES);
          }
        }
      }
    }
  }

  /** Broken concrete walls: cover to fight behind. */
  private scatterRuins() {
    for (let i = 0; i < 26; i++) {
      const x = 6 + Math.floor(hash2(i, 41, this.seed) * (WORLD_W - 12));
      const z = 6 + Math.floor(hash2(i, 42, this.seed) * (WORLD_D - 12));
      // Keep the spawn clear: a wall dropped on the player's feet is not cover.
      if (Math.hypot(x - WORLD_W / 2, z - WORLD_D / 2) < 16) continue;
      const len = 4 + Math.floor(hash2(i, 43, this.seed) * 8);
      const alongX = hash2(i, 44, this.seed) > 0.5;
      const tall = 2 + Math.floor(hash2(i, 45, this.seed) * 3);
      for (let s = 0; s < len; s++) {
        const bx = alongX ? x + s : x;
        const bz = alongX ? z : z + s;
        const ground = this.heightAt(bx, bz);
        const gap = hash2(bx * 3, bz * 5, this.seed);
        if (gap > 0.78) continue;
        for (let y = 0; y < tall; y++) {
          if (hash2(bx, bz + y * 9, this.seed) > 0.9) continue;
          this.setRaw(bx, ground + y, bz, y === tall - 1 && gap > 0.6 ? RUST : CONCRETE);
        }
      }
    }
  }

  /** Generation-time write: no dirty tracking, heights fixed up after. */
  private setRaw(x: number, y: number, z: number, id: BlockId) {
    if (!this.inBounds(x, y, z)) return;
    this.blocks[this.idx(x, y, z)] = id;
    if (y + 1 > this.heights[z * WORLD_W + x]) this.heights[z * WORLD_W + x] = y + 1;
  }

  // ---- meshing ----------------------------------------------------

  /** Rebuilds any chunk touched since the last call. Cheap when nothing moved. */
  flush() {
    if (this.dirty.size === 0) return;
    for (const key of this.dirty) this.buildChunk(key % CX, Math.floor(key / CX));
    this.dirty.clear();
  }

  private buildChunk(cx: number, cz: number) {
    const key = cz * CX + cx;
    const old = this.meshes[key];
    if (old) {
      this.group.remove(old);
      old.geometry.dispose();
    }

    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const x0 = cx * CHUNK;
    const z0 = cz * CHUNK;

    for (let x = x0; x < x0 + CHUNK; x++) {
      for (let z = z0; z < z0 + CHUNK; z++) {
        for (let y = 0; y < WORLD_H; y++) {
          const id = this.get(x, y, z);
          if (id === AIR) continue;
          const def = BLOCKS[id];
          if (!def) continue;

          for (const face of FACES) {
            const [dx, dy, dz] = face.dir;
            if (this.get(x + dx, y + dy, z + dz) !== AIR) continue;

            const hex =
              face.kind === "top"
                ? def.top
                : face.kind === "bottom"
                  ? def.bottom
                  : def.side;
            // Slight per-block jitter so large flat areas do not read as plastic.
            const jitter = 0.92 + hash2(x, z * 31 + y, this.seed) * 0.16;
            const r = (((hex >> 16) & 255) / 255) * face.shade * jitter;
            const g = (((hex >> 8) & 255) / 255) * face.shade * jitter;
            const b = ((hex & 255) / 255) * face.shade * jitter;

            const start = positions.length / 3;
            for (const [ox, oy, oz] of face.corners) {
              positions.push(x + ox, y + oy, z + oz);
              normals.push(dx, dy, dz);
              colors.push(r, g, b);
            }
            indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
          }
        }
      }
    }

    if (indices.length === 0) {
      this.meshes[key] = null;
      return;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, this.material);
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    this.meshes[key] = mesh;
  }

  dispose() {
    for (const m of this.meshes) if (m) m.geometry.dispose();
    this.material.dispose();
  }

  // ---- queries ----------------------------------------------------

  /**
   * Voxel DDA. Returns the first solid block along the ray plus the empty cell
   * in front of it (where a placed block would go).
   */
  raycast(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    maxDist: number,
  ): { hit: THREE.Vector3; place: THREE.Vector3; dist: number } | null {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = Math.sign(dir.x);
    const stepY = Math.sign(dir.y);
    const stepZ = Math.sign(dir.z);

    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

    const bound = (o: number, i: number, s: number) =>
      s > 0 ? i + 1 - o : s < 0 ? o - i : Infinity;

    let tMaxX = tDeltaX === Infinity ? Infinity : bound(origin.x, x, stepX) * tDeltaX;
    let tMaxY = tDeltaY === Infinity ? Infinity : bound(origin.y, y, stepY) * tDeltaY;
    let tMaxZ = tDeltaZ === Infinity ? Infinity : bound(origin.z, z, stepZ) * tDeltaZ;

    let px = x;
    let py = y;
    let pz = z;
    let t = 0;

    while (t <= maxDist) {
      if (this.inBounds(x, y, z) && this.solid(x, y, z)) {
        return {
          hit: new THREE.Vector3(x, y, z),
          place: new THREE.Vector3(px, py, pz),
          dist: t,
        };
      }
      px = x;
      py = y;
      pz = z;
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
      }
    }
    return null;
  }

  /** True when an axis-aligned box overlaps any solid voxel. */
  boxHitsSolid(min: THREE.Vector3, max: THREE.Vector3) {
    const x0 = Math.floor(min.x);
    const x1 = Math.floor(max.x);
    const y0 = Math.floor(min.y);
    const y1 = Math.floor(max.y);
    const z0 = Math.floor(min.z);
    const z1 = Math.floor(max.z);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) if (this.solid(x, y, z)) return true;
    return false;
  }
}

export { PLANK };
