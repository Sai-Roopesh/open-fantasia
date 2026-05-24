"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  Copy,
  Download,
  FileUp,
  Info,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  buildPromptPack,
  documentToJson,
  openFantasiaCharacterDocumentVersion,
  openFantasiaPersonaDocumentVersion,
  promptPackFilename,
  schemaFilename,
  templateFilename,
  type OpenFantasiaCharacterData,
  type OpenFantasiaPersonaData,
  openFantasiaCharacterJsonSchema,
  openFantasiaPersonaJsonSchema,
} from "@/lib/portability/openfantasia-json";
import {
  getLatestImportText,
  hasImportText,
  validatePortableImport,
} from "@/components/forms/json-portability-panel-helpers";
import { cn } from "@/lib/utils";

type CharacterPreviewData = OpenFantasiaCharacterData;
type PersonaPreviewData = OpenFantasiaPersonaData;
type FeedbackTone = "neutral" | "success" | "error";
type ImportPhase = "idle" | "dirty" | "valid" | "invalid" | "imported";
type ImportFeedback = {
  phase: ImportPhase;
  tone: FeedbackTone;
  title: string;
  message: string;
  previewData: CharacterPreviewData | PersonaPreviewData | null;
  validatedInput: string | null;
};

type JsonPortabilityPanelProps =
  | {
      kind: "character";
      currentData: CharacterPreviewData;
      onImport: (data: CharacterPreviewData) => void;
    }
  | {
      kind: "persona";
      currentData: PersonaPreviewData;
      onImport: (data: PersonaPreviewData) => void;
    };

