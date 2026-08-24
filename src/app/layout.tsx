import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/outrank/providers";
import { PwaRegister } from "@/components/outrank/PwaRegister";

export const metadata: Metadata = {
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
  },
  twitter: { card: "summary_large_image", title: "OUTRANK", description: "Own the #1." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased bg-paper text-ink font-sans paper-grain scanlines"
      >
        <QueryProvider>{children}</QueryProvider>
        <PwaRegister />
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
