import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { site } from "@/lib/product";
import { ConnectionProvider } from "@/components/connection-provider";
import "./globals.css";
const manrope = localFont({ src: [
  { path: "../../node_modules/@fontsource/manrope/files/manrope-latin-400-normal.woff2", weight: "400" },
  { path: "../../node_modules/@fontsource/manrope/files/manrope-latin-600-normal.woff2", weight: "600" },
  { path: "../../node_modules/@fontsource/manrope/files/manrope-latin-700-normal.woff2", weight: "700" },
], variable: "--font-manrope", display: "swap" });
const cormorant = localFont({ src: [
  { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
  { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2", weight: "500", style: "italic" },
], variable: "--font-cormorant", display: "swap" });
const display = localFont({ src: "../../node_modules/@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2", variable: "--font-display", display: "swap" });
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "Gangnam Review — Review quality workbench", template: "%s | Gangnam Review" },
  description: "An independent workbench for examining missing information, clinic identities and review similarity. Discover the sources. Examine the evidence.",
  openGraph: { type: "website", siteName: site.name, title: "Gangnam Review", description: "A clearer view of every review.", url: site.url, images: [{ url: "/og.png", width: 1200, height: 630, alt: "Gangnam Review — Discover the sources. Examine the evidence." }] },
  twitter: { card: "summary_large_image", title: "Gangnam Review", images: ["/og.png"] },
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "32x32" }], apple: "/apple-touch-icon.png" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#C9356E" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={manrope.variable + " " + cormorant.variable + " " + display.variable}><body><a className="skip-link" href="#main">Skip to content</a><ConnectionProvider>{children}</ConnectionProvider></body></html>;
}
