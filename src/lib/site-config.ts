/**
 * Every user-visible occurrence of the brand goes through here, so renaming the
 * game is a one-line change: edit `name` (and the handles that follow it).
 */
export const siteConfig = {
  name: "OVERRUN",
  ticker: "$OVERRUN",
  tagline: "Survive the Zombie Apocalypse!",
  seoTitle: "OVERRUN | Survive the Zombie Apocalypse",
  seoDescription:
    "A multiplayer voxel zombie survival game. Build. Fight. Survive. $OVERRUN",
  url: "https://playoverrun.online",
  twitter: "https://x.com/PlayOverrunApp",
  twitterHandle: "@PlayOverrunApp",
} as const;

/** Accent orange used by every screen. */
export const ACCENT = "#FF8C42";
