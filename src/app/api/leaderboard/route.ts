import { NextResponse } from "next/server";
import { getLeaderboard, submitScore } from "@/lib/leaderboard-store";

// Scores change on every finished run, so this route always runs at request time.
export const dynamic = "force-dynamic";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(request: Request) {
  const sort =
    new URL(request.url).searchParams.get("sort") === "coins"
      ? "coins"
      : "kills";
  return NextResponse.json({ entries: await getLeaderboard(sort) });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { wallet, kills, coins, wave } = (body ?? {}) as Record<string, unknown>;

  if (typeof wallet !== "string" || !BASE58.test(wallet)) {
    return NextResponse.json({ error: "invalid wallet" }, { status: 400 });
  }

  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0
      ? Math.floor(v)
      : null;

  const k = num(kills);
  const c = num(coins);
  const w = num(wave);

  if (k === null || c === null || w === null) {
    return NextResponse.json({ error: "invalid score" }, { status: 400 });
  }

  // A client can always lie about its own score; this only rejects the
  // obviously impossible so one bad request cannot bury the whole board.
  if (k > 100_000 || c > 100_000_000 || w > 10_000) {
    return NextResponse.json({ error: "score out of range" }, { status: 422 });
  }

  const entry = await submitScore({ wallet, kills: k, coins: c, wave: w });
  return NextResponse.json({ entry });
}
