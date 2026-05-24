import { Hanken_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";

export const displayFont = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
  display: "swap",
});

export const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const codeMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-code-mono",
  weight: ["400", "500"],
  display: "swap",
});
