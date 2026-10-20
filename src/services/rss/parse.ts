import type { FeedArticle, FeedSnapshot } from '../../types';
import { cleanHeadline, normaliseTitle } from '../../utils/text';
import { safeHttpUrl, truncate } from '../../utils/url';

export interface ParsedFeed {
  title: string;
  link?: string;
  articles: FeedArticle[];
  updatedAt: string;
}

function hash(input: string): string {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

function childText(element: Element, names: string[]): string {
  for (const child of Array.from(element.children)) {
    const local = child.localName.toLowerCase();
    if (names.includes(local)) {
      const text = child.textContent?.trim();
      if (text) return text;
    }
  }
  return '';
}

function childElement(element: Element, names: string[]): Element | undefined {
  return Array.from(element.children).find((child) =>
    names.includes(child.localName.toLowerCase()),
  );
}

function atomLink(entry: Element): string {
  const links = Array.from(entry.children).filter(
    (child) => child.localName.toLowerCase() === 'link',
  );
  const alternate =
    links.find((link) => {
      const rel = link.getAttribute('rel');
      return (!rel || rel === 'alternate') && link.getAttribute('href');
    }) ?? links.find((link) => link.getAttribute('href'));
  return alternate?.getAttribute('href')?.trim() ?? '';
}

function findDate(element: Element): string {
  const text = childText(element, [
    'pubdate',
    'published',
    'updated',
    'date',
    'dc:date',
    'issued',
    'created',
  ]);
  if (!text) return new Date().toISOString();
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normaliseArticle(
  titleRaw: string,
  linkRaw: string,
  source: string,
  dateRaw: string,
  summaryRaw: string,
): FeedArticle | null {
  const title = cleanHeadline(titleRaw);
  if (!title) return null;
  let link = safeHttpUrl(linkRaw);
  if (!link) return null;
  // Strip common tracking fragments but keep real query strings.
  try {
    const url = new URL(link);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'at_medium', 'at_campaign'].forEach(
      (key) => url.searchParams.delete(key),
    );
    link = url.toString();
  } catch {
    return null;
  }
  const published = new Date(dateRaw);
  return {
    id: `feed-${hash(`${link}|${title}`)}`,
    title,
    link,
    source,
    publishedAt: Number.isNaN(published.getTime())
      ? new Date().toISOString()
      : published.toISOString(),
    summary: summaryRaw ? truncate(cleanHeadline(summaryRaw), 260) : undefined,
  };
}

export function dedupeFeedArticles(articles: FeedArticle[]): FeedArticle[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  return articles
    .filter((article) => {
      const urlKey = article.link.replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();
      const titleKey = normaliseTitle(article.title);
      if (!urlKey || seenUrls.has(urlKey) || seenTitles.has(titleKey)) return false;
      seenUrls.add(urlKey);
      seenTitles.add(titleKey);
      return true;
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function parseFeedXml(xml: string, feedUrl: string, fallbackTitle = 'Feed'): ParsedFeed {
  if (typeof DOMParser === 'undefined') {
    throw new Error('XML parsing is not available in this browser.');
  }
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) throw new Error('The feed returned invalid XML.');

  const root = doc.documentElement;
  if (!root) throw new Error('The feed is empty.');

  const isAtom = root.localName.toLowerCase() === 'feed';
  const channel = isAtom ? root : doc.getElementsByTagName('channel')[0] ?? root;
  const title =
    cleanHeadline(childText(isAtom ? root : channel, ['title'])) || fallbackTitle || 'Feed';
  const link = isAtom
    ? atomLink(root)
    : cleanHeadline(childText(channel, ['link'])) || '';

  const entries = isAtom
    ? Array.from(root.children).filter((child) => child.localName.toLowerCase() === 'entry')
    : Array.from(doc.getElementsByTagName('item'));

  const articles = entries
    .map((entry) => {
      const entryTitle = childText(entry, ['title']);
      const entryLink = isAtom
        ? atomLink(entry)
        : childText(entry, ['link']) ||
          childText(entry, ['guid']) ||
          childText(entry, ['id']);
      const date = findDate(entry);
      const summaryElement = childElement(entry, ['description', 'summary', 'content', 'encoded']);
      const summary = summaryElement?.textContent ?? '';
      return normaliseArticle(entryTitle, entryLink, title, date, summary);
    })
    .filter((article): article is FeedArticle => article !== null);

  return {
    title,
    link: safeHttpUrl(link) ?? feedUrl,
    articles: dedupeFeedArticles(articles).slice(0, 80),
    updatedAt: new Date().toISOString(),
  };
}

export function parseFeedSnapshot(raw: unknown, fallbackUrl: string, fallbackTitle: string): ParsedFeed {
  if (typeof raw !== 'object' || raw === null) throw new Error('The feed snapshot is invalid.');
  const record = raw as Record<string, unknown>;
  const feed = typeof record.feed === 'object' && record.feed !== null
    ? (record.feed as Record<string, unknown>)
    : {};
  const title =
    typeof feed.title === 'string' && feed.title.trim()
      ? cleanHeadline(feed.title)
      : fallbackTitle;
  const articles = Array.isArray(record.articles)
    ? record.articles
        .map((item): FeedArticle | null => {
          if (typeof item !== 'object' || item === null) return null;
          const entry = item as Record<string, unknown>;
          const articleTitle = typeof entry.title === 'string' ? entry.title : '';
          const link = typeof entry.link === 'string' ? entry.link : '';
          const source = typeof entry.source === 'string' ? entry.source : title;
          const publishedAt =
            typeof entry.publishedAt === 'string' ? entry.publishedAt : new Date().toISOString();
          const summary = typeof entry.summary === 'string' ? entry.summary : '';
          const normalised = normaliseArticle(articleTitle, link, source, publishedAt, summary);
          return normalised
            ? { ...normalised, id: typeof entry.id === 'string' ? entry.id.slice(0, 80) : normalised.id }
            : null;
        })
        .filter((article): article is FeedArticle => article !== null)
    : [];
  return {
    title,
    link: typeof feed.link === 'string' ? safeHttpUrl(feed.link) ?? fallbackUrl : fallbackUrl,
    articles: dedupeFeedArticles(articles).slice(0, 80),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString(),
  };
}

export function parseFeedPayload(
  payload: string,
  feedUrl: string,
  fallbackTitle: string,
  contentType = '',
): ParsedFeed {
  const trimmed = payload.trim();
  const looksJson =
    contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  if (looksJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('The feed JSON could not be parsed.');
    }
    return parseFeedSnapshot(parsed, feedUrl, fallbackTitle);
  }
  return parseFeedXml(trimmed, feedUrl, fallbackTitle);
}

export function snapshotFromFeed(
  parsed: ParsedFeed,
  feedUrl: string,
): FeedSnapshot {
  return {
    version: 1,
    updatedAt: parsed.updatedAt,
    feed: { title: parsed.title, url: feedUrl, link: parsed.link },
    articles: parsed.articles,
  };
}
