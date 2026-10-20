import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { usePortal } from '../../state/PortalContext';
import { useNews } from '../../state/NewsContext';
import { ALL_NEWS_CATEGORIES, NEWS_CATEGORY_LABELS } from '../../config/defaults';
import { formatTickerTime } from '../../utils/date';
import type { NewsCategory } from '../../types';
import './ticker.css';

const SPEED_PIXELS: Record<string, number> = {
  slow: 26,
  normal: 44,
  fast: 68,
};

export function NewsTicker() {
  const { data, setData } = usePortal();
  const { articlesFor, status, error, refresh, refreshing } = useNews();
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const loopWidthRef = useRef(0);
  const pausedRef = useRef(false);

  const categories =
    data.settings.news.tickerCategories.length > 0
      ? data.settings.news.tickerCategories
      : ALL_NEWS_CATEGORIES;

  const articles = useMemo(
    () => articlesFor(categories, []).slice(0, 30),
    [articlesFor, categories],
  );

  const speed = SPEED_PIXELS[data.settings.news.tickerSpeed] ?? SPEED_PIXELS.normal;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    pausedRef.current = paused || hovered || reducedMotion;
  }, [paused, hovered, reducedMotion]);

  useEffect(() => {
    offsetRef.current = 0;
    if (trackRef.current) trackRef.current.style.transform = 'translate3d(0,0,0)';
  }, [articles]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      loopWidthRef.current = track.scrollWidth / 2;
    };
    measure();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(track);
    }

    let frame = 0;
    let last = performance.now();
    const animate = (now: number) => {
      const delta = Math.min(now - last, 120);
      last = now;
      if (!pausedRef.current && loopWidthRef.current > 0) {
        offsetRef.current += (speed * delta) / 1000;
        if (offsetRef.current >= loopWidthRef.current) {
          offsetRef.current -= loopWidthRef.current;
        }
        track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
      } else {
        track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [speed, articles.length]);

  const step = (direction: -1 | 1) => {
    setPaused(true);
    const track = trackRef.current;
    if (!track || articles.length === 0) return;
    const items = Array.from(
      track.querySelectorAll<HTMLElement>('[data-ticker-item]'),
    ).slice(0, articles.length);
    if (items.length === 0) return;

    let current = 0;
    for (let index = 0; index < items.length; index += 1) {
      if (items[index].offsetLeft <= offsetRef.current + 4) current = index;
    }
    let next = current + direction;
    if (next >= items.length) next = 0;
    if (next < 0) next = items.length - 1;
    offsetRef.current = items[next].offsetLeft;
    track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
  };

  const selectedCategory =
    data.settings.news.tickerCategories.length === 1
      ? data.settings.news.tickerCategories[0]
      : 'all';

  const changeCategory = (value: string) => {
    const nextCategories: NewsCategory[] =
      value === 'all' ? [...ALL_NEWS_CATEGORIES] : [value as NewsCategory];
    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        news: { ...current.settings.news, tickerCategories: nextCategories },
      },
    }));
    offsetRef.current = 0;
  };

  return (
    <footer
      className="news-ticker"
      aria-label="Latest UK news ticker"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false);
      }}
    >
      <div className="ticker-label">
        <span className="ticker-label__dot" aria-hidden="true" />
        LATEST NEWS
      </div>

      <div className="ticker-viewport">
        {articles.length === 0 ? (
          <div className="ticker-empty">
            {status === 'loading' ? (
              <>
                <RefreshCw size={12} className="spin" aria-hidden="true" /> Fetching headlines…
              </>
            ) : (
              <>
                <TriangleAlert size={12} aria-hidden="true" />
                {error ? `Headlines unavailable — ${error}` : 'No headlines match the selected categories.'}
                <button type="button" className="ticker-inline-button" onClick={() => void refresh()}>
                  Retry
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="ticker-track" ref={trackRef} aria-live="off">
            {[0, 1].map((copy) => (
              <div className="ticker-copy" key={copy} aria-hidden={copy === 1 ? true : undefined}>
                {articles.map((article) => (
                  <span className="ticker-item" key={`${copy}-${article.id}`} data-ticker-item>
                    <a href={article.url} target="_blank" rel="noopener noreferrer" tabIndex={copy === 1 ? -1 : 0}>
                      <span className="ticker-source">{article.source}</span>
                      <span className="ticker-headline">{article.title}</span>
                      <span className="ticker-time">{formatTickerTime(article.publishedAt)}</span>
                    </a>
                    <span className="ticker-separator" aria-hidden="true">
                      ●
                    </span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ticker-controls">
        <label className="ticker-category">
          <span className="visually-hidden">Ticker category</span>
          <select
            value={selectedCategory}
            onChange={(event) => changeCategory(event.target.value)}
            aria-label="Ticker news category"
          >
            <option value="all">All news</option>
            {ALL_NEWS_CATEGORIES.map((category) => (
              <option value={category} key={category}>
                {NEWS_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="ticker-button" onClick={() => step(-1)} aria-label="Previous headline">
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ticker-button"
          onClick={() => setPaused((current) => !current)}
          aria-label={paused ? 'Resume ticker' : 'Pause ticker'}
          aria-pressed={paused}
        >
          {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
        </button>
        <button type="button" className="ticker-button" onClick={() => step(1)} aria-label="Next headline">
          <ChevronRight size={14} aria-hidden="true" />
        </button>
        {reducedMotion && <span className="ticker-reduced">Motion reduced</span>}
      </div>
      <span className="visually-hidden">
        News ticker with {articles.length} headlines. It does not announce headlines automatically.
        Use the previous and next buttons to browse.
      </span>
    </footer>
  );
}
