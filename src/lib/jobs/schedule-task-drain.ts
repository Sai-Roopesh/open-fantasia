import { after } from "next/server";
import { requireCronSecret, requirePublicSiteUrl } from "@/lib/env";

export function scheduleTaskDrain(trigger: string) {
  after(async () => {
    try {
      const response = await fetch(
        new URL("/api/internal/jobs/run", requirePublicSiteUrl()),
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${requireCronSecret()}`,
            "content-type": "application/json",
            "x-fantasia-task-trigger": trigger,
          },
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error("Background task drain request failed.", {
          trigger,
          status: response.status,
          body,
        });
      }
    } catch (error) {
      console.error("Failed to schedule background task drain.", {
        trigger,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
