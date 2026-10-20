import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useMemo } from 'react';
import { NewsProvider, useNews } from '../src/state/NewsContext';
import { PortalProvider } from '../src/state/PortalContext';
import { ToastProvider } from '../src/state/ToastContext';
import type { NewsCategory } from '../src/types';

const CATEGORIES: NewsCategory[] = ['uk', 'world', 'technology', 'business', 'science'];

const DATASET = {
  version: 1,
  updatedAt: '2026-10-20T10:00:00Z',
  articles: [
    {
      id: 'article-1',
      title: 'Headline from the dataset',
      source: 'BBC News',
      url: 'https://www.bbc.co.uk/news/uk-1',
      publishedAt: '2026-10-20T10:00:00Z',
      category: 'uk',
    },
    {
      id: 'article-2',
      title: 'Technology headline',
      source: 'The Guardian',
      url: 'https://www.theguardian.com/technology/1',
      publishedAt: '2026-10-20T09:00:00Z',
      category: 'technology',
    },
  ],
};

function HeadlineProbe() {
  const { articlesFor, status } = useNews();
  // Deliberately mirrors the news widget: the memo depends on the identity of
  // articlesFor, so this also guards against stale dataset references.
  const articles = useMemo(() => articlesFor(CATEGORIES, []), [articlesFor]);
  return (
    <div>
      <p>{status}</p>
      <p>{articles.length} headlines</p>
      <p>{articles[0]?.title ?? 'none'}</p>
    </div>
  );
}

function renderNews() {
  return render(
    <ToastProvider>
      <PortalProvider>
        <NewsProvider>
          <HeadlineProbe />
        </NewsProvider>
      </PortalProvider>
    </ToastProvider>,
  );
}

describe('NewsProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('publishes fetched articles to consumers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => DATASET,
      })),
    );

    renderNews();

    expect(await screen.findByText('2 headlines')).toBeInTheDocument();
    expect(screen.getByText('Headline from the dataset')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
  });

  it('filters by category and source', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => DATASET,
      })),
    );

    function FilterProbe() {
      const { articlesFor } = useNews();
      const uk = articlesFor(['uk'], []);
      const guardian = articlesFor(CATEGORIES, ['The Guardian']);
      return (
        <p>
          {uk.length} UK / {guardian.length} Guardian
        </p>
      );
    }

    render(
      <ToastProvider>
        <PortalProvider>
          <NewsProvider>
            <FilterProbe />
          </NewsProvider>
        </PortalProvider>
      </ToastProvider>,
    );

    expect(await screen.findByText('1 UK / 1 Guardian')).toBeInTheDocument();
  });

  it('shows an error and no articles when the fetch fails without a cache', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down');
      }),
    );

    function ErrorProbe() {
      const { status, error, articles } = useNews();
      return (
        <p>
          {status}: {error} ({articles.length})
        </p>
      );
    }

    render(
      <ToastProvider>
        <PortalProvider>
          <NewsProvider>
            <ErrorProbe />
          </NewsProvider>
        </PortalProvider>
      </ToastProvider>,
    );

    expect(await screen.findByText(/error: network down \(0\)/)).toBeInTheDocument();
  });
});
