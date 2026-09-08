import type { Metadata } from "next";
import { LeaderboardScreen } from "@/components/LeaderboardScreen";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Leaderboard | ${siteConfig.name}`,
  description: `The highest kill counts and coin totals in ${siteConfig.name}.`,
};

export default function LeaderboardPage() {
  return <LeaderboardScreen />;
}
