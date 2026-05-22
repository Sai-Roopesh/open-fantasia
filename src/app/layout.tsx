import type { Metadata } from "next";
import "./globals.css";
import { brandSerif, chatSans, codeMono } from "@/lib/fonts";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Open-Fantasia",
  description:
    "A private roleplay workspace for long-form AI conversations across free and bring-your-own providers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(brandSerif.variable, chatSans.variable, codeMono.variable, "font-sans", geist.variable)}
    >
      <body suppressHydrationWarning>
        <a href="#app-root-content" className="skip-link">
          Skip to content
        </a>
        <div id="app-root-content">{children}</div>
      </body>
    </html>
  );
}
