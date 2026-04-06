"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, Compass, RefreshCcw, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({
  title = "Loading workspace",
  description = "Fantasia is gathering the next view.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="space-y-6" data-testid="route-loading-state">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <Card className="rounded-[2rem] border-border/70 bg-white/70">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-28 w-full rounded-[1.5rem]" />
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-24 w-full rounded-[1.5rem]" />
            <Skeleton className="h-24 w-full rounded-[1.5rem]" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ErrorState({
  title = "This view hit a runtime snag",
  description = "The page didn’t finish rendering cleanly. You can retry safely.",
  onRetry,
  backHref = "/app",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  backHref?: string;
}) {
  return (
    <Card className="rounded-[2rem] border-red-200 bg-red-50/90" data-testid="route-error-state">
      <CardHeader>
        <div className="flex items-center gap-3 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription className="text-red-700/85">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {onRetry ? (
          <Button onClick={onRetry} className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Try again
          </Button>
        ) : null}
        <Link
          href={backHref}
          className={buttonVariants({ variant: "outline", className: "gap-2" })}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to workspace
        </Link>
      </CardContent>
    </Card>
  );
}

export function NotFoundState({
  title = "Nothing matched this route",
  description = "The item you tried to open is missing or no longer part of this workspace.",
  backHref = "/app",
}: {
  title?: string;
  description?: string;
  backHref?: string;
}) {
  return (
    <Card className="rounded-[2rem] border-border/80 bg-white/80" data-testid="route-not-found-state">
      <CardHeader>
        <div className="flex items-center gap-3 text-foreground">
          <Search className="h-5 w-5 text-brand" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Link href={backHref} className={buttonVariants({ className: "gap-2" })}>
          <Compass className="h-4 w-4" />
          Return to workspace
        </Link>
      </CardContent>
    </Card>
  );
}
