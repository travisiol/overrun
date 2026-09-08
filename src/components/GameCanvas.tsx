"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Engine, BLOCK_COST, type HudState } from "@/game/engine";
import { UPGRADES, WEAPONS, type UpgradeId } from "@/game/weapons";
import { ACCENT, siteConfig } from "@/lib/site-config";
import { loadProgress, saveProgress } from "@/lib/progress";

const EMPTY_HUD: HudState = {
  health: 100,
  maxHealth: 100,
  coins: 0,
  kills: 0,
  wave: 0,
  waveLeft: 0,
  ammo: 12,
  magazine: 12,
  reloading: false,
  weaponId: "pistol",
  weaponName: "Sidearm",
  owned: ["pistol"],
  upgrades: { health: 0, damage: 0, speed: 0, reload: 0 },
  hitFlash: 0,
  hurtFlash: 0,
  dead: false,
  banner: null,
  locked: false,
  message: null,
};

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;

  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [shopOpen, setShopOpen] = useState(false);
  const [submitted, setSubmitted] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [ready, setReady] = useState(false);

  const hudRef = useRef(hud);
  hudRef.current = hud;

  // --- boot the engine once the canvas exists ------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const saved = wallet ? loadProgress(wallet) : null;

    const engine = new Engine({
      canvas,
      onHud: setHud,
      onDeath: ({ kills, coins, wave }) => {
        if (!wallet) return;
        saveProgress(wallet, {
          coins,
          kills,
          owned: [...engine.player.owned],
          upgrades: engine.player.upgrades,
        });
        setSubmitted("sending");
        fetch("/api/leaderboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, kills, coins, wave }),
        })
          .then((r) => setSubmitted(r.ok ? "done" : "error"))
          .catch(() => setSubmitted("error"));
      },
      initial: saved ?? undefined,
    });

    engineRef.current = engine;
    engine.start();
    engine.pushHud(true);
    setReady(true);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [wallet]);

  // --- shop toggle ---------------------------------------------------
  const toggleShop = useCallback((open: boolean) => {
    const engine = engineRef.current;
    setShopOpen(open);
    if (!engine) return;
    if (open) engine.releaseLock();
    else engine.requestLock();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyB" && e.code !== "Tab") return;
      if (hudRef.current.dead) return;
      e.preventDefault();
      toggleShop(!shopOpen);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [shopOpen, toggleShop]);

  // Persist between waves so a browser crash does not cost the whole run.
  useEffect(() => {
    if (!wallet || !ready) return;
    const engine = engineRef.current;
    if (!engine) return;
    const id = setInterval(() => {
      saveProgress(wallet, {
        coins: engine.player.coins,
        kills: engine.player.kills,
        owned: [...engine.player.owned],
        upgrades: engine.player.upgrades,
      });
    }, 8000);
    return () => clearInterval(id);
  }, [wallet, ready]);

  const healthPct = Math.max(0, (hud.health / hud.maxHealth) * 100);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#1a0a0a",
        fontFamily: '"Courier New", monospace',
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
        onClick={() => {
          if (!shopOpen && !hud.dead) engineRef.current?.requestLock();
        }}
      />

      {/* damage vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          boxShadow: `inset 0 0 ${140 + hud.hurtFlash * 120}px rgba(150,0,0,${
            0.18 + hud.hurtFlash * 0.5
          })`,
          transition: "box-shadow 0.1s linear",
        }}
      />

      {/* crosshair */}
      {hud.locked && !hud.dead && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 22,
              height: 22,
              opacity: hud.hitFlash > 0 ? 1 : 0.75,
            }}
          >
            {[
              { top: 0, left: 10, w: 2, h: 7 },
              { top: 15, left: 10, w: 2, h: 7 },
              { top: 10, left: 0, w: 7, h: 2 },
              { top: 10, left: 15, w: 7, h: 2 },
            ].map((s, i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  top: s.top,
                  left: s.left,
                  width: s.w,
                  height: s.h,
                  background: hud.hitFlash > 0 ? "#ff5a3c" : "#fff",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* wave banner */}
      {hud.banner && !hud.dead && (
        <div
          style={{
            position: "absolute",
            top: "18%",
            left: 0,
            right: 0,
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "inline-block",
              fontFamily: 'Impact, "Arial Black", sans-serif',
              fontSize: 54,
              letterSpacing: 8,
              color: ACCENT,
              textShadow: "0 0 30px rgba(255,140,66,0.6), 0 4px 0 #5C2E0A",
            }}
          >
            {hud.banner}
          </div>
        </div>
      )}

      {/* transient message */}
      {hud.message && (
        <div
          style={{
            position: "absolute",
            top: "62%",
            left: 0,
            right: 0,
            textAlign: "center",
            pointerEvents: "none",
            color: "#ffd0a0",
            fontSize: 13,
            letterSpacing: 1,
          }}
        >
          {hud.message}
        </div>
      )}

      {/* --- HUD ------------------------------------------------------ */}
      <div
        style={{
          position: "absolute",
          left: 20,
          bottom: 20,
          width: 260,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            height: 14,
            border: "1px solid rgba(0,0,0,0.5)",
            borderRadius: 3,
            background: "rgba(0,0,0,0.45)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${healthPct}%`,
              height: "100%",
              background:
                healthPct > 50 ? "#6FBF3A" : healthPct > 22 ? "#E8A838" : "#D33B22",
              transition: "width 0.12s linear",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "#fff",
            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
            letterSpacing: 1,
          }}
        >
          {hud.health} / {hud.maxHealth} HP
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          textAlign: "right",
          pointerEvents: "none",
          textShadow: "0 1px 3px rgba(0,0,0,0.9)",
        }}
      >
        <div style={{ fontSize: 13, color: "#ddd", letterSpacing: 1 }}>
          {hud.weaponName}
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 900,
            color: hud.reloading ? ACCENT : "#fff",
            letterSpacing: 2,
          }}
        >
          {hud.reloading ? "RELOAD" : `${hud.ammo} / ${hud.magazine}`}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 20,
          pointerEvents: "none",
          textShadow: "0 1px 3px rgba(0,0,0,0.9)",
        }}
      >
        <div style={{ fontSize: 11, color: "#ffcf99", letterSpacing: 2 }}>
          WAVE {hud.wave || "—"}
        </div>
        <div style={{ fontSize: 11, color: "#bbb", letterSpacing: 1, marginTop: 2 }}>
          {hud.waveLeft} left
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 16,
          right: 20,
          textAlign: "right",
          pointerEvents: "none",
          textShadow: "0 1px 3px rgba(0,0,0,0.9)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, color: "#FFD24A", letterSpacing: 1 }}>
          {hud.coins.toLocaleString()} ¢
        </div>
        <div style={{ fontSize: 11, color: "#ddd", letterSpacing: 1 }}>
          {hud.kills} kills
        </div>
      </div>

      {/* --- click to play ------------------------------------------- */}
      {!hud.locked && !hud.dead && !shopOpen && (
        <button
          onClick={() => engineRef.current?.requestLock()}
          style={{
            position: "absolute",
            inset: 0,
            border: "none",
            background: "rgba(10,4,2,0.62)",
            color: "#fff",
            cursor: "pointer",
            fontFamily: '"Courier New", monospace',
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
          }}
        >
          <span
            style={{
              fontFamily: 'Impact, "Arial Black", sans-serif',
              fontSize: 46,
              letterSpacing: 6,
              color: ACCENT,
              textShadow: "0 0 26px rgba(255,140,66,0.5), 0 4px 0 #5C2E0A",
            }}
          >
            CLICK TO PLAY
          </span>
          <span style={{ fontSize: 12, color: "#ccc", letterSpacing: 1, lineHeight: 2 }}>
            WASD move · SHIFT sprint · SPACE jump · MOUSE aim
            <br />
            LEFT CLICK shoot · R reload · 1-4 weapons
            <br />
            RIGHT CLICK / E place barricade ({BLOCK_COST}¢) · Q break block
            <br />B shop · ESC release cursor
          </span>
        </button>
      )}

      {/* --- shop ----------------------------------------------------- */}
      {shopOpen && !hud.dead && (
        <Shop
          hud={hud}
          onBuyWeapon={(id) => engineRef.current?.buyWeapon(id)}
          onBuyUpgrade={(id) => engineRef.current?.buyUpgrade(id)}
          onClose={() => toggleShop(false)}
        />
      )}

      {/* --- death ---------------------------------------------------- */}
      {hud.dead && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(10,3,2,0.86)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: 'Impact, "Arial Black", sans-serif',
              fontSize: 72,
              letterSpacing: 8,
              color: "#D33B22",
              textShadow: "0 0 40px rgba(211,59,34,0.5), 0 5px 0 #4A1108",
            }}
          >
            YOU DIED
          </div>
          <div style={{ color: "#ccc", fontSize: 14, letterSpacing: 2 }}>
            wave {hud.wave} · {hud.kills} kills · {hud.coins.toLocaleString()} coins
          </div>
          <div style={{ color: "#777", fontSize: 11, marginTop: 4, height: 16 }}>
            {submitted === "sending" && "submitting to leaderboard…"}
            {submitted === "done" && "score submitted"}
            {submitted === "error" && "could not reach the leaderboard"}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            <button
              className="connect-btn"
              onClick={() => window.location.reload()}
            >
              Play again
            </button>
            <Link
              href="/leaderboard"
              className="connect-btn"
              style={{ textDecoration: "none", display: "inline-block" }}
            >
              Leaderboard
            </Link>
          </div>
          <Link
            href="/"
            style={{
              marginTop: 20,
              color: "#666",
              fontSize: 11,
              letterSpacing: 1,
              textDecoration: "none",
            }}
          >
            ← back to {siteConfig.name.toLowerCase()}
          </Link>
        </div>
      )}
    </div>
  );
}

