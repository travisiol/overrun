export type Weapon = {
  id: string;
  name: string;
  price: number;
  /** Damage per bullet. Shotguns pay this out per pellet. */
  damage: number;
  pellets: number;
  /** Rounds per minute. */
  rpm: number;
  mag: number;
  reload: number;
  /** Cone half-angle in radians at the muzzle. */
  spread: number;
  range: number;
  recoil: number;
  auto: boolean;
  note: string;
};

export const WEAPONS: Weapon[] = [
  {
    id: "pistol",
    name: "Sidearm",
    price: 0,
    damage: 24,
    pellets: 1,
    rpm: 300,
    mag: 12,
    reload: 1.1,
    spread: 0.012,
    range: 60,
    recoil: 0.9,
    auto: false,
    note: "What you woke up with.",
  },
  {
    id: "smg",
    name: "Stutter",
    price: 1200,
    damage: 16,
    pellets: 1,
    rpm: 780,
    mag: 32,
    reload: 1.5,
    spread: 0.03,
    range: 45,
    recoil: 0.7,
    auto: true,
    note: "Empties fast. Aim low and hold.",
  },
  {
    id: "shotgun",
    name: "Doorbreaker",
    price: 2600,
    damage: 15,
    pellets: 9,
    rpm: 75,
    mag: 6,
    reload: 2.2,
    spread: 0.11,
    range: 22,
    recoil: 2.6,
    auto: false,
    note: "Everything inside ten metres stops existing.",
  },
  {
    id: "rifle",
    name: "Longshot",
    price: 4800,
    damage: 62,
    pellets: 1,
    rpm: 260,
    mag: 20,
    reload: 1.8,
    spread: 0.006,
    range: 120,
    recoil: 1.6,
    auto: true,
    note: "Drops a runner before it hears you.",
  },
];

export const weaponById = (id: string) =>
  WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];

export type UpgradeId = "health" | "damage" | "speed" | "reload";

export type Upgrade = {
  id: UpgradeId;
  name: string;
  detail: string;
  max: number;
  cost: (level: number) => number;
};

export const UPGRADES: Upgrade[] = [
  {
    id: "health",
    name: "Constitution",
    detail: "+25 max health per level",
    max: 5,
    cost: (l) => 600 + l * 500,
  },
  {
    id: "damage",
    name: "Hollow points",
    detail: "+12% weapon damage per level",
    max: 5,
    cost: (l) => 800 + l * 700,
  },
  {
    id: "speed",
    name: "Light boots",
    detail: "+8% move speed per level",
    max: 4,
    cost: (l) => 700 + l * 550,
  },
  {
    id: "reload",
    name: "Quick hands",
    detail: "-12% reload time per level",
    max: 4,
    cost: (l) => 650 + l * 450,
  },
];
