import type { UpgradeId } from "@/game/weapons";

export type Progress = {
  coins: number;
  kills: number;
  owned: string[];
  upgrades: Record<UpgradeId, number>;
};

const key = (wallet: string) => `overrun:progress:${wallet}`;

/**
 * Progress lives in the browser, keyed by wallet address. Nothing is signed and
 * nothing is on-chain: a different machine starts a fresh run. Moving this into
 * a token account is the obvious next step.
 */
export function loadProgress(wallet: string): Progress | null {
  try {
    const raw = localStorage.getItem(key(wallet));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      coins: Number(parsed.coins) || 0,
      kills: Number(parsed.kills) || 0,
      owned: Array.isArray(parsed.owned) ? parsed.owned : ["pistol"],
      upgrades: {
        health: Number(parsed.upgrades?.health) || 0,
        damage: Number(parsed.upgrades?.damage) || 0,
        speed: Number(parsed.upgrades?.speed) || 0,
        reload: Number(parsed.upgrades?.reload) || 0,
      },
    };
  } catch {
    return null;
  }
}

export function saveProgress(wallet: string, progress: Progress) {
  try {
    localStorage.setItem(key(wallet), JSON.stringify(progress));
  } catch {
    // Private windows and blocked site data both throw here; losing the save is
    // better than losing the run.
  }
}
