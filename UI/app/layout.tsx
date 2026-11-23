import type { Metadata, Viewport } from "next";
import { Fraunces, Poppins } from "next/font/google";
import TopNav from "@/components/TopNav";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});

// flow.life pairs Poppins with a soft display face; Fraunces is the closest open substitute.
const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Miami Zip Finder",
  description: "Find the Miami zip codes that fit your budget, pets and vibe — with reasons for each pick.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${display.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <TopNav />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
