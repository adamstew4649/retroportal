import type {
  CalendarEvent,
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
import { ALL_NEWS_CATEGORIES } from './news';
import { createDefaultWidgetSettingsMap } from '../widgets/defaults';

export const CURRENT_DATA_VERSION = 2;
export const STORAGE_KEY = 'retroportal:data:v2';
export const LEGACY_STORAGE_KEY = 'retroportal:data:v1';
export const NEWS_CACHE_KEY = 'retroportal:news-cache:v1';
export const WEATHER_CACHE_KEY = 'retroportal:weather-cache:v1';

export { ALL_NEWS_CATEGORIES, NEWS_CATEGORY_LABELS } from './news';

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
    widgetId: 'widget-notes',
    title: 'Welcome to RetroPortal',
    body: 'This little corner of the internet is yours.\n\nTry dragging a widget by its title bar, switching search engines, or opening Settings to change the theme.\n\nEverything is stored in your browser.',
    colour: 'yellow',
    updatedAt: Date.now(),
  },
];

const defaultTasks: Task[] = [
  {
    id: 'task-tour',
    widgetId: 'widget-todo',
    title: 'Customise RetroPortal',
    completed: false,
    createdAt: Date.now(),
  },
  {
    id: 'task-shortcuts',
    widgetId: 'widget-todo',
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
    widgetSettings: createDefaultWidgetSettingsMap(defaultWidgets),
    notes: defaultNotes.map((note) => ({ ...note, updatedAt: now })),
    tasks: defaultTasks.map((task) => ({ ...task, createdAt: now })),
    calendarEvents: defaultEvents.map((event) => ({ ...event })),
    bookmarks: [
      {
        id: 'bookmark-cat-news',
        widgetId: 'widget-bookmarks',
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
        widgetId: 'widget-bookmarks',
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

export function defaultWidgetId(type: WidgetInstance['type']): string {
  return `widget-${type}-${createId('w')}`;
}
