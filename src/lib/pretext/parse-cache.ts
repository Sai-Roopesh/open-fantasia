import { parseMarkdownLite, type RichTextBlock } from "@/lib/pretext/markdown-lite";

/**
 * Memoized wrapper around the pure {@link parseMarkdownLite}. Committed message
 * strings are stable, so they parse once and hit the cache forever after. The
 * live streaming message produces a new (growing) string each throttled frame —
 * those intermediate entries are evicted FIFO and the final string still resolves
 * to a cache hit once the turn commits. The parser itself is untouched, so its
 * unit tests stay valid.
 */
const CACHE_LIMIT = 500;
const cache = new Map<string, RichTextBlock[]>();

export function parseMarkdownLiteCached(text: string): RichTextBlock[] {
  const cached = cache.get(text);
  if (cached) {
    return cached;
  }

  const blocks = parseMarkdownLite(text);
  cache.set(text, blocks);

  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }

  return blocks;
}
