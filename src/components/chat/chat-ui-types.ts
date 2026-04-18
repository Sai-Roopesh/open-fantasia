import type { ModelCatalogEntry } from "@/lib/types";

export type ActionSheetState =
  | {
      kind: "edit";
      messageId: string;
      value: string;
    }
  | {
      kind: "branch";
      turnId: string;
      value: string;
    }
  | {
      kind: "pin";
      messageId: string;
      value: string;
    };

export type ModelChoiceGroup = {
  connectionId: string;
  label: string;
  provider: string;
  models: ModelCatalogEntry[];
};

export type InspectorTab = "continuity" | "pins" | "timeline" | "branch";

export const inspectorTabs: Array<{ id: InspectorTab; label: string }> = [
  { id: "continuity", label: "Continuity" },
  { id: "pins", label: "Pins" },
  { id: "timeline", label: "Timeline" },
  { id: "branch", label: "Branch" },
];
