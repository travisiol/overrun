import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Solana wallet adapters ship browser-targeted ESM that trips the
  // server bundler unless it is transpiled with the app.
  transpilePackages: [
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-wallets",
  ],
};

export default nextConfig;
