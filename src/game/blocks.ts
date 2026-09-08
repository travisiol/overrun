export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const WOOD = 4;
export const PLANK = 5;
export const LEAVES = 6;
export const CONCRETE = 7;
export const RUST = 8;

export type BlockId = number;

type BlockDef = {
  /** [top, side, bottom] tints, multiplied into the face colour. */
  top: number;
  side: number;
  bottom: number;
  /** Hits a zombie needs to chew through it. 0 = indestructible. */
  hp: number;
};

const def = (top: number, side: number, bottom: number, hp: number): BlockDef => ({
  top,
  side,
  bottom,
  hp,
});

export const BLOCKS: Record<BlockId, BlockDef> = {
  [GRASS]: def(0x6f8f3a, 0x5c4327, 0x4a3520, 6),
  [DIRT]: def(0x5c4327, 0x543c23, 0x4a3520, 5),
  [STONE]: def(0x6b6660, 0x5f5a55, 0x514d49, 12),
  [WOOD]: def(0x6b4a24, 0x513718, 0x412c13, 8),
  [PLANK]: def(0xc0a173, 0xb0925f, 0x93794c, 10),
  [LEAVES]: def(0x3f5f24, 0x37521f, 0x2d441a, 2),
  [CONCRETE]: def(0x8d8577, 0x7d766a, 0x6a645a, 16),
  [RUST]: def(0x8c4a26, 0x7a3f20, 0x63331a, 14),
};

export const isSolid = (id: BlockId) => id !== AIR;
