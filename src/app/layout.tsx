import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { THEME_INIT } from "@/lib/ui/theme";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-barlow",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Playbook — Book. Play. Replay.",
  description:
    "Find a court or table, book your time, and bring your people. Keep the best moments with highlights at participating venues on eligible plans.",
  icons: { icon: "/icon.svg" },
  metadataBase: new URL("https://playbook.databridgesol.space"),
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Playbook",
    title: "Playbook — Book. Play. Replay.",
    description: "Book courts, tables and pitches in Metro Manila. Keep your best moments with highlights at participating venues.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Playbook — Book. Play. Replay." }],
    locale: "en_PH",
  },
  twitter: {
    card: "summary_large_image",
    title: "Playbook — Book. Play. Replay.",
    description: "Book courts, tables and pitches in Metro Manila. Keep your best moments with highlights at participating venues.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#101713",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-PH" className={`${barlow.variable} ${inter.variable}`} data-motion="full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