export function JsonPortabilityPanel(props: JsonPortabilityPanelProps) {
  const inputId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const kindLabel = props.kind === "character" ? "character" : "persona";
  const [rawImport, setRawImport] = useState("");
  const baseNoticeMessage =
    "Export a strict Open-Fantasia JSON document, hand it to any model you like, then import the validated JSON back into this draft.";
  const [notice, setNotice] = useState<{
    tone: FeedbackTone;
    message: string;
  }>({
    tone: "neutral",
    message: baseNoticeMessage,
  });
  const [importFeedback, setImportFeedback] = useState<ImportFeedback>(() =>
    createImportFeedback(kindLabel, "idle"),
  );
  const blankDocument = useMemo(
    () =>
          props.kind === "character"
        ? {
            format: "openfantasia.character" as const,
            version: openFantasiaCharacterDocumentVersion,
            data: {
              name: "",
              story: "",
              core_persona: "",
              greeting: "",
              appearance: "",
              style_rules: "",
              definition: "",
              negative_guidance: "",
              suggested_starters: [],
              example_conversations: [],
            },
          }
        : {
            format: "openfantasia.persona" as const,
            version: openFantasiaPersonaDocumentVersion,
            data: {
              name: "",
              identity: "",
              backstory: "",
              voice_style: "",
              goals: "",
              boundaries: "",
              private_notes: "",
            },
          },
    [props.kind],
  );
  const currentDocument = useMemo(
    () => ({
      format:
        props.kind === "character"
          ? ("openfantasia.character" as const)
          : ("openfantasia.persona" as const),
      version:
        props.kind === "character"
          ? openFantasiaCharacterDocumentVersion
          : openFantasiaPersonaDocumentVersion,
      data: props.currentData,
    }),
    [props.currentData, props.kind],
  );
  const schema = props.kind === "character"
    ? openFantasiaCharacterJsonSchema
    : openFantasiaPersonaJsonSchema;
  const previewData = importFeedback.previewData;
  const hasImportValue = hasImportText(rawImport);

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({
        tone: "success",
        message: `${label} copied. Paste it into any model you want and ask for raw JSON back.`,
      });
    } catch {
      setNotice({
        tone: "error",
        message: `Could not copy ${label.toLowerCase()} from this tab. Use the download action instead.`,
      });
    }
  }

  function downloadText(filename: string, value: string) {
    const blob = new Blob([value], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice({
      tone: "success",
      message: `${filename} downloaded.`,
    });
  }

  function downloadMarkdown(filename: string, value: string) {
    const blob = new Blob([value], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice({
      tone: "success",
      message: `${filename} downloaded.`,
    });
  }

  function syncImportText(nextValue: string) {
    setRawImport(nextValue);

    if (!hasImportText(nextValue)) {
      setImportFeedback(createImportFeedback(kindLabel, "idle"));
      return;
    }

    setImportFeedback((current) => {
      if (current.phase === "valid" && current.validatedInput === nextValue) {
        return current;
      }

      return createImportFeedback(kindLabel, "dirty");
    });
  }

  function validateCurrentImport(explicitValue?: string) {
    const nextValue = getLatestImportText(
      rawImport,
      explicitValue ?? textareaRef.current?.value,
    );

    if (nextValue !== rawImport) {
      setRawImport(nextValue);
    }

    if (!hasImportText(nextValue)) {
      setImportFeedback({
        ...createImportFeedback(kindLabel, "invalid"),
        message: `Paste raw ${kindLabel} JSON or upload a file before validating.`,
      });
      return null;
    }

    const result = validatePortableImport(props.kind, nextValue);

    if (!result.ok) {
      setImportFeedback({
        ...createImportFeedback(kindLabel, "invalid"),
        message: result.message,
      });
      return null;
    }

    setImportFeedback({
      ...createImportFeedback(kindLabel, "valid"),
      message: result.message,
      previewData: result.data,
      validatedInput: nextValue,
    });
    return result.data;
  }

  function resetImportPanel(nextMessage: string) {
    setRawImport("");
    setImportFeedback({
      ...createImportFeedback(kindLabel, "imported"),
      message: nextMessage,
    });
  }

  function clearImportPanel() {
    setRawImport("");
    setImportFeedback(createImportFeedback(kindLabel, "idle"));
  }

  function loadCurrentImport() {
    const nextValue = getLatestImportText(rawImport, textareaRef.current?.value);
    const importedData =
      importFeedback.phase === "valid" && importFeedback.validatedInput === nextValue
        ? importFeedback.previewData
        : validateCurrentImport(nextValue);

    if (!importedData) {
      return;
    }

    if (props.kind === "character") {
      props.onImport(importedData as CharacterPreviewData);
    } else {
      props.onImport(importedData as PersonaPreviewData);
    }

    resetImportPanel(
      `Imported ${kindLabel} JSON loaded into the current draft. Review it, then save when it feels right.`,
    );
  }

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-container-low p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">Import / Export</p>
          <h3 className="mt-1 text-sm font-semibold text-on-surface">
            Build with external models, save with strict JSON
          </h3>
          <p className="mt-1 text-xs leading-4 text-muted-foreground">
            Export a blank template or your current draft, hand it to Claude, Gemini, or any
            other model, then import the validated Open-Fantasia JSON back into this editor.
          </p>
        </div>
        <div className="rounded border border-border-subtle bg-surface-container px-3 py-2 text-[11px] leading-4 text-muted-foreground">
          Strict contract only.
          <br />
          Extra keys and malformed shapes are rejected.
        </div>
      </div>

      <div
        aria-live="polite"
        className={cn(
          "mt-3 rounded border px-3 py-2 text-xs leading-4",
          notice.tone === "success" && "border-status-success/30 bg-status-success/10 text-status-success",
          notice.tone === "error" && "border-status-critical/30 bg-status-critical/10 text-status-critical",
          notice.tone === "neutral" && "border-border-subtle bg-surface-container text-on-surface",
        )}
      >
        {notice.message}
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <div className="rounded border border-border-subtle bg-surface-container p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">JSON artifacts</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <PanelActionButton
              icon={Download}
              onClick={() =>
                downloadText(
                  templateFilename(props.kind, "blank"),
                  documentToJson(blankDocument),
                )
              }
            >
              Blank template
            </PanelActionButton>
            <PanelActionButton
              icon={Download}
              onClick={() =>
                downloadText(
                  templateFilename(props.kind, "export"),
                  documentToJson(currentDocument),
                )
              }
            >
              Export current JSON
            </PanelActionButton>
            <PanelActionButton
              icon={Braces}
              onClick={() =>
                downloadText(schemaFilename(props.kind), documentToJson(schema))
              }
            >
              Download schema
            </PanelActionButton>
            <PanelActionButton
              icon={Copy}
              onClick={() => void copyText("current JSON", documentToJson(currentDocument))}
            >
              Copy current JSON
            </PanelActionButton>
          </div>
        </div>

        <div className="rounded border border-border-subtle bg-surface-container p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Prompt packs</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(["generic", "claude", "gemini"] as const).map((target) => (
              <PanelActionButton
                key={`${props.kind}-${target}`}
                icon={Sparkles}
                onClick={() =>
                  downloadMarkdown(
                    promptPackFilename(props.kind, target),
                    props.kind === "character"
                      ? buildPromptPack("character", target)
                      : buildPromptPack("persona", target),
                  )
                }
              >
                {target === "generic"
                  ? "Generic prompt pack"
                  : `${capitalize(target)} prompt pack`}
              </PanelActionButton>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded border border-border-subtle bg-surface-container p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Import JSON</p>
            <p className="mt-1 text-xs leading-4 text-muted-foreground">
              Paste raw JSON or upload a file.
            </p>
          </div>
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer items-center gap-1 rounded bg-surface-container-high px-2 py-1 text-[11px] font-semibold text-on-surface"
          >
            <Upload className="h-3 w-3" />
            Upload file
          </label>
          <input
            id={inputId}
            type="file"
            accept=".json,.txt,.md"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              syncImportText(text);
              validateCurrentImport(text);
              event.target.value = "";
            }}
          />
        </div>

        <textarea
          ref={textareaRef}
          rows={10}
          value={rawImport}
          onChange={(event) => syncImportText(event.target.value)}
          placeholder={`Paste openfantasia.${props.kind} JSON here...`}
          className="mt-2 w-full rounded border-b-2 border-border-subtle bg-surface-container px-3 py-2 text-sm leading-6 text-on-surface outline-none focus:border-primary-container"
        />

        <div className="mt-2 flex flex-wrap gap-1">
          <PanelActionButton
            icon={FileUp}
            disabled={!hasImportValue}
            onClick={() => validateCurrentImport()}
          >
            Preview import
          </PanelActionButton>
          <button
            type="button"
            disabled={!hasImportValue}
            onClick={loadCurrentImport}
            className={cn(
              "rounded px-3 py-1 text-xs font-semibold",
              hasImportValue
                ? "bg-primary-container text-on-primary-container"
                : "cursor-not-allowed bg-surface-container text-muted-foreground",
            )}
          >
            Load into draft
          </button>
          <button
            type="button"
            disabled={!hasImportValue}
            onClick={clearImportPanel}
            className={cn(
              "rounded px-3 py-1 text-xs font-semibold",
              hasImportValue
                ? "bg-surface-container-high text-on-surface"
                : "cursor-not-allowed bg-surface-container text-muted-foreground",
            )}
          >
            Clear pasted JSON
          </button>
        </div>

        <ImportFeedbackCard feedback={importFeedback} />

        {previewData ? (
          <div className="mt-3 rounded border border-border-subtle bg-surface-container-low px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Import preview</p>
            <div className="mt-2 space-y-1 text-xs leading-5 text-on-surface">
              {props.kind === "character" ? (
                <>
                  <p>
                    <span className="font-semibold">Name:</span>{" "}
                    {(previewData as CharacterPreviewData).name || "Untitled"}
                  </p>
                  <p>
                    <span className="font-semibold">Starters:</span>{" "}
                    {(previewData as CharacterPreviewData).suggested_starters.length}
                  </p>
                  <p>
                    <span className="font-semibold">Example conversations:</span>{" "}
                    {(previewData as CharacterPreviewData).example_conversations.length}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <span className="font-semibold">Name:</span>{" "}
                    {(previewData as PersonaPreviewData).name || "Untitled"}
                  </p>
                  <p>
                    <span className="font-semibold">Identity:</span>{" "}
                    {truncate((previewData as PersonaPreviewData).identity || "Empty", 96)}
                  </p>
                  <p>
                    <span className="font-semibold">Goals:</span>{" "}
                    {truncate((previewData as PersonaPreviewData).goals || "Empty", 96)}
                  </p>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PanelActionButton({
  children,
  icon: Icon,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  icon: typeof Download;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold",
        disabled
          ? "cursor-not-allowed bg-surface-container text-muted-foreground"
          : "bg-surface-container-high text-on-surface",
      )}
    >
      <Icon className="h-3 w-3" />
      {children}
    </button>
  );
}

function ImportFeedbackCard({
  feedback,
}: {
  feedback: ImportFeedback;
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "mt-2 rounded border px-3 py-2",
        feedback.tone === "success" && "border-status-success/30 bg-status-success/10 text-status-success",
        feedback.tone === "error" && "border-status-critical/30 bg-status-critical/10 text-status-critical",
        feedback.tone === "neutral" && "border-border-subtle bg-surface-container text-on-surface",
      )}
    >
      <div className="flex items-start gap-3">
        <ImportFeedbackIcon tone={feedback.tone} />
        <div className="min-w-0">
          <p className="text-xs font-semibold">{feedback.title}</p>
          <p className="mt-0.5 text-xs leading-4 whitespace-pre-wrap">{feedback.message}</p>
        </div>
      </div>
    </div>
  );
}

