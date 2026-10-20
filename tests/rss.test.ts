import { describe, expect, it } from 'vitest';
import {
  dedupeFeedArticles,
  parseFeedPayload,
  parseFeedSnapshot,
  parseFeedXml,
  snapshotFromFeed,
} from '../src/services/rss/parse';
import type { FeedArticle } from '../src/types';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example &amp; News</title>
    <link>https://example.com/</link>
    <item>
      <title>First &lt;b&gt;headline&lt;/b&gt;</title>
      <link>https://example.com/story-one?utm_source=rss</link>
      <pubDate>Tue, 20 Oct 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[<p>A <strong>summary</strong> of the story.</p>]]></description>
    </item>
    <item>
      <title>Second headline</title>
      <link>https://example.com/story-two</link>
      <pubDate>Tue, 20 Oct 2026 09:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Unsafe link</title>
      <link>javascript:alert(1)</link>
      <pubDate>Tue, 20 Oct 2026 08:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Example</title>
  <link rel="alternate" href="https://atom.example.com/"/>
  <updated>2026-10-20T11:00:00Z</updated>
  <entry>
    <title>Atom story</title>
    <link rel="alternate" href="https://atom.example.com/story"/>
    <updated>2026-10-20T11:00:00Z</updated>
    <summary>Atom summary text</summary>
  </entry>
</feed>`;

describe('parseFeedXml', () => {
  it('parses RSS safely, stripping HTML and tracking parameters', () => {
    const parsed = parseFeedXml(RSS, 'https://example.com/rss');
    expect(parsed.title).toBe('Example & News');
    expect(parsed.articles).toHaveLength(2);
    expect(parsed.articles[0].title).toBe('First headline');
    expect(parsed.articles[0].link).toBe('https://example.com/story-one');
    expect(parsed.articles[0].summary).toBe('A summary of the story.');
    expect(parsed.articles[0].publishedAt).toBe('2026-10-20T10:00:00.000Z');
  });

  it('rejects unsafe article links', () => {
    const parsed = parseFeedXml(RSS, 'https://example.com/rss');
    expect(parsed.articles.some((article) => article.link.startsWith('javascript:'))).toBe(false);
  });

  it('parses Atom entries and alternate links', () => {
    const parsed = parseFeedXml(ATOM, 'https://atom.example.com/feed');
    expect(parsed.title).toBe('Atom Example');
    expect(parsed.link).toBe('https://atom.example.com/');
    expect(parsed.articles).toHaveLength(1);
    expect(parsed.articles[0].link).toBe('https://atom.example.com/story');
    expect(parsed.articles[0].source).toBe('Atom Example');
  });

  it('throws on malformed XML', () => {
    expect(() => parseFeedXml('<rss><channel>', 'https://example.com/rss')).toThrow();
  });
});

describe('parseFeedPayload', () => {
  it('detects JSON snapshots by content type', () => {
    const parsed = parseFeedPayload(
      JSON.stringify({
        feed: { title: 'Snapshot', url: 'https://example.com/feed' },
        articles: [
          {
            title: 'Snapshot story',
            link: 'https://example.com/snapshot',
            source: 'Snapshot',
            publishedAt: '2026-10-20T10:00:00Z',
          },
        ],
      }),
      'https://example.com/feed',
      'Fallback',
      'application/json',
    );
    expect(parsed.title).toBe('Snapshot');
    expect(parsed.articles[0].title).toBe('Snapshot story');
  });

  it('detects JSON snapshots by a leading brace', () => {
    const parsed = parseFeedPayload(
      '{"articles":[]}',
      'https://example.com/feed',
      'Fallback',
      'text/plain',
    );
    expect(parsed.title).toBe('Fallback');
    expect(parsed.articles).toEqual([]);
  });

  it('reports unparseable JSON', () => {
    expect(() =>
      parseFeedPayload('{oops', 'https://example.com/feed', 'Fallback', 'application/json'),
    ).toThrow(/JSON/);
  });
});

describe('parseFeedSnapshot', () => {
  it('drops unknown fields and unsafe links', () => {
    const parsed = parseFeedSnapshot(
      {
        feed: { title: 'Snapshot &amp; Feed', link: 'https://example.com/' },
        updatedAt: '2026-10-20T12:00:00Z',
        unexpected: true,
        articles: [
          {
            title: 'Valid',
            link: 'https://example.com/valid',
            source: 'Snapshot',
            publishedAt: '2026-10-20T10:00:00Z',
          },
          { title: 'Bad', link: 'javascript:alert(1)' },
        ],
      },
      'https://example.com/feed',
      'Fallback',
    );
    expect(parsed.title).toBe('Snapshot & Feed');
    expect(parsed.link).toBe('https://example.com/');
    expect(parsed.articles).toHaveLength(1);
    expect(parsed.articles[0].title).toBe('Valid');
  });

  it('rejects non-object input', () => {
    expect(() => parseFeedSnapshot('nope', 'https://example.com', 'Feed')).toThrow();
  });
});

describe('dedupeFeedArticles', () => {
  it('removes duplicate URLs and normalised titles', () => {
    const articles: FeedArticle[] = [
      {
        id: '1',
        title: 'Headline One',
        link: 'https://example.com/a?utm_source=x',
        source: 'Example',
        publishedAt: '2026-10-20T09:00:00Z',
      },
      {
        id: '2',
        title: 'Headline One!',
        link: 'https://example.com/b',
        source: 'Example',
        publishedAt: '2026-10-20T10:00:00Z',
      },
      {
        id: '3',
        title: 'Unique',
        link: 'https://example.com/c',
        source: 'Example',
        publishedAt: '2026-10-20T11:00:00Z',
      },
    ];
    const deduped = dedupeFeedArticles(articles);
    expect(deduped.map((article) => article.id)).toEqual(['3', '1']);
  });
});

describe('snapshotFromFeed', () => {
  it('wraps a parsed feed in the bundled snapshot shape', () => {
    const parsed = parseFeedXml(ATOM, 'https://atom.example.com/feed');
    const snapshot = snapshotFromFeed(parsed, 'https://atom.example.com/feed');
    expect(snapshot.version).toBe(1);
    expect(snapshot.feed.title).toBe('Atom Example');
    expect(snapshot.feed.url).toBe('https://atom.example.com/feed');
    expect(snapshot.articles).toHaveLength(1);
  });
});
