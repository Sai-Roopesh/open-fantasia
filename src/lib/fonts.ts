import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

export const brandSerif = Fraunces({
  subsets: ["latin"],
  variable: "--font-brand-serif",
  weight: ["500", "600", "700"],
});

export const chatSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-chat-sans",
  weight: ["400", "500", "600", "700"],
});

export const codeMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-code-mono",
  weight: ["400", "500"],
});
