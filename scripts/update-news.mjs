#!/usr/bin/env node
/**
 * RetroPortal news aggregator.
 *
 * Fetches public RSS/Atom feeds, normalises and de-duplicates articles, writes
 * public/data/news.json for the homepage and per-feed snapshots for the RSS
 * widget. It never invents headlines: if a feed fails, its existing snapshot is
 * left untouched and its status is recorded in the dataset.
 */
import { XMLParser } from 'fast-xml-parser';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'public', 'data');
const feedsDir = join(dataDir, 'feeds');

const FEEDS = [
  { id: 'bbc-uk', name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/uk/rss.xml', category: 'uk', snapshot: true },
  { id: 'guardian-uk', name: 'The Guardian', url: 'https://www.theguardian.com/uk/rss', category: 'uk', snapshot: true },
  { id: 'sky-uk', name: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/uk.xml', category: 'uk', snapshot: true },

  { id: 'bbc-world', name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'world' },
  { id: 'bbc-technology', name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'technology' },
  { id: 'bbc-business', name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: 'business' },
  { id: 'bbc-science', name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', category: 'science' },

  { id: 'guardian-world', name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', category: 'world' },
  { id: 'guardian-technology', name: 'The Guardian', url: 'https://www.theguardian.com/uk/technology/rss', category: 'technology' },
  { id: 'guardian-business', name: 'The Guardian', url: 'https://www.theguardian.com/uk/business/rss', category: 'business' },
  { id: 'guardian-science', name: 'The Guardian', url: 'https://www.theguardian.com/science/rss', category: 'science' },

  { id: 'sky-world', name: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/world.xml', category: 'world' },
  { id: 'sky-technology', name: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/technology.xml', category: 'technology' },
  { id: 'sky-business', name: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/business.xml', category: 'business' },
];

const MAX_PER_FEED = 18;
const MAX_TOTAL = 180;
const FETCH_TIMEOUT_MS = 20_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '#cdata',
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
});

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

function decodeEntities(input) {
  return String(input)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

function stripHtml(input) {
  return decodeEntities(
    String(input)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHeadline(input) {
  return stripHtml(input).replace(/\s+/g, ' ').trim();
}

function normaliseTitle(input) {
  return cleanHeadline(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function textOf(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = textOf(item);
      if (text) return text;
    }
    return '';
  }
  if (typeof value === 'object') {
    if (value['#cdata']) return textOf(value['#cdata']);
    if (value['#text']) return textOf(value['#text']);
    if (value['@_href']) return textOf(value['@_href']);
  }
  return '';
}

function resolver(feedUrl) {
  return (value) => {
    const raw = textOf(value).trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, feedUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'at_medium', 'at_campaign'].forEach(
        (key) => url.searchParams.delete(key),
      );
      return url.toString();
    } catch {
      return '';
    }
  };
}

function arrayOf(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function linkOf(item, resolve) {
  if (Array.isArray(item.link)) {
    const alternate =
      item.link.find((link) => link && typeof link === 'object' && (!link['@_rel'] || link['@_rel'] === 'alternate')) ??
      item.link[0];
    return resolve(alternate);
  }
  return resolve(item.link) || resolve(item.guid) || resolve(item.id);
}

function dateOf(item, fallback) {
  const candidate =
    textOf(item.pubDate) ||
    textOf(item.published) ||
    textOf(item.updated) ||
    textOf(item.date) ||
    textOf(item['dc:date']);
  if (!candidate) return fallback;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function hash(input) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

function parseFeed(xml, feed) {
  const parsed = parser.parse(xml);
  const rss = parsed.rss;
  const rdf = parsed['rdf:RDF'];
  const atom = parsed.feed;
  const channel = rss?.channel ?? rdf?.channel ?? null;
  const isAtom = Boolean(atom);
  const entries = isAtom
    ? arrayOf(atom.entry)
    : arrayOf(rss?.channel?.item ?? rdf?.item);
  const feedTitle = cleanHeadline(
    textOf(channel?.title) || textOf(atom?.title) || feed.name,
  );
  const resolve = resolver(feed.url);
  const fetchFallback = new Date().toISOString();

  const articles = entries
    .map((entry) => {
      const title = cleanHeadline(textOf(entry.title));
      const link = linkOf(entry, resolve);
      if (!title || !link) return null;
      const publishedAt = dateOf(entry, fetchFallback);
      const summaryRaw =
        textOf(entry.description) ||
        textOf(entry.summary) ||
        textOf(entry['content:encoded']) ||
        textOf(entry.content) ||
        '';
      const summary = cleanHeadline(summaryRaw).slice(0, 260);
      return {
        id: `feed-${hash(`${link}|${title}`)}`,
        title,
        link,
        source: feed.name,
        publishedAt,
        category: feed.category,
        summary: summary || undefined,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, MAX_PER_FEED);

  return {
    title: feedTitle,
    link: resolve(textOf(channel?.link) || textOf(atom?.link)) || feed.url,
    articles,
  };
}

async function fetchFeed(feed) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'RetroPortalNewsBot/1.0 (+https://github.com/) RSS aggregation for a personal start page',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    const parsed = parseFeed(body, feed);
    if (parsed.articles.length === 0) throw new Error('No readable articles');
    return { ...parsed, ok: true };
  } finally {
    clearTimeout(timer);
  }
}

async function readPrevious(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(feedsDir, { recursive: true });

  const settled = await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const parsed = await fetchFeed(feed);
        console.log(`✓ ${feed.id.padEnd(20)} ${parsed.articles.length} articles`);
        return { feed, parsed, error: null };
      } catch (error) {
        console.error(`✗ ${feed.id.padEnd(20)} ${error instanceof Error ? error.message : error}`);
        return { feed, parsed: null, error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );

  const successful = settled.filter((item) => item.parsed);
  if (successful.length === 0) {
    console.error('No feeds succeeded; leaving the existing news dataset untouched.');
    process.exitCode = 1;
    return;
  }

  // Per-feed snapshots for the static RSS reader. Failed feeds keep the last
  // published snapshot instead of being overwritten with an empty file.
  for (const item of settled) {
    const snapshotPath = join(feedsDir, `${item.feed.id}.json`);
    if (item.parsed) {
      const snapshot = {
        version: 1,
        updatedAt: new Date().toISOString(),
        feed: {
          title: item.parsed.title,
          url: item.feed.url,
          link: item.parsed.link,
        },
        articles: item.parsed.articles.map((article) => ({
          id: article.id,
          title: article.title,
          link: article.link,
          source: article.source,
          publishedAt: article.publishedAt,
          summary: article.summary,
        })),
      };
      await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    } else {
      const previous = await readPrevious(snapshotPath);
      if (previous) {
        console.warn(`  keeping previous snapshot for ${item.feed.id}`);
      } else {
        console.warn(`  no previous snapshot exists for ${item.feed.id}`);
      }
    }
  }

  const seenUrls = new Set();
  const seenTitles = new Set();
  const articles = successful
    .flatMap((item) => item.parsed.articles)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .filter((article) => {
      const urlKey = article.link.replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase();
      const titleKey = normaliseTitle(article.title);
      if (!urlKey || !titleKey || seenUrls.has(urlKey) || seenTitles.has(titleKey)) return false;
      seenUrls.add(urlKey);
      seenTitles.add(titleKey);
      return true;
    })
    .slice(0, MAX_TOTAL)
    .map(({ id, title, source, url, link, publishedAt, category, summary }) => ({
      id,
      title,
      source,
      sourceUrl: successful.find((item) => item.feed.name === source)?.feed.url,
      url: url ?? link,
      publishedAt,
      category,
      summary,
    }));

  const dataset = {
    version: 1,
    updatedAt: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    feeds: settled.map((item) => ({
      id: item.feed.id,
      name: item.feed.name,
      url: item.feed.url,
      ok: Boolean(item.parsed),
      error: item.error ?? undefined,
      count: item.parsed?.articles.length ?? 0,
    })),
    articles,
  };

  const output = join(dataDir, 'news.json');
  await writeFile(output, `${JSON.stringify(dataset, null, 2)}\n`);
  console.log(
    `\nWrote ${articles.length} unique articles from ${successful.length}/${FEEDS.length} feeds to public/data/news.json`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
