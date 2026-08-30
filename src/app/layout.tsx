import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/outrank/providers";
import { PwaRegister } from "@/components/outrank/PwaRegister";
import { AnalyticsConsent } from "@/components/outrank/AnalyticsConsent";

// shrink the page (not just the visual viewport) when the mobile keyboard
// opens, so bottom-anchored drawers keep their action buttons on screen
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  // Must live INSIDE metadata — a standalone metadataBase export is ignored by Next
  metadataBase: new URL("https://content-rank.lol"),
  title: "OUTRANK — The internet is competing for attention.",
  description:
    "OUTRANK is a live attention market. Boost what you love up the board. Watch ranks move in real time. Own the #1.",
  keywords: ["outrank", "leaderboard", "hype", "attention market", "ranking", "live"],
  authors: [{ name: "OUTRANK" }],
  icons: { icon: "/outrank/favicon.svg" },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "OUTRANK",
    description: "The internet is competing for attention. Now you can see who owns it.",
    type: "website",
    images: [{ url: "https://content-rank.lol/api/og-image", width: 1200, height: 630, alt: "OUTRANK — Own the #1." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "OUTRANK",
    description: "Own the #1.",
    images: ["https://content-rank.lol/api/og-image"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased bg-paper text-ink font-sans paper-grain scanlines"
      >
        <QueryProvider>{children}</QueryProvider>
        <PwaRegister />
        <AnalyticsConsent />
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