function ImportFeedbackIcon({
  tone,
}: {
  tone: FeedbackTone;
}) {
  if (tone === "success") {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />;
  }

  if (tone === "error") {
    return <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />;
  }

  return <Info className="mt-0.5 h-4 w-4 shrink-0" />;
}

function createImportFeedback(
  kindLabel: string,
  phase: ImportPhase,
): ImportFeedback {
  const kindTitle = capitalize(kindLabel);

  switch (phase) {
    case "dirty":
      return {
        phase,
        tone: "neutral",
        title: `${kindTitle} JSON pasted`,
        message: "Preview it to confirm the structure, or load it directly and this panel will validate first.",
        previewData: null,
        validatedInput: null,
      };
    case "valid":
      return {
        phase,
        tone: "success",
        title: `${kindTitle} JSON is ready`,
        message: `Valid ${kindLabel} JSON detected.`,
        previewData: null,
        validatedInput: null,
      };
    case "invalid":
      return {
        phase,
        tone: "error",
        title: `${kindTitle} JSON needs attention`,
        message: `This ${kindLabel} JSON does not match the expected contract yet.`,
        previewData: null,
        validatedInput: null,
      };
    case "imported":
      return {
        phase,
        tone: "success",
        title: `${kindTitle} draft refreshed`,
        message: `Imported ${kindLabel} JSON loaded into the current draft.`,
        previewData: null,
        validatedInput: null,
      };
    case "idle":
    default:
      return {
        phase: "idle",
        tone: "neutral",
        title: `Paste ${kindTitle} JSON`,
        message: "Paste raw JSON or upload a file. Preview it here, or load it directly and this panel will validate before replacing the draft.",
        previewData: null,
        validatedInput: null,
      };
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}
