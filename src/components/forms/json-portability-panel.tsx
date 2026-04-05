"use client";

import { useId, useMemo, useState } from "react";
import { Braces, Copy, Download, FileUp, Sparkles, Upload } from "lucide-react";
import {
  buildPromptPack,
  documentToJson,
  parsePortableDocument,
  promptPackFilename,
  schemaFilename,
  templateFilename,
  type OpenFantasiaCharacterData,
  type OpenFantasiaPersonaData,
  openFantasiaCharacterJsonSchema,
  openFantasiaPersonaJsonSchema,
} from "@/lib/portability/openfantasia-json";
import { cn } from "@/lib/utils";

type CharacterPreviewData = OpenFantasiaCharacterData;
type PersonaPreviewData = OpenFantasiaPersonaData;

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
  const [rawImport, setRawImport] = useState("");
  const [status, setStatus] = useState<{
    tone: "neutral" | "success" | "error";
    message: string;
  }>({
    tone: "neutral",
    message:
      "Export a strict Open-Fantasia JSON document, hand it to any model you like, then import the validated JSON back into this draft.",
  });
  const [previewData, setPreviewData] = useState<
    CharacterPreviewData | PersonaPreviewData | null
  >(null);

  const kindLabel = props.kind === "character" ? "character" : "persona";
  const blankDocument = useMemo(
    () =>
      props.kind === "character"
        ? {
            format: "openfantasia.character" as const,
            version: 1 as const,
            data: {
              name: "",
              tagline: "",
              short_description: "",
              long_description: "",
              greeting: "",
              core_persona: "",
              style_rules: "",
              scenario_seed: "",
              definition: "",
              negative_guidance: "",
              author_notes: "",
              suggested_starters: [],
              example_conversations: [],
            },
          }
        : {
            format: "openfantasia.persona" as const,
            version: 1 as const,
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
      version: 1 as const,
      data: props.currentData,
    }),
    [props.currentData, props.kind],
  );
  const schema = props.kind === "character"
    ? openFantasiaCharacterJsonSchema
    : openFantasiaPersonaJsonSchema;

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus({
        tone: "success",
        message: `${label} copied. Paste it into any model you want and ask for raw JSON back.`,
      });
    } catch {
      setStatus({
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
    setStatus({
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
    setStatus({
      tone: "success",
      message: `${filename} downloaded.`,
    });
  }

  function parseImport(value: string) {
    try {
      const parsed =
        props.kind === "character"
          ? parsePortableDocument("character", value).data
          : parsePortableDocument("persona", value).data;

      setPreviewData(parsed);
      setStatus({
        tone: "success",
        message: `Valid ${kindLabel} JSON detected. Review the preview, then load it into this draft.`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `That ${kindLabel} JSON could not be parsed.`;
      setPreviewData(null);
      setStatus({
        tone: "error",
        message,
      });
    }
  }

  return (
    <section className="rounded-[1.8rem] border border-border bg-white/72 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">Import and export</p>
          <h3 className="mt-2 font-serif text-3xl text-foreground">
            Build with external models, save with strict JSON
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-soft">
            Export a blank template or your current draft, hand it to Claude, Gemini, or any
            other model, then import the validated Open-Fantasia JSON back into this editor.
          </p>
        </div>
        <div className="rounded-[1.3rem] border border-border bg-paper px-4 py-3 text-xs leading-6 text-ink-soft">
          Strict contract only.
          <br />
          Extra keys and malformed shapes are rejected.
        </div>
      </div>

      <div aria-live="polite" className="mt-5 rounded-[1.4rem] bg-paper px-4 py-3 text-sm leading-7 text-foreground">
        {status.message}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-[1.5rem] border border-border bg-paper p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">JSON artifacts</p>
          <div className="mt-4 flex flex-wrap gap-2">
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

        <div className="rounded-[1.5rem] border border-border bg-paper p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Prompt packs</p>
          <div className="mt-4 flex flex-wrap gap-2">
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

      <div className="mt-5 rounded-[1.5rem] border border-border bg-paper p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Import JSON</p>
            <p className="mt-2 text-sm leading-7 text-ink-soft">
              Paste raw JSON or upload a file. Markdown code fences are okay; extra keys are not.
            </p>
          </div>
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
          >
            <Upload className="h-4 w-4" />
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
              setRawImport(text);
              parseImport(text);
            }}
          />
        </div>

        <textarea
          rows={10}
          value={rawImport}
          onChange={(event) => setRawImport(event.target.value)}
          placeholder={`Paste openfantasia.${props.kind} JSON here...`}
          className="mt-4 w-full rounded-[1.5rem] border border-border bg-white px-4 py-4 text-sm leading-7 outline-none transition focus:border-brand"
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <PanelActionButton
            icon={FileUp}
            onClick={() => parseImport(rawImport)}
          >
            Validate import
          </PanelActionButton>
          <button
            type="button"
            disabled={!previewData}
            onClick={() => {
              if (!previewData) return;
              if (props.kind === "character") {
                props.onImport(previewData as CharacterPreviewData);
              } else {
                props.onImport(previewData as PersonaPreviewData);
              }
              setStatus({
                tone: "success",
                message: `Imported ${kindLabel} JSON loaded into the current draft. Review it, then save when it feels right.`,
              });
            }}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              previewData
                ? "bg-brand text-white hover:bg-brand-strong"
                : "cursor-not-allowed bg-[#e9dfd4] text-ink-soft",
            )}
          >
            Load into draft
          </button>
        </div>

        {previewData ? (
          <div className="mt-5 rounded-[1.4rem] border border-border bg-white px-4 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Import preview</p>
            <div className="mt-3 space-y-2 text-sm leading-7 text-foreground">
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
  onClick,
}: {
  children: React.ReactNode;
  icon: typeof Download;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}
