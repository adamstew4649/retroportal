import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ExternalLink,
  Plus,
  RefreshCw,
  Rss,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useWidgetSettings } from '../../state/PortalContext';
import { useToast } from '../../state/ToastContext';
import { fetchFeed, resolveFeedUrl, type FeedResult } from '../../services/rss/client';
import { createId } from '../../utils/id';
import { safeHttpUrlWithHttpsFallback } from '../../utils/url';
import type { FeedArticle, RssFeed } from '../../types';
import { formatTickerTime } from '../../utils/date';
import '../widgets.css';

interface ArticleWithFeed extends FeedArticle {
  feedTitle: string;
  feedId: string;
}

export function RssWidget() {
  const [settings] = useWidgetSettings('rss');
  const [results, setResults] = useState<FeedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const controllers = useRef<AbortController[]>([]);

  const feedSignature = settings.feeds.map((feed) => `${feed.id}:${feed.url}`).join('|');

  const load = useCallback(async () => {
    controllers.current.forEach((controller) => controller.abort());
    controllers.current = settings.feeds.map(() => new AbortController());
    setLoading(true);
    const next = await Promise.all(
      settings.feeds.map((feed, index) =>
        fetchFeed(feed, controllers.current[index]?.signal).catch((error: unknown) => ({
          feed,
          error: error instanceof Error ? error.message : 'The feed could not be loaded.',
          fetchedAt: Date.now(),
        })),
      ),
    );
    if (!mounted.current) return;
    setResults(next);
    setLoading(false);
  }, [settings.feeds]);

  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 15 * 60_000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      controllers.current.forEach((controller) => controller.abort());
    };
  }, [load, feedSignature]);

  const articles = useMemo<ArticleWithFeed[]>(() => {
    const list: ArticleWithFeed[] = [];
    for (const result of results) {
      if (!result.parsed) continue;
      for (const article of result.parsed.articles) {
        list.push({
          ...article,
          feedTitle: result.parsed.title || result.feed.name,
          feedId: result.feed.id,
        });
      }
    }
    return list
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, settings.limit);
  }, [results, settings.limit]);

  if (loading && articles.length === 0) {
    return (
      <div className="rss-widget" aria-busy="true">
        <div className="loading-skeleton skeleton-line" />
        <div className="loading-skeleton skeleton-line" />
        <div className="loading-skeleton skeleton-line" />
        <div className="loading-skeleton skeleton-line" />
      </div>
    );
  }

  const errors = results.filter((result) => result.error);

  return (
    <div className="rss-widget">
      <div className="rss-toolbar">
        <span className="status-pill">
          <span className={`status-dot${errors.length ? ' status-dot--stale' : ''}`} />
          {settings.feeds.length} feed{settings.feeds.length === 1 ? '' : 's'} · {articles.length} items
        </span>
        <button type="button" className="icon-button" onClick={() => void load()} aria-label="Refresh RSS feeds">
          <RefreshCw size={12} className={loading ? 'spin' : undefined} aria-hidden="true" />
        </button>
      </div>

      {errors.length > 0 && (
        <details className="rss-errors">
          <summary>
            {errors.length} feed{errors.length === 1 ? '' : 's'} could not be refreshed
          </summary>
          {errors.map((result) => (
            <p className="error-note" key={result.feed.id}>
              <TriangleAlert size={12} aria-hidden="true" />
              <span>
                <strong>{result.feed.name}:</strong> {result.error}
                {result.fromCache ? ' Showing cached articles.' : ''}
              </span>
            </p>
          ))}
        </details>
      )}

      {articles.length === 0 ? (
        <div className="empty-state">
          <Rss size={18} aria-hidden="true" />
          <p>
            {settings.feeds.length === 0
              ? 'Add an RSS feed in this widget’s settings.'
              : loading
                ? 'Loading feed items…'
                : 'No articles are available right now.'}
          </p>
        </div>
      ) : (
        <ul className="rss-list">
          {articles.map((article) => (
            <li key={`${article.feedId}-${article.id}`} className="rss-item">
              <a href={article.link} target="_blank" rel="noopener noreferrer">
                <span className="rss-item__title">{article.title}</span>
                <span className="rss-item__meta">
                  <span>{article.feedTitle}</span>
                  <span>{formatTickerTime(article.publishedAt)}</span>
                  <ExternalLink size={9} aria-hidden="true" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="rss-widget__footnote">
        Bundled UK snapshots update with the site. Custom feeds load directly from the publisher when
        their server permits cross-origin requests.
      </p>
    </div>
  );
}

export function RssSettings() {
  const [settings, update] = useWidgetSettings('rss');
  const { notify } = useToast();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const addFeed = () => {
    const trimmedName = name.trim();
    const safe = safeHttpUrlWithHttpsFallback(url);
    if (!trimmedName) {
      setError('Give the feed a name.');
      return;
    }
    if (!safe) {
      setError('Enter a valid RSS or Atom feed URL (http:// or https://).');
      return;
    }
    if (settings.feeds.some((feed) => feed.url === safe)) {
      setError('That feed has already been added.');
      return;
    }
    const feed: RssFeed = { id: createId('feed'), name: trimmedName.slice(0, 80), url: safe };
    update({ feeds: [...settings.feeds, feed] });
    setName('');
    setUrl('');
    setError(null);
    notify('RSS feed added.', 'success');
  };

  const removeFeed = (id: string) => {
    update({ feeds: settings.feeds.filter((feed) => feed.id !== id) });
  };

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all(settings.feeds.map((feed) => fetchFeed(feed)));
      notify('RSS feeds refreshed. Cached items remain available if a feed is blocked.', 'success');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="form-stack">
      <ul className="rss-feed-list">
        {settings.feeds.map((feed) => (
          <li key={feed.id}>
            <div className="rss-feed-list__info">
              <span className="rss-feed-list__name">
                {feed.name}
                {feed.bundled && <span className="chip chip--accent">snapshot</span>}
              </span>
              <span className="rss-feed-list__url" title={feed.sourceUrl ?? feed.url}>
                {feed.sourceUrl ? resolveFeedUrl(feed.url) : feed.url}
              </span>
            </div>
            <button
              type="button"
              className="icon-button icon-button--danger"
              onClick={() => removeFeed(feed.id)}
              aria-label={`Remove ${feed.name}`}
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </li>
        ))}
        {settings.feeds.length === 0 && <li className="text-small text-muted">No feeds yet.</li>}
      </ul>

      <hr className="retro-divider" />

      <div className="form-grid">
        <label>
          <span className="field-label">Feed name</span>
          <input
            className="retro-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="e.g. Hacker News"
          />
        </label>
        <label>
          <span className="field-label">Feed URL</span>
          <input
            className="retro-field"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/feed.xml"
            inputMode="url"
          />
        </label>
      </div>
      <div className="field-row">
        <button type="button" className="mini-button" onClick={addFeed}>
          <Plus size={12} aria-hidden="true" /> Add feed
        </button>
        <button
          type="button"
          className="mini-button"
          onClick={() => void refreshAll()}
          disabled={refreshing || settings.feeds.length === 0}
        >
          <RefreshCw size={12} className={refreshing ? 'spin' : undefined} aria-hidden="true" /> Test feeds
        </button>
      </div>

      {error && <p className="error-note" role="alert">{error}</p>}

      <label>
        <span className="field-label">Articles shown: {settings.limit}</span>
        <input
          className="retro-range"
          type="range"
          min={3}
          max={30}
          value={settings.limit}
          onChange={(event) => update({ limit: Number(event.target.value) })}
        />
      </label>

      <label className="retro-check">
        <input
          type="checkbox"
          checked={settings.tall}
          onChange={(event) => update({ tall: event.target.checked })}
        />
        Taller feed list
      </label>

      <p className="info-note">
        Browsers cannot read most third-party RSS feeds directly because publishers do not send CORS
        headers. The three UK snapshots are generated during deployment; custom feeds work when the
        publisher allows cross-origin requests, and otherwise show a clear error plus cached items.
      </p>
    </div>
  );
}

export function feedHostLabel(feed: RssFeed): string {
  try {
    return new URL(feed.sourceUrl ?? feed.url).hostname.replace(/^www\./, '');
  } catch {
    return feed.name;
  }
}
