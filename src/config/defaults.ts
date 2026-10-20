import type {
  CalendarEvent,
  NewsCategory,
  Note,
  PortalData,
  Settings,
  Shortcut,
  ShortcutCategory,
  Task,
  WidgetInstance,
} from '../types';
import { createId } from '../utils/id';
import { DEFAULT_THEME } from '../themes/presets';

export const CURRENT_DATA_VERSION = 1;
export const STORAGE_KEY = 'retroportal:data:v1';
export const NEWS_CACHE_KEY = 'retroportal:news-cache:v1';
export const WEATHER_CACHE_KEY = 'retroportal:weather-cache:v1';

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  uk: 'UK Headlines',
  world: 'World',
  technology: 'Technology',
  business: 'Business',
  science: 'Science',
};

export const ALL_NEWS_CATEGORIES = Object.keys(NEWS_CATEGORY_LABELS) as NewsCategory[];

const defaultShortcutCategories: ShortcutCategory[] = [
  { id: 'everyday', name: 'Everyday' },
  { id: 'tech', name: 'Tech & AI' },
];

const defaultShortcuts: Shortcut[] = [
  {
    id: 'shortcut-youtube',
    label: 'YouTube',
    url: 'https://www.youtube.com/',
    categoryId: 'everyday',
    icon: { type: 'favicon' },
  },
  {
    id: 'shortcut-gmail',
    label: 'Gmail',
    url: 'https://mail.google.com/',
    categoryId: 'everyday',
    icon: { type: 'favicon' },
  },
  {
    id: 'shortcut-github',
    label: 'GitHub',
    url: 'https://github.com/',
    categoryId: 'tech',
    icon: { type: 'favicon' },
  },
  {
    id: 'shortcut-reddit',
    label: 'Reddit',
    url: 'https://www.reddit.com/',
    categoryId: 'everyday',
    icon: { type: 'favicon' },
  },
  {
    id: 'shortcut-chatgpt',
    label: 'ChatGPT',
    url: 'https://chatgpt.com/',
    categoryId: 'tech',
    icon: { type: 'favicon' },
  },
  {
    id: 'shortcut-claude',
    label: 'Claude',
    url: 'https://claude.ai/',
    categoryId: 'tech',
    icon: { type: 'favicon' },
  },
];

const defaultWidgets: WidgetInstance[] = [
  { id: 'widget-weather', type: 'weather', collapsed: false },
  { id: 'widget-calendar', type: 'calendar', collapsed: false },
  { id: 'widget-rss', type: 'rss', collapsed: false },
  { id: 'widget-welcome', type: 'welcome', collapsed: false },
  { id: 'widget-news', type: 'news', collapsed: false },
  { id: 'widget-notes', type: 'notes', collapsed: false },
  { id: 'widget-clock', type: 'clock', collapsed: false },
  { id: 'widget-todo', type: 'todo', collapsed: false },
  { id: 'widget-bookmarks', type: 'bookmarks', collapsed: false },
];

const defaultNotes: Note[] = [
  {
    id: 'note-welcome',
    title: 'Welcome to RetroPortal',
    body: 'This little corner of the internet is yours.\n\nTry dragging a widget by its title bar, switching search engines, or opening Settings to change the theme.\n\nEverything is stored in your browser.',
    colour: 'yellow',
    updatedAt: Date.now(),
  },
];

const defaultTasks: Task[] = [
  {
    id: 'task-tour',
    title: 'Customise RetroPortal',
    completed: false,
    createdAt: Date.now(),
  },
  {
    id: 'task-shortcuts',
    title: 'Add a favourite website shortcut',
    completed: false,
    createdAt: Date.now() - 1000,
  },
];

const defaultEvents: CalendarEvent[] = [];

