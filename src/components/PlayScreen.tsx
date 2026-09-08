"use client";

import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ACCENT, siteConfig } from "@/lib/site-config";

// The game pulls in three.js and touches `window` on construction, so it must
// never run during the server render.
const GameCanvas = dynamic(
  () => import("@/components/GameCanvas").then((m) => m.GameCanvas),
  { ssr: false },
);

function Cloud({
  top,
  left,
  right,
  w,
  h,
  color,
}: {
  top: string;
  left?: string;
  right?: string;
  w: number;
  h: number;
  color: string;
}) {
  return (
    <div style={{ position: "absolute", top, left, right }}>
      <div
        style={{
          width: w,
          height: h,
          background: color,
          borderRadius: "50%",
          position: "relative",
        }}
      >
        <div
          style={{
            width: w * 0.68,
            height: h * 0.78,
            background: color,
            borderRadius: "50%",
            position: "absolute",
            top: -h * 0.22,
            left: w * 0.16,
          }}
        />
      </div>
    </div>
  );
}

export function PlayScreen() {
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();

  if (connected) return <GameCanvas />;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background:
          "radial-gradient(ellipse at center, #E8945A 0%, #C76B3A 40%, #8B4513 70%, #4A2508 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '"Courier New", monospace',
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Cloud top="6%" left="12%" w={90} h={45} color="#4A2508" />
      <Cloud top="4%" right="18%" w={70} h={38} color="#3D1F06" />
      <Cloud top="0%" left="42%" w={100} h={50} color="#2E1504" />

      <svg
        style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 100 }}
        viewBox="0 0 1200 100"
        preserveAspectRatio="none"
      >
        <path
          d={`M0,100 L0,68 ${Array.from({ length: 60 }, (_, i) => {
            const x = i * 20;
            const tip = 22 + ((i * 37) % 34);
            return `Q${x + 6},${tip} ${x + 12},${58 + ((i * 13) % 12)} Q${
              x + 16
            },${40 + ((i * 7) % 14)} ${x + 20},${62 + ((i * 5) % 8)}`;
          }).join(" ")} L1200,100 Z`}
          fill="#2E1504"
        />
      </svg>

      <div style={{ textAlign: "center", zIndex: 10, position: "relative" }}>
        <h1
          style={{
            fontSize: 68,
            fontWeight: 900,
            color: ACCENT,
            textShadow:
              "0 0 30px rgba(255,140,66,0.5), 0 4px 0px #8B4513, 0 7px 0px #5C2E0A",
            letterSpacing: 6,
            margin: 0,
            fontFamily: 'Impact, "Arial Black", sans-serif',
          }}
        >
          {siteConfig.name}
        </h1>

        <div
          style={{
            margin: "14px 0 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <div style={{ width: 50, height: 2, background: "rgba(255,140,66,0.4)" }} />
          <span
            style={{
              fontSize: 22,
              color: ACCENT,
              opacity: 0.8,
              textShadow: "0 0 8px rgba(255,140,66,0.5)",
            }}
          >
            ☣
          </span>
          <div style={{ width: 50, height: 2, background: "rgba(255,140,66,0.4)" }} />
        </div>

        <p
          style={{
            fontSize: 14,
            color: "#ddd",
            letterSpacing: 4,
            fontWeight: 700,
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Survive. Upgrade. Dominate.
        </p>
        <p style={{ fontSize: 13, color: "#aaa", marginBottom: 36 }}>
          Connect your Solana wallet to play
        </p>

        <div className="wallet-btn-wrapper">
          <button className="connect-btn" onClick={() => setVisible(true)}>
            Connect wallet
          </button>
        </div>

        <div
          style={{
            marginTop: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <div style={{ width: 35, height: 1, background: "#444" }} />
          <p style={{ fontSize: 10, color: "#666", margin: 0 }}>
            Your progress (kills, coins, guns) is saved against your wallet.
          </p>
          <div style={{ width: 35, height: 1, background: "#444" }} />
        </div>
      </div>
    </div>
  );
}
