import { NEWS_CACHE_KEY } from '../../config/defaults';
import type { NewsDataset } from '../../types';
import { validateNewsDataset } from '../storage/validate';

export interface NewsResult {
  dataset: NewsDataset | null;
  fetchedAt: number;
  error?: string;
  fromCache: boolean;
  stale: boolean;
}

export function resolveDatasetUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  try {
    return new URL(url, document.baseURI).toString();
  } catch {
    return url;
  }
}

export function readNewsCache(): NewsDataset | null {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { dataset?: unknown };
    return validateNewsDataset(parsed.dataset);
  } catch {
    return null;
  }
}

function writeNewsCache(dataset: NewsDataset): void {
  try {
    localStorage.setItem(
      NEWS_CACHE_KEY,
      JSON.stringify({ dataset, cachedAt: Date.now() }),
    );
  } catch {
    // Cache is best-effort.
  }
}

export async function fetchNewsDataset(
  url: string,
  signal?: AbortSignal,
  previous?: NewsDataset | null,
): Promise<NewsResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(resolveDatasetUrl(url), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      cache: 'no-cache',
    });
    if (!response.ok) throw new Error(`The news feed returned HTTP ${response.status}.`);
    const payload: unknown = await response.json();
    const dataset = validateNewsDataset(payload);
    if (!dataset) throw new Error('The news data was not in the expected format.');
    writeNewsCache(dataset);
    return {
      dataset,
      fetchedAt: Date.now(),
      fromCache: false,
      stale: false,
    };
  } catch (error) {
    const cached = previous ?? readNewsCache();
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'The news service took too long to respond.'
        : error instanceof Error
          ? error.message
          : 'The news service could not be reached.';
    return {
      dataset: cached,
      fetchedAt: cached ? new Date(cached.updatedAt).getTime() : Date.now(),
      error: message,
      fromCache: Boolean(cached),
      stale: Boolean(cached),
    };
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function newsAgeLabel(updatedAt: string, now = Date.now()): string {
  const time = new Date(updatedAt).getTime();
  if (Number.isNaN(time)) return 'update time unknown';
  const minutes = Math.max(0, Math.round((now - time) / 60_000));
  if (minutes < 1) return 'updated just now';
  if (minutes < 60) return `updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `updated ${hours} hr ago`;
  return `updated ${Math.round(hours / 24)} days ago`;
}
