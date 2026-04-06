"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  LibraryBig,
  Menu,
  MessageCircleHeart,
  ScrollText,
  Settings2,
  UserRound,
  X,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { cn } from "@/lib/utils";
import type { ThreadListItem } from "@/lib/types";
import { useState } from "react";

const desktopNavItems = [
  { href: "/app", label: "Home", icon: Compass },
  { href: "/app/threads", label: "Threads", icon: LibraryBig },
  { href: "/app/characters", label: "Characters", icon: ScrollText },
  { href: "/app/personas", label: "Personas", icon: UserRound },
  { href: "/app/settings/providers", label: "Providers", icon: Settings2 },
];

const mobileNavItems = [
  { href: "/app", label: "Home", icon: Compass },
  { href: "/app/threads", label: "Threads", icon: LibraryBig },
  { href: "/app/characters", label: "Characters", icon: ScrollText },
] as const;

function isRouteActive(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === "/app";
  }
  return pathname.startsWith(href);
}

export function AppShell({
  email,
  threads,
  children,
}: {
  email: string;
  threads: ThreadListItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto min-h-screen max-w-[1600px] lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden min-h-screen border-r border-border/90 bg-[#f6eee2]/94 px-5 py-6 backdrop-blur xl:block">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-brand/90 p-0.5">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-paper text-brand">
                <MessageCircleHeart className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="font-serif text-2xl text-foreground">Fantasia</p>
              <p className="text-xs uppercase tracking-[0.24em] text-ink-soft">
                private workspace
              </p>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const active = isRouteActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-brand text-white shadow-lg"
                      : "text-ink-soft hover:bg-black/5 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-10">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
                Recent threads
              </p>
              <Link
                href="/app/threads"
                className="text-xs font-semibold text-brand transition hover:text-brand-strong"
              >
                View all
              </Link>
            </div>

            <div className="mt-3 space-y-2">
              {threads.length ? (
                threads.slice(0, 6).map((thread) => {
                  const active = pathname === `/app/chats/${thread.id}`;
                  return (
                    <Link
                      key={thread.id}
                      href={`/app/chats/${thread.id}`}
                      className={cn(
                        "block rounded-2xl px-4 py-3 text-sm transition",
                        active
                          ? "bg-accent text-white"
                          : "bg-white/70 text-foreground hover:bg-white",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{thread.title}</p>
                        {thread.pinned_at ? (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-brand">
                            pinned
                          </span>
                        ) : null}
                      </div>
                      <p className={cn("mt-1 truncate text-xs", active ? "text-white/76" : "text-ink-soft")}>
                        {thread.characters?.name ?? "Unknown character"}
                        {thread.user_personas?.name ? ` • ${thread.user_personas.name}` : ""}
                      </p>
                    </Link>
                  );
                })
              ) : (
                <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm leading-7 text-ink-soft">
                  Threads you touch most often will stay within easy reach here.
                </p>
              )}
            </div>
          </div>

          <div className="mt-10 rounded-[1.75rem] bg-black/5 px-4 py-4 text-sm text-ink-soft">
            <p className="font-medium text-foreground">Signed in</p>
            <p className="mt-1 break-all">{email}</p>
            <SignOutButton className="mt-4" compact />
          </div>
        </aside>

        <div className="min-h-screen pb-24 xl:pb-0">
          <header className="sticky top-0 z-40 border-b border-border/80 bg-[#f5ede2]/90 px-4 py-4 backdrop-blur xl:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/app" className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white">
                  <MessageCircleHeart className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-serif text-2xl leading-none text-foreground">Fantasia</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-ink-soft">
                    private workspace
                  </p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
              >
                <Menu className="h-4 w-4" />
                More
              </button>
            </div>
          </header>

          <main id="app-main" className="min-h-screen px-4 py-5 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-[#f7efe4]/94 px-3 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] pt-3 backdrop-blur xl:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-2">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const active = isRouteActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold transition",
                  active
                    ? "bg-brand text-white"
                    : "text-ink-soft hover:bg-white hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold text-ink-soft transition hover:bg-white hover:text-foreground"
          >
            <Settings2 className="h-4 w-4" />
            More
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="Close more menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-[#120d09]/44"
          />
          <div className="absolute inset-x-3 bottom-24 rounded-[2rem] border border-border bg-[#fff8ef] p-5 shadow-[0_30px_80px_rgba(34,20,12,0.18)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">More</p>
                <p className="mt-2 font-serif text-3xl text-foreground">Workspace controls</p>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-full border border-border p-2 text-foreground transition hover:border-brand hover:text-brand"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-2">
              {desktopNavItems.slice(3).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium text-foreground transition hover:border-brand hover:text-brand"
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    <span className="text-xs uppercase tracking-[0.18em] text-ink-soft">
                      open
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-5 rounded-[1.5rem] bg-black/5 px-4 py-4 text-sm text-ink-soft">
              <p className="font-medium text-foreground">Signed in</p>
              <p className="mt-1 break-all">{email}</p>
              <SignOutButton className="mt-4" compact />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