function Shop({
  hud,
  onBuyWeapon,
  onBuyUpgrade,
  onClose,
}: {
  hud: HudState;
  onBuyWeapon: (id: string) => void;
  onBuyUpgrade: (id: UpgradeId) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(8,4,2,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        overflowY: "auto",
      }}
    >
      <div style={{ width: "100%", maxWidth: 880 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              color: ACCENT,
              letterSpacing: 3,
              fontWeight: 900,
            }}
          >
            ARMOURY
          </h2>
          <div style={{ color: "#FFD24A", fontSize: 18, fontWeight: 900 }}>
            {hud.coins.toLocaleString()} ¢
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 26,
          }}
        >
          {WEAPONS.map((w) => {
            const owned = hud.owned.includes(w.id);
            const equipped = hud.weaponId === w.id;
            const afford = hud.coins >= w.price;
            return (
              <button
                key={w.id}
                onClick={() => onBuyWeapon(w.id)}
                disabled={!owned && !afford}
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 12,
                  cursor: owned || afford ? "pointer" : "not-allowed",
                  background: equipped
                    ? "rgba(255,140,66,0.14)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    equipped ? "rgba(255,140,66,0.5)" : "rgba(255,255,255,0.08)"
                  }`,
                  color: "#ddd",
                  fontFamily: '"Courier New", monospace',
                  opacity: owned || afford ? 1 : 0.45,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  <span>{w.name}</span>
                  <span style={{ color: owned ? "#6FBF3A" : "#FFD24A" }}>
                    {owned ? (equipped ? "EQUIPPED" : "OWNED") : `${w.price}¢`}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "#888", margin: "6px 0 8px" }}>
                  {w.note}
                </div>
                <div style={{ fontSize: 10, color: "#aaa", lineHeight: 1.7 }}>
                  {w.damage} dmg{w.pellets > 1 ? ` ×${w.pellets}` : ""} · {w.rpm} rpm
                  <br />
                  {w.mag} rounds · {w.range}m
                </div>
              </button>
            );
          })}
        </div>

        <h3
          style={{
            margin: "0 0 12px",
            fontSize: 14,
            color: ACCENT,
            letterSpacing: 2,
          }}
        >
          UPGRADES
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {UPGRADES.map((u) => {
            const level = hud.upgrades[u.id];
            const maxed = level >= u.max;
            const cost = u.cost(level);
            const afford = hud.coins >= cost;
            return (
              <button
                key={u.id}
                onClick={() => onBuyUpgrade(u.id)}
                disabled={maxed || !afford}
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 12,
                  cursor: maxed || !afford ? "not-allowed" : "pointer",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#ddd",
                  fontFamily: '"Courier New", monospace',
                  opacity: maxed || afford ? 1 : 0.45,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#fff",
                  }}
                >
                  <span>{u.name}</span>
                  <span style={{ color: maxed ? "#6FBF3A" : "#FFD24A" }}>
                    {maxed ? "MAX" : `${cost}¢`}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "#888", margin: "6px 0 8px" }}>
                  {u.detail}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {Array.from({ length: u.max }, (_, i) => (
                    <span
                      key={i}
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        background: i < level ? ACCENT : "rgba(255,255,255,0.1)",
                      }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ textAlign: "center", marginTop: 26 }}>
          <button className="connect-btn" onClick={onClose}>
            Back to the fight
          </button>
          <p style={{ color: "#666", fontSize: 10, marginTop: 10 }}>
            press B to open and close the armoury
          </p>
        </div>
      </div>
    </div>
  );
}
