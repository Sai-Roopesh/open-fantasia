import {
  layoutWithLines,
  prepareWithSegments,
  walkLineRanges,
  type LayoutCursor,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";
import type { InlineMark, RichTextBlock } from "@/lib/pretext/markdown-lite";

export type StyledRun = {
  text: string;
  bold: boolean;
  italic: boolean;
};

export type RenderedLine = {
  text: string;
  width: number;
  runs: StyledRun[];
};

export type RenderedBlock = {
  kind: RichTextBlock["kind"];
  width: number;
  height: number;
  lines: RenderedLine[];
};

export type RenderedMessageLayout = {
  bubbleWidth: number;
  bubbleHeight: number;
  blocks: RenderedBlock[];
};

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function buildGraphemeOffsets(text: string) {
  const offsets = [0];
  let total = 0;
  for (const segment of segmenter.segment(text)) {
    total += segment.segment.length;
    offsets.push(total);
  }
  return offsets;
}

function buildCursorHelpers(prepared: PreparedTextWithSegments) {
  const segmentStarts: number[] = [];
  const graphemeOffsets = prepared.segments.map((segment) =>
    buildGraphemeOffsets(segment),
  );

  let total = 0;
  for (const segment of prepared.segments) {
    segmentStarts.push(total);
    total += segment.length;
  }

  const cursorToOffset = (cursor: LayoutCursor) => {
    if (cursor.segmentIndex >= prepared.segments.length) {
      return total;
    }

    const offsets = graphemeOffsets[cursor.segmentIndex] ?? [0];
    return segmentStarts[cursor.segmentIndex] + (offsets[cursor.graphemeIndex] ?? 0);
  };

  return { cursorToOffset };
}

function sliceRuns(
  text: string,
  marks: InlineMark[],
  start: number,
  end: number,
): StyledRun[] {
  if (end <= start) return [];

  const boundaries = new Set<number>([start, end]);
  for (const mark of marks) {
    const overlapStart = Math.max(start, mark.start);
    const overlapEnd = Math.min(end, mark.end);
    if (overlapEnd > overlapStart) {
      boundaries.add(overlapStart);
      boundaries.add(overlapEnd);
    }
  }

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  const runs: StyledRun[] = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const runStart = sorted[index];
    const runEnd = sorted[index + 1];
    const runText = text.slice(runStart, runEnd);
    if (!runText) continue;

    const activeMarks = marks.filter(
      (mark) => mark.start <= runStart && mark.end >= runEnd,
    );

    runs.push({
      text: runText,
      bold: activeMarks.some((mark) => mark.bold),
      italic: activeMarks.some((mark) => mark.italic),
    });
  }

  return runs;
}

function layoutBlock(
  block: RichTextBlock,
  font: string,
  maxTextWidth: number,
  lineHeight: number,
): RenderedBlock {
  if (block.kind === "separator") {
    return {
      kind: "separator",
      width: 120,
      height: 20,
      lines: [],
    };
  }

  const prepared = prepareWithSegments(block.text || " ", font, {
    whiteSpace: "pre-wrap",
  });
  const { cursorToOffset } = buildCursorHelpers(prepared);
  const laidOut = layoutWithLines(prepared, maxTextWidth, lineHeight);

  let maxLineWidth = 0;
  walkLineRanges(prepared, maxTextWidth, (line) => {
    maxLineWidth = Math.max(maxLineWidth, line.width);
  });

  return {
    kind: block.kind,
    width: Math.max(maxLineWidth, 0),
    height: laidOut.height,
    lines: laidOut.lines.map((line) => {
      const start = cursorToOffset(line.start);
      const end = cursorToOffset(line.end);
      return {
        text: line.text,
        width: line.width,
        runs: sliceRuns(block.text, block.marks, start, end),
      };
    }),
  };
}

export function layoutRichMessage(args: {
  blocks: RichTextBlock[];
  font: string;
  maxBubbleWidth: number;
  lineHeight: number;
}) {
  const paddingX = 22;
  const paddingY = 18;
  const blockGap = 12;
  const textWidth = Math.max(args.maxBubbleWidth - paddingX * 2, 140);

  const renderedBlocks = args.blocks.map((block) =>
    layoutBlock(block, args.font, textWidth, args.lineHeight),
  );

  const contentWidth = renderedBlocks.reduce(
    (max, block) => Math.max(max, block.width + (block.kind === "quote" ? 14 : 0)),
    0,
  );
  const contentHeight = renderedBlocks.reduce((sum, block) => sum + block.height, 0);
  const totalGap = Math.max(0, renderedBlocks.length - 1) * blockGap;

  return {
    blocks: renderedBlocks,
    bubbleWidth: Math.min(args.maxBubbleWidth, contentWidth + paddingX * 2),
    bubbleHeight: contentHeight + totalGap + paddingY * 2,
  } satisfies RenderedMessageLayout;
}