export function createDefaultSettings(): Settings {
  return {
    portalName: 'RetroPortal',
    showTabs: true,
    appearance: {
      themeId: DEFAULT_THEME.id,
      colours: { ...DEFAULT_THEME.colours },
      fontPreset: 'retro',
      fontSize: 15,
      radius: 10,
      shadows: true,
      density: 'comfortable',
      background: {
        type: 'gradient',
        colour: DEFAULT_THEME.background.colour,
        gradient: DEFAULT_THEME.background.gradient,
        overlay: DEFAULT_THEME.background.overlay,
      },
      searchBar: 'classic',
    },
    layout: {
      columns: 3,
      gap: 18,
      positions: [
        ['widget-weather', 'widget-calendar', 'widget-rss'],
        ['widget-welcome', 'widget-news', 'widget-notes'],
        ['widget-clock', 'widget-todo', 'widget-bookmarks'],
      ],
    },
    search: {
      engineId: 'google',
      openInNewTab: false,
      saveHistory: true,
      customEngines: [],
    },
    news: {
      datasetUrl: './data/news.json',
      categories: [...ALL_NEWS_CATEGORIES],
      sources: [],
      articleLimit: 12,
      refreshMinutes: 15,
      tickerEnabled: true,
      tickerSpeed: 'normal',
      tickerCategories: [...ALL_NEWS_CATEGORIES],
    },
    shortcuts: {
      style: 'large',
      showLabels: true,
    },
  };
}

export function createDefaultPortalData(): PortalData {
  const now = Date.now();
  return {
    version: CURRENT_DATA_VERSION,
    settings: createDefaultSettings(),
    shortcuts: defaultShortcuts.map((shortcut) => ({
      ...shortcut,
      icon: { ...shortcut.icon },
    })),
    shortcutCategories: defaultShortcutCategories.map((category) => ({ ...category })),
    widgets: defaultWidgets.map((widget) => ({ ...widget })),
    widgetSettings: {
      clock: {
        analogue: false,
        hour12: false,
        showSeconds: false,
        timeZone: 'Europe/London',
      },
      weather: {
        location: {
          name: 'London',
          country: 'United Kingdom',
          latitude: 51.5074,
          longitude: -0.1278,
        },
        unit: 'celsius',
        forecast: true,
      },
      calendar: { weekStartsOn: 1 },
      notes: { tall: false },
      todo: { showCompleted: true },
      rss: {
        feeds: [
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
        ],
        limit: 8,
        tall: false,
      },
      news: {
        categories: [...ALL_NEWS_CATEGORIES],
        sources: [],
        limit: 12,
        tall: false,
      },
      bookmarks: { tall: false },
      welcome: {
        name: '',
        message: 'Your personal corner of the old web, rebuilt for the dark mode era.',
      },
    },
    notes: defaultNotes.map((note) => ({ ...note, updatedAt: now })),
    tasks: defaultTasks.map((task) => ({ ...task, createdAt: now })),
    calendarEvents: defaultEvents.map((event) => ({ ...event })),
    bookmarks: [
      {
        id: 'bookmark-cat-news',
        name: 'News',
        links: [
          { id: 'bookmark-bbc', label: 'BBC News', url: 'https://www.bbc.co.uk/news' },
          {
            id: 'bookmark-guardian',
            label: 'The Guardian',
            url: 'https://www.theguardian.com/uk',
          },
          { id: 'bookmark-sky', label: 'Sky News', url: 'https://news.sky.com/uk' },
        ],
      },
      {
        id: 'bookmark-cat-tools',
        name: 'Tools',
        links: [
          {
            id: 'bookmark-hn',
            label: 'Hacker News',
            url: 'https://news.ycombinator.com/',
          },
          {
            id: 'bookmark-wikipedia',
            label: 'Wikipedia',
            url: 'https://en.wikipedia.org/',
          },
        ],
      },
    ],
    searchHistory: [],
  };
}

export function defaultWidgetId(type: string): string {
  return `widget-${type}-${createId('w')}`;
}

export const WIDGET_TYPES_ORDER: WidgetInstance['type'][] = [
  'welcome',
  'clock',
  'weather',
  'news',
  'calendar',
  'notes',
  'todo',
  'rss',
  'bookmarks',
];
