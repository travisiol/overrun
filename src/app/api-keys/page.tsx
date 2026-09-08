import type { Metadata } from "next";
import { ApiKeysScreen } from "@/components/ApiKeysScreen";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `API Keys | ${siteConfig.name}`,
  description: `Buy Claude Fable 5 API keys with ${siteConfig.ticker} or SOL.`,
};

export default function ApiKeysPage() {
  return <ApiKeysScreen />;
}
