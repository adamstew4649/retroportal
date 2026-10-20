import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { NewsArticle, NewsCategory, NewsDataset } from '../types';
import { fetchNewsDataset, readNewsCache } from '../services/news/client';
import { usePortal } from './PortalContext';

interface NewsContextValue {
  dataset: NewsDataset | null;
  articles: NewsArticle[];
  updatedAt: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  refreshing: boolean;
  error: string | null;
  stale: boolean;
  fromCache: boolean;
  lastChecked: number | null;
  refresh: () => Promise<void>;
  articlesFor: (categories: NewsCategory[], sources: string[]) => NewsArticle[];
  sources: string[];
}

const NewsContext = createContext<NewsContextValue | null>(null);

export function NewsProvider({ children }: { children: ReactNode }) {
  const { data } = usePortal();
  const datasetUrl = data.settings.news.datasetUrl;
  const refreshMinutes = data.settings.news.refreshMinutes;
  const initialCache = useRef<NewsDataset | null>(readNewsCache());
  const [dataset, setDataset] = useState<NewsDataset | null>(initialCache.current);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    initialCache.current ? 'ready' : 'loading',
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(Boolean(initialCache.current));
  const [fromCache, setFromCache] = useState(Boolean(initialCache.current));
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  const datasetRef = useRef<NewsDataset | null>(initialCache.current);
  const urlRef = useRef(datasetUrl);
  const lastCheckedRef = useRef<number | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    datasetRef.current = dataset;
  }, [dataset]);

  useEffect(() => {
    urlRef.current = datasetUrl;
  }, [datasetUrl]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      inFlight.current?.abort();
    };
  }, []);

  const runRefresh = useCallback(async (showSpinner = true) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    if (showSpinner) setRefreshing(true);
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    const result = await fetchNewsDataset(urlRef.current, controller.signal, datasetRef.current);
    if (!mounted.current || controller.signal.aborted) return;
    setLastChecked(Date.now());
    lastCheckedRef.current = Date.now();
    setRefreshing(false);
    setFromCache(result.fromCache);
    setError(result.error ?? null);
    setStale(result.stale);
    if (result.dataset) {
      setDataset(result.dataset);
      datasetRef.current = result.dataset;
      setStatus('ready');
    } else {
      setStatus('error');
      setError(result.error ?? 'The news service could not be reached.');
    }
  }, []);

  useEffect(() => {
    void runRefresh(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void runRefresh(false);
    }, Math.max(5, refreshMinutes) * 60_000);
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        lastCheckedRef.current !== null &&
        Date.now() - lastCheckedRef.current > 5 * 60_000
      ) {
        void runRefresh(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [runRefresh, refreshMinutes]);

  // Re-fetch immediately when the configured dataset endpoint changes.
  useEffect(() => {
    if (urlRef.current === datasetUrl) return;
    urlRef.current = datasetUrl;
    void runRefresh(false);
  }, [datasetUrl, runRefresh]);

  const articlesFor = useCallback(
    (categories: NewsCategory[], sources: string[]) => {
      const list = dataset?.articles ?? [];
      const categorySet = new Set(categories);
      const sourceSet = new Set(sources);
      return list.filter(
        (article) =>
          (categories.length === 0 || categorySet.has(article.category)) &&
          (sources.length === 0 || sourceSet.has(article.source)),
      );
    },
    [dataset],
  );

  const sources = useMemo(
    () => [...new Set(dataset?.articles.map((article) => article.source) ?? [])].sort(),
    [dataset],
  );

  const value = useMemo<NewsContextValue>(
    () => ({
      dataset,
      articles: dataset?.articles ?? [],
      updatedAt: dataset?.updatedAt ?? null,
      status,
      refreshing,
      error,
      stale,
      fromCache,
      lastChecked,
      refresh: () => runRefresh(true),
      articlesFor,
      sources,
    }),
    [
      dataset,
      status,
      refreshing,
      error,
      stale,
      fromCache,
      lastChecked,
      runRefresh,
      articlesFor,
      sources,
    ],
  );

  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
}

export function useNews(): NewsContextValue {
  const context = useContext(NewsContext);
  if (!context) throw new Error('useNews must be used inside NewsProvider');
  return context;
}
