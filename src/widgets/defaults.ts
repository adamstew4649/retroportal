import { ALL_NEWS_CATEGORIES } from '../config/news';
import type { RssFeed, WidgetSettingsMap, WidgetType } from '../types';
import { resolveFishColours } from './Fish/palette';

const DEFAULT_RSS_FEEDS: RssFeed[] = [
  {
    id: 'feed-bbc-uk',
    name: 'BBC UK News',
    url: './data/feeds/bbc-uk.json',
    bundled: true,
    sourceUrl: 'https://feeds.bbci.co.uk/news/uk/rss.xml',
  },
  {
    id: 'feed-guardian-uk',
    name: 'The Guardian UK',
    url: './data/feeds/guardian-uk.json',
    bundled: true,
    sourceUrl: 'https://www.theguardian.com/uk/rss',
  },
  {
    id: 'feed-sky-uk',
    name: 'Sky News UK',
    url: './data/feeds/sky-uk.json',
    bundled: true,
    sourceUrl: 'https://feeds.skynews.com/feeds/rss/uk.xml',
  },
];

const factories: { [K in WidgetType]: () => WidgetSettingsMap[K] } = {
  welcome: () => ({
    name: '',
    message: 'Your personal corner of the old web, rebuilt for the dark mode era.',
  }),
  clock: () => ({
    analogue: false,
    hour12: false,
    showSeconds: false,
    timeZone: 'Europe/London',
  }),
  weather: () => ({
    location: {
      name: 'London',
      country: 'United Kingdom',
      latitude: 51.5074,
      longitude: -0.1278,
    },
    unit: 'celsius',
    forecast: true,
  }),
  fish: () => ({
    fishCount: 4,
    colours: resolveFishColours(undefined, 4),
    speed: 'normal',
    water: 'reef',
    bubbles: true,
    plants: true,
    tall: false,
  }),
  news: () => ({
    categories: [...ALL_NEWS_CATEGORIES],
    sources: [],
    limit: 12,
    tall: false,
  }),
  calendar: () => ({ weekStartsOn: 1 }),
  notes: () => ({ tall: false }),
  todo: () => ({ showCompleted: true }),
  rss: () => ({
    feeds: DEFAULT_RSS_FEEDS.map((feed) => ({ ...feed })),
    limit: 8,
    tall: false,
  }),
  bookmarks: () => ({ tall: false }),
};

export function createDefaultWidgetSettings<K extends WidgetType>(
  type: K,
): WidgetSettingsMap[K] {
  return factories[type]() as WidgetSettingsMap[K];
}

export function createDefaultWidgetSettingsMap(
  widgets: Array<{ id: string; type: WidgetType }>,
): Record<string, WidgetSettingsMap[WidgetType]> {
  return Object.fromEntries(
    widgets.map((widget) => [widget.id, createDefaultWidgetSettings(widget.type)]),
  );
}
