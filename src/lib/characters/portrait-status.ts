import type { CharacterPortraitStatus } from "@/lib/types";

export function buildCharacterPortraitStatusCopy(status: CharacterPortraitStatus) {
  switch (status) {
    case "pending":
      return "Generating portrait";
    case "ready":
      return "Portrait ready";
    case "failed":
      return "Portrait failed";
    default:
      return "Portrait idle";
  }
}
