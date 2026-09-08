"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ACCENT } from "@/lib/site-config";
import type { LeaderboardEntry } from "@/lib/leaderboard-types";

type Sort = "kills" | "coins";

const navPill: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid #333",
  color: "#aaa",
  fontSize: 11,
  textDecoration: "none",
  fontWeight: 600,
};

const th: React.CSSProperties = {
  fontSize: 9,
  color: "#555",
  fontWeight: 700,
  letterSpacing: 1,
};

function shortAddress(address: string) {
  return address.length > 12
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address;
}

function medal(rank: number) {
  if (rank === 1) return "#FFD24A";
  if (rank === 2) return "#CFCFCF";
  if (rank === 3) return "#D08A4A";
  return "#666";
}

export function LeaderboardScreen() {
  const { publicKey } = useWallet();
  const [sort, setSort] = useState<Sort>("kills");
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const me = publicKey?.toBase58();

  useEffect(() => {
    let live = true;
    setRows(null);
    fetch(`/api/leaderboard?sort=${sort}`)
      .then((r) => r.json())
      .then((d) => {
        if (live) setRows(d.entries ?? []);
      })
      .catch(() => {
        if (live) setRows([]);
      });
    return () => {
      live = false;
    };
  }, [sort]);

  return (
    <div className="mono-page">
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: ACCENT,
                textShadow: `0 0 14px rgba(255,140,66,0.6)`,
                letterSpacing: 2,
                margin: 0,
              }}
            >
              LEADERBOARD
            </h1>
            <p
              style={{
                fontSize: 11,
                color: "#555",
                marginTop: 4,
                letterSpacing: 1,
              }}
            >
              top survivors ranked by skill
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link className="nav-pill" style={navPill} href="/">
              ← HOME
            </Link>
            <Link
              style={{
                ...navPill,
                background: ACCENT,
                border: "none",
                color: "#fff",
                fontWeight: 800,
              }}
              href="/play"
            >
              ▶ PLAY
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {(["kills", "coins"] as const).map((key) => {
            const active = sort === key;
            return (
              <button
                key={key}
                onClick={() => setSort(key)}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: active
                    ? "rgba(255,140,66,0.15)"
                    : "rgba(255,255,255,0.03)",
                  color: active ? ACCENT : "#666",
                  fontFamily: "monospace",
                  fontSize: 12,
                  fontWeight: 700,
                  borderBottom: `2px solid ${active ? ACCENT : "transparent"}`,
                }}
              >
                MOST {key.toUpperCase()}
              </button>
            );
          })}
        </div>

        <div
          style={{
            background: "rgba(10,10,10,0.8)",
            border: "1px solid #1a1a1a",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "60px 1fr 120px 120px",
              padding: "14px 20px",
              background: "rgba(255,255,255,0.02)",
              borderBottom: "1px solid #1a1a1a",
            }}
          >
            <span style={th}>RANK</span>
            <span style={th}>PLAYER</span>
            <span style={{ ...th, textAlign: "right" }}>KILLS</span>
            <span style={{ ...th, textAlign: "right" }}>COINS</span>
          </div>

          {rows === null ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <p style={{ color: "#555", fontSize: 14 }}>loading...</p>
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <p style={{ color: "#555", fontSize: 14, marginBottom: 8 }}>
                No survivors yet
              </p>
              <p style={{ color: "#444", fontSize: 11 }}>
                Be the first to play and claim the #1 spot!
              </p>
            </div>
          ) : (
            rows.map((row, i) => {
              const mine = me === row.wallet;
              return (
                <div
                  key={row.wallet}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr 120px 120px",
                    padding: "14px 20px",
                    borderBottom: "1px solid #141414",
                    background: mine ? "rgba(255,140,66,0.06)" : "transparent",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: medal(i + 1),
                    }}
                  >
                    #{i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: mine ? ACCENT : "#ccc",
                      fontWeight: mine ? 800 : 400,
                    }}
                  >
                    {shortAddress(row.wallet)}
                    {mine ? "  (you)" : ""}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#eee",
                      textAlign: "right",
                      fontWeight: 700,
                    }}
                  >
                    {row.kills.toLocaleString()}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#FFD24A",
                      textAlign: "right",
                      fontWeight: 700,
                    }}
                  >
                    {row.coins.toLocaleString()}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <p style={{ fontSize: 10, color: "#444" }}>
            connect your Phantom wallet and play to appear on the leaderboard
          </p>
          <Link
            className="buy-keys-link"
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "10px 24px",
              borderRadius: 8,
              background: "rgba(255,140,66,0.1)",
              border: "1px solid rgba(255,140,66,0.3)",
              color: ACCENT,
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: 1,
              transition: "all 0.15s ease",
            }}
            href="/api-keys"
          >
            BUY API KEYS →
          </Link>
        </div>
      </div>
    </div>
  );
}
