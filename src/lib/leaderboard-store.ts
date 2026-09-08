import { promises as fs } from "node:fs";
import path from "node:path";
import type { LeaderboardEntry, ScoreSubmission } from "./leaderboard-types";

/**
 * A flat JSON file is enough here: the board is a few hundred rows, writes only
 * happen when a run ends, and it keeps the project runnable with no database to
 * provision. Swap this module for a real store when the game goes live.
 */
const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "leaderboard.json");

// Serialises read-modify-write so two runs finishing at once cannot clobber
// each other's rows.
let queue: Promise<unknown> = Promise.resolve();

async function readAll(): Promise<LeaderboardEntry[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(entries: LeaderboardEntry[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(entries, null, 2), "utf8");
}

export async function getLeaderboard(
  sort: "kills" | "coins",
  limit = 50,
): Promise<LeaderboardEntry[]> {
  const entries = await readAll();
  return entries
    .slice()
    .sort((a, b) => b[sort] - a[sort] || b.kills - a.kills)
    .slice(0, limit);
}

/** Records a finished run. A wallet keeps its best numbers, never its last. */
export async function submitScore(
  score: ScoreSubmission,
): Promise<LeaderboardEntry> {
  const run = queue.then(async () => {
    const entries = await readAll();
    const existing = entries.find((e) => e.wallet === score.wallet);

    const next: LeaderboardEntry = {
      wallet: score.wallet,
      kills: Math.max(existing?.kills ?? 0, score.kills),
      coins: Math.max(existing?.coins ?? 0, score.coins),
      bestWave: Math.max(existing?.bestWave ?? 0, score.wave),
      updatedAt: Date.now(),
    };

    if (existing) Object.assign(existing, next);
    else entries.push(next);

    await writeAll(entries);
    return next;
  });

  // Keep the chain alive even if this link rejects.
  queue = run.catch(() => {});
  return run;
}
