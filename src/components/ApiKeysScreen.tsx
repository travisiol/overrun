"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ACCENT, siteConfig } from "@/lib/site-config";
import { MODEL, MODEL_RATE, TIERS, type Tier } from "@/lib/tiers";

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

function TierCard({
  tier,
  connected,
  onBuy,
}: {
  tier: Tier;
  connected: boolean;
  onBuy: (tier: Tier) => void;
}) {
  const lines = [
    `${tier.millionTokens}M tokens/month (input + output)`,
    MODEL_RATE,
    `${tier.rpm} requests/minute`,
    ...tier.perks,
  ];

  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(20,12,8,0.95) 0%, rgba(10,6,4,0.98) 100%)",
        border: tier.featured
          ? "1.5px solid rgba(255,140,66,0.4)"
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 28,
        position: "relative",
        boxShadow: tier.featured
          ? "0 10px 40px rgba(255,140,66,0.1)"
          : "0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      {tier.featured && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "4px 14px",
            borderRadius: 12,
            background: ACCENT,
            color: "#fff",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 1,
            whiteSpace: "nowrap",
          }}
        >
          MOST POPULAR
        </div>
      )}

      <h3
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: "#fff",
          margin: "0 0 4px",
          letterSpacing: 1,
        }}
      >
        {tier.name}
      </h3>
      <p style={{ fontSize: 10, color: "#666", margin: "0 0 16px" }}>
        {tier.blurb}
      </p>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: "#9966ff" }}>
            {tier.sol}
          </span>
          <span style={{ fontSize: 12, color: "#888" }}>SOL</span>
        </div>
        <p style={{ fontSize: 9, color: "#555", margin: "4px 0 0" }}>
          {tier.millionTokens}M tokens · 30 days
        </p>
      </div>

      <div
        style={{
          display: "inline-block",
          padding: "5px 12px",
          borderRadius: 6,
          background: "rgba(255,140,66,0.08)",
          border: "1px solid rgba(255,140,66,0.2)",
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 10, color: ACCENT, fontWeight: 700 }}>
          {MODEL}
        </span>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px" }}>
        {lines.map((line, i) => (
          <li
            key={line}
            style={{
              padding: "6px 0",
              fontSize: 11,
              color: "#bbb",
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderBottom:
                i === lines.length - 1
                  ? "none"
                  : "1px solid rgba(255,255,255,0.03)",
            }}
          >
            <span style={{ color: ACCENT, fontSize: 10 }}>✓</span>
            {line}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onBuy(tier)}
        style={{
          width: "100%",
          padding: 12,
          border: "none",
          borderRadius: 8,
          background: connected ? ACCENT : "#222",
          color: connected ? "#fff" : "#555",
          fontSize: 13,
          fontWeight: 800,
          fontFamily: '"Courier New", monospace',
          cursor: connected ? "pointer" : "pointer",
          letterSpacing: 1,
          textTransform: "uppercase",
          boxShadow: connected ? "0 4px 14px rgba(255,140,66,0.25)" : "none",
          transition: "all 0.15s ease",
        }}
      >
        {connected ? `Buy ${tier.name}` : "Connect wallet"}
      </button>
    </div>
  );
}

export function ApiKeysScreen() {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const onBuy = (tier: Tier) => {
    if (!connected) {
      setVisible(true);
      return;
    }
    // Checkout is deliberately not wired up: it would move real SOL, and no
    // treasury address or key-issuing service exists yet. See README.
    window.alert(
      `Checkout is not live yet.\n\n${tier.name} · ${tier.sol} SOL · ${tier.millionTokens}M tokens\n\nNo transaction has been sent.`,
    );
  };

  return (
    <div className="mono-page">
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 40,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: ACCENT,
                textShadow: "0 0 14px rgba(255,140,66,0.6)",
                letterSpacing: 2,
                margin: 0,
              }}
            >
              API KEYS
            </h1>
            <p
              style={{
                fontSize: 12,
                color: "#888",
                marginTop: 6,
                letterSpacing: 1,
              }}
            >
              Buy {MODEL} API keys with {siteConfig.ticker} or SOL
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link className="nav-pill" style={navPill} href="/leaderboard">
              ← LEADERBOARD
            </Link>
            <Link className="nav-pill" style={navPill} href="/">
              HOME
            </Link>
          </div>
        </div>

        <div
          style={{
            textAlign: "center",
            padding: 40,
            background: "rgba(255,140,66,0.03)",
            border: "1px solid rgba(255,140,66,0.15)",
            borderRadius: 12,
            marginBottom: 32,
          }}
        >
          {connected && publicKey ? (
            <>
              <p style={{ fontSize: 14, color: "#aaa", marginBottom: 16 }}>
                Connected as{" "}
                <span style={{ color: ACCENT }}>
                  {publicKey.toBase58().slice(0, 4)}…
                  {publicKey.toBase58().slice(-4)}
                </span>
              </p>
              <button className="connect-btn" onClick={() => disconnect()}>
                Disconnect
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, color: "#aaa", marginBottom: 16 }}>
                Connect your wallet to purchase API keys
              </p>
              <button className="connect-btn" onClick={() => setVisible(true)}>
                Connect wallet
              </button>
            </>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {TIERS.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              connected={connected}
              onBuy={onBuy}
            />
          ))}
        </div>

        <div
          style={{
            marginTop: 40,
            padding: 24,
            borderRadius: 12,
            background: "rgba(255,140,66,0.03)",
            border: "1px solid rgba(255,140,66,0.1)",
          }}
        >
          <h3
            style={{
              fontSize: 14,
              color: ACCENT,
              margin: "0 0 12px",
              fontWeight: 700,
            }}
          >
            How it works
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            {[
              [
                `1. Earn or buy ${siteConfig.ticker}`,
                `Every zombie you drop pays 100 coins. Trade coins for ${siteConfig.ticker}, or skip the game and pay in SOL.`,
              ],
              [
                "2. Pick a tier",
                "Keys run 30 days and are capped by tokens rather than by calls, so a quiet week costs you nothing.",
              ],
              [
                "3. Collect your key",
                `Pay on-chain and the key is issued on the spot. Point any ${MODEL} client at it.`,
              ],
            ].map(([title, body]) => (
              <div key={title}>
                <p
                  style={{
                    fontSize: 11,
                    color: "#aaa",
                    margin: "0 0 4px",
                    fontWeight: 700,
                  }}
                >
                  {title}
                </p>
                <p style={{ fontSize: 10, color: "#666", margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <p style={{ fontSize: 10, color: "#444" }}>
            API keys are tied to your wallet address · 30-day validity · Solana
          </p>
        </div>
      </div>
    </div>
  );
}
