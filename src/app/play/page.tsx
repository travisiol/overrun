import type { Metadata } from "next";
import { PlayScreen } from "@/components/PlayScreen";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Play | ${siteConfig.name}`,
  description: siteConfig.seoDescription,
};

export default function PlayPage() {
  return <PlayScreen />;
}
