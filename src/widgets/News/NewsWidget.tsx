import { useMemo } from 'react';
import { ExternalLink, Newspaper, RefreshCw, TriangleAlert } from 'lucide-react';
import { useWidgetSettings } from '../../state/PortalContext';
import { useNews } from '../../state/NewsContext';
import { NEWS_CATEGORY_LABELS } from '../../config/defaults';
import { formatTickerTime } from '../../utils/date';
import { newsAgeLabel } from '../../services/news/client';
import type { NewsCategory } from '../../types';
import '../widgets.css';

export function NewsWidget() {
  const [settings] = useWidgetSettings('news');
  const { articlesFor, status, error, stale, updatedAt, refresh, refreshing, sources } = useNews();

  const articles = useMemo(
    () => articlesFor(settings.categories, settings.sources).slice(0, settings.limit),
    [articlesFor, settings.categories, settings.sources, settings.limit],
  );

  if (status === 'loading' && articles.length === 0) {
    return (
      <div className="news-widget" aria-busy="true">
        <div className="loading-skeleton skeleton-line" />
        <div className="loading-skeleton skeleton-line" />
        <div className="loading-skeleton skeleton-line" />
        <div className="loading-skeleton skeleton-line" />
        <div className="loading-skeleton skeleton-line" />
      </div>
    );
  }

  return (
    <div className="news-widget">
      <div className="news-status">
        <span className="status-pill">
          <span className={`status-dot${stale ? ' status-dot--stale' : error ? ' status-dot--error' : ''}`} />
          {updatedAt ? newsAgeLabel(updatedAt) : error ? 'unavailable' : 'waiting for news'}
        </span>
        <button
          type="button"
          className="icon-button"
          onClick={() => void refresh()}
          aria-label="Refresh headlines"
          disabled={refreshing}
        >
          <RefreshCw size={12} className={refreshing ? 'spin' : undefined} aria-hidden="true" />
        </button>
      </div>

      {error && (
        <p className="error-note" role="status">
          <TriangleAlert size={13} aria-hidden="true" />
          <span>
            {error}
            {stale ? ' The headlines below are from the last successful update.' : ''}
          </span>
        </p>
      )}

      {articles.length === 0 ? (
        <div className="empty-state">
          <Newspaper size={18} aria-hidden="true" />
          <p>
            {error
              ? 'No cached headlines are available yet.'
              : 'No headlines match the selected categories and sources.'}
          </p>
        </div>
      ) : (
        <ol className="news-list">
          {articles.map((article) => (
            <li key={article.id} className="news-item">
              <a href={article.url} target="_blank" rel="noopener noreferrer">
                <span className="news-item__title">{article.title}</span>
                <span className="news-item__meta">
                  <span className="news-item__source">{article.source}</span>
                  <span>{NEWS_CATEGORY_LABELS[article.category]}</span>
                  <span>{formatTickerTime(article.publishedAt)}</span>
                  <ExternalLink size={10} aria-hidden="true" />
                </span>
              </a>
            </li>
          ))}
        </ol>
      )}

      <p className="news-widget__footnote">
        Headlines aggregated by the RetroPortal GitHub Action. Always check the publisher&apos;s site
        for the full story.
      </p>
    </div>
  );
}

export function NewsSettings() {
  const [settings, update] = useWidgetSettings('news');
  const { sources, refresh, refreshing, updatedAt, error } = useNews();

  const toggleCategory = (category: NewsCategory) => {
    const next = settings.categories.includes(category)
      ? settings.categories.filter((item) => item !== category)
      : [...settings.categories, category];
    update({ categories: next });
  };

  const toggleSource = (source: string) => {
    const next = settings.sources.includes(source)
      ? settings.sources.filter((item) => item !== source)
      : [...settings.sources, source];
    update({ sources: next });
  };

  return (
    <div className="form-stack">
      <div>
        <span className="field-label">Categories</span>
        <div className="chip-row">
          {(Object.keys(NEWS_CATEGORY_LABELS) as NewsCategory[]).map((category) => (
            <label className="retro-check" key={category}>
              <input
                type="checkbox"
                checked={settings.categories.includes(category)}
                onChange={() => toggleCategory(category)}
              />
              {NEWS_CATEGORY_LABELS[category]}
            </label>
          ))}
        </div>
      </div>

      {sources.length > 0 && (
        <div>
          <span className="field-label">Sources (all when none selected)</span>
          <div className="chip-row">
            {sources.map((source) => (
              <label className="retro-check" key={source}>
                <input
                  type="checkbox"
                  checked={settings.sources.includes(source)}
                  onChange={() => toggleSource(source)}
                />
                {source}
              </label>
            ))}
          </div>
        </div>
      )}

      <label>
        <span className="field-label">Headlines shown: {settings.limit}</span>
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
        Taller headline list
      </label>

      <div className="field-row">
        <button
          type="button"
          className="mini-button"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          <RefreshCw size={11} className={refreshing ? 'spin' : undefined} aria-hidden="true" />
          Refresh now
        </button>
        <span className="text-small text-muted">
          {updatedAt ? `Dataset: ${new Date(updatedAt).toLocaleString('en-GB')}` : 'No successful update'}
        </span>
      </div>
      {error && <p className="error-note">{error}</p>}
      <p className="info-note">
        Sources come from the static news dataset. Configure the endpoint and default category set
        in Settings → News.
      </p>
    </div>
  );
}
