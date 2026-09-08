import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletProviders } from "@/components/WalletProviders";
import { siteConfig } from "@/lib/site-config";

// Fonts come in through a runtime <link> rather than next/font/google, which
// downloads and self-hosts at BUILD time and so needs outbound network access
// from wherever `next build` runs.
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: siteConfig.seoTitle,
  description: siteConfig.seoDescription,
  openGraph: {
    title: siteConfig.seoTitle,
    description: siteConfig.seoDescription,
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.seoTitle,
    description: siteConfig.seoDescription,
  },
};

export const viewport: Viewport = {
  themeColor: "#1a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="noise">
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
