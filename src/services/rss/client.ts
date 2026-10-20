import type { RssFeed } from '../../types';
import { parseFeedPayload, type ParsedFeed } from './parse';

export interface FeedResult {
  feed: RssFeed;
  parsed?: ParsedFeed;
  error?: string;
  fetchedAt: number;
  fromCache?: boolean;
}

const CACHE_PREFIX = 'retroportal:rss-cache:v1:';

function cacheKey(feed: RssFeed): string {
  let hash = 0;
  for (let index = 0; index < feed.url.length; index += 1) {
    hash = (Math.imul(hash, 31) + feed.url.charCodeAt(index)) | 0;
  }
  return `${CACHE_PREFIX}${hash.toString(36)}`;
}

function readCache(feed: RssFeed): ParsedFeed | null {
  try {
    const raw = localStorage.getItem(cacheKey(feed));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { parsed?: ParsedFeed };
    return parsed.parsed && Array.isArray(parsed.parsed.articles) ? parsed.parsed : null;
  } catch {
    return null;
  }
}

function writeCache(feed: RssFeed, parsed: ParsedFeed): void {
  try {
    localStorage.setItem(cacheKey(feed), JSON.stringify({ parsed, savedAt: Date.now() }));
  } catch {
    // Cache is best-effort.
  }
}

export function resolveFeedUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  try {
    return new URL(url, document.baseURI).toString();
  } catch {
    return url;
  }
}

export async function fetchFeed(feed: RssFeed, signal?: AbortSignal): Promise<FeedResult> {
  const timeout = new AbortController();
  const timer = window.setTimeout(() => timeout.abort(), 12_000);
  const onAbort = () => timeout.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(resolveFeedUrl(feed.url), {
      signal: timeout.signal,
      headers: {
        Accept:
          'application/rss+xml, application/atom+xml, application/json, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
      credentials: 'omit',
    });
    if (!response.ok) {
      throw new Error(`The feed returned HTTP ${response.status}.`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    const body = await response.text();
    const parsed = parseFeedPayload(body, feed.url, feed.name, contentType);
    if (parsed.articles.length === 0) {
      throw new Error('The feed contained no readable articles.');
    }
    writeCache(feed, parsed);
    return { feed, parsed, fetchedAt: Date.now() };
  } catch (error) {
    const cached = readCache(feed);
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'The feed took too long to respond.'
        : error instanceof TypeError
          ? 'The feed could not be reached. This is often caused by the publisher not allowing cross-origin browser requests.'
          : error instanceof Error
            ? error.message
            : 'The feed could not be loaded.';
    return {
      feed,
      error: message,
      parsed: cached ?? undefined,
      fetchedAt: Date.now(),
      fromCache: Boolean(cached),
    };
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
