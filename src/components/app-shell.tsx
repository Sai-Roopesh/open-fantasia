"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  LibraryBig,
  Menu,
  ScrollText,
  Settings2,
  UserRound,
  X,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { cn } from "@/lib/utils";
import type { ThreadListItem } from "@/lib/types";
import { useState, use, Suspense, useCallback, useEffect } from "react";

const navItems = [
  { href: "/app", label: "Home", icon: Compass },
  { href: "/app/threads", label: "Threads", icon: LibraryBig },
  { href: "/app/characters", label: "Characters", icon: ScrollText },
  { href: "/app/personas", label: "Personas", icon: UserRound },
  { href: "/app/settings/providers", label: "Providers", icon: Settings2 },
];

function isRouteActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname.startsWith(href);
}

export function AppShell({
  email,
  threadsPromise,
  children,
}: {
  email: string;
  threadsPromise: Promise<ThreadListItem[]>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hideShell = pathname.startsWith("/app/chats/");

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh bg-background-base">
      {/* ── Top bar (mobile + desktop) ── */}
      {!hideShell && (
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border-subtle bg-surface/95 px-4 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded text-on-surface-variant"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/app" className="flex items-center gap-2">
            <span className="font-display text-lg font-bold text-on-surface">
              Fantasia
            </span>
          </Link>
        </header>
      )}

      {/* ── Main content ── */}
      <main
        id="app-main"
        className={cn(
          "min-h-dvh",
          !hideShell && "px-4 py-4 sm:px-6 md:px-8 md:py-6 lg:mx-auto lg:max-w-[1200px]",
        )}
      >
        {children}
      </main>

      {/* ── Drawer overlay ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={closeDrawer}
            className="absolute inset-0 bg-black/60"
          />

          {/* Drawer panel */}
          <nav
            className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface-container-low border-r border-border-subtle"
            role="navigation"
            aria-label="Main navigation"
          >
            {/* Drawer header */}
            <div className="flex h-14 items-center justify-between px-4">
              <span className="font-display text-lg font-bold text-on-surface">
                Fantasia
              </span>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded text-on-surface-variant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Nav links */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isRouteActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium",
                        active
                          ? "bg-primary-container text-on-primary-container"
                          : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              {/* Recent threads */}
              <div className="mt-6">
                <div className="flex items-center justify-between px-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Recent threads
                  </p>
                  <Link
                    href="/app/threads"
                    className="text-xs font-semibold text-primary-container hover:text-primary"
                  >
                    All
                  </Link>
                </div>
                <Suspense
                  fallback={
                    <div className="mt-2 space-y-1 px-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-10 rounded bg-surface-container animate-pulse"
                        />
                      ))}
                    </div>
                  }
                >
                  <DrawerThreadList promise={threadsPromise} />
                </Suspense>
              </div>
            </div>

            {/* User footer */}
            <div className="border-t border-border-subtle px-4 py-3">
              <p className="text-xs font-medium text-on-surface">Signed in</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {email}
              </p>
              <SignOutButton className="mt-2" compact />
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}

function DrawerThreadList({
  promise,
}: {
  promise: Promise<ThreadListItem[]>;
}) {
  const threads = use(promise);
  const pathname = usePathname();

  if (!threads.length) {
    return (
      <p className="mt-2 px-3 text-xs text-muted-foreground">
        No threads yet.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      {threads.slice(0, 5).map((thread) => {
        const active = pathname === `/app/chats/${thread.id}`;
        return (
          <Link
            key={thread.id}
            href={`/app/chats/${thread.id}`}
            className={cn(
              "block rounded px-3 py-2 text-sm",
              active
                ? "bg-primary/10 text-primary"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            )}
          >
            <p className="truncate font-medium text-xs">{thread.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {thread.character_name ?? "Unknown"}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
