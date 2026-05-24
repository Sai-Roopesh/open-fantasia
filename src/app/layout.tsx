import type { Metadata, Viewport } from "next";
import "./globals.css";
import { displayFont, bodyFont, codeMono } from "@/lib/fonts";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Fantasia — Private Roleplay Workspace",
  description:
    "A private, single-user roleplay workspace for long-form AI conversations with persistent memory and branching narratives.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
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
      className={cn(
        displayFont.variable,
        bodyFont.variable,
        codeMono.variable,
      )}
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
