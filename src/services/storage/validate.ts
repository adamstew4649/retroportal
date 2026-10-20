import {
  ALL_NEWS_CATEGORIES,
  CURRENT_DATA_VERSION,
  NEWS_CATEGORY_LABELS,
  createDefaultPortalData,
  createDefaultSettings,
  defaultWidgetId,
} from '../../config/defaults';
import {
  WIDGET_TYPES,
  type AppearanceSettings,
  type BookmarkCategory,
  type CalendarEvent,
  type ColumnCount,
  type NewsArticle,
  type NewsCategory,
  type NewsDataset,
  type Note,
  type PortalData,
  type RssFeed,
  type SearchEngine,
  type Settings,
  type Shortcut,
  type ShortcutCategory,
  type ShortcutIcon,
  type Task,
  type ThemeColours,
  type WidgetInstance,
  type WidgetSettingsMap,
  type WidgetType,
} from '../../types';
import { THEME_PRESETS, themeById, BACKGROUND_GRADIENTS } from '../../themes/presets';
import { createId, clamp, isRecord } from '../../utils/id';
import { safeHttpUrl, safeHttpUrlWithHttpsFallback, stripControlCharacters } from '../../utils/url';
import { validateEngineTemplate } from '../../services/search/engines';
import { createDefaultWidgetSettings } from '../../widgets/defaults';

type AnyWidgetSettings = WidgetSettingsMap[WidgetType];

const SHORTCUT_COLOURS = ['yellow', 'blue', 'green', 'pink', 'plain'] as const;
const TICKER_SPEEDS = ['slow', 'normal', 'fast'] as const;

function str(value: unknown, fallback: string, max = 400): string {
  if (typeof value !== 'string') return fallback;
  return stripControlCharacters(value).slice(0, max);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(value, min, max);
}

function hex(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value.trim())
    ? value.trim()
    : fallback;
}

function safeId(value: unknown, prefix: string): string {
  if (typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value)) return value;
  return createId(prefix);
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function sanitiseColours(raw: unknown, fallback: ThemeColours): ThemeColours {
  if (!isRecord(raw)) return { ...fallback };
  return {
    bg: hex(raw.bg, fallback.bg),
    contentBg: hex(raw.contentBg, fallback.contentBg),
    widgetBg: hex(raw.widgetBg, fallback.widgetBg),
    headerTop: hex(raw.headerTop, fallback.headerTop),
    headerBottom: hex(raw.headerBottom, fallback.headerBottom),
    accent: hex(raw.accent, fallback.accent),
    text: hex(raw.text, fallback.text),
    muted: hex(raw.muted, fallback.muted),
    border: hex(raw.border, fallback.border),
  };
}

function sanitiseAppearance(raw: unknown, defaults: AppearanceSettings): AppearanceSettings {
  const value = isRecord(raw) ? raw : {};
  const themeId = str(value.themeId, defaults.themeId, 60);
  const preset = THEME_PRESETS.find((theme) => theme.id === themeId);
  const baseColours = preset?.colours ?? defaults.colours;
  const backgroundRaw = isRecord(value.background) ? value.background : {};
  const backgroundType =
    backgroundRaw.type === 'colour' || backgroundRaw.type === 'image' || backgroundRaw.type === 'gradient'
      ? backgroundRaw.type
      : 'gradient';

  const gradient = str(backgroundRaw.gradient, defaults.background.gradient, 1200);
  const safeGradient =
    /^[a-z-]+\([^;{}<>]*\)(?:\s*,\s*[a-z-]+\([^;{}<>]*\))*$/i.test(gradient)
      ? gradient
      : defaults.background.gradient;

  return {
    themeId: preset ? preset.id : 'custom',
    colours: sanitiseColours(value.colours, baseColours),
    fontPreset: value.fontPreset === 'modern' ? 'modern' : 'retro',
    fontSize: num(value.fontSize, defaults.fontSize, 12, 20),
    radius: num(value.radius, defaults.radius, 0, 22),
    shadows: bool(value.shadows, defaults.shadows),
    density: value.density === 'compact' ? 'compact' : 'comfortable',
    searchBar: value.searchBar === 'slim' ? 'slim' : 'classic',
    background: {
      type: backgroundType,
      colour: hex(backgroundRaw.colour, defaults.background.colour),
      gradient: safeGradient,
      imageId: typeof backgroundRaw.imageId === 'string' ? safeId(backgroundRaw.imageId, 'bg') : undefined,
      imageUrl: typeof backgroundRaw.imageUrl === 'string'
        ? (safeHttpUrl(backgroundRaw.imageUrl) ?? undefined)
        : undefined,
      overlay: num(backgroundRaw.overlay, defaults.background.overlay, 0, 0.85),
    },
  };
}

function sanitiseSearchEngine(raw: unknown): SearchEngine | null {
  if (!isRecord(raw)) return null;
  const name = str(raw.name, '', 40).trim();
  const template = str(raw.template, '', 500).trim();
  if (!name || validateEngineTemplate(template)) return null;
  return {
    id: safeId(raw.id, 'engine'),
    name,
    template,
    colour: hex(raw.colour, '#76a9e0'),
    builtin: false,
  };
}

function sanitiseRssFeeds(raw: unknown, defaults: RssFeed[]): RssFeed[] {
  if (!Array.isArray(raw)) return defaults.map((feed) => ({ ...feed }));
  return raw
    .map((feed): RssFeed | null => {
      if (!isRecord(feed)) return null;
      const url = safeDataUrlLocal(feed.url);
      if (!url) return null;
      return {
        id: safeId(feed.id, 'feed'),
        name: str(feed.name, 'Untitled feed', 80),
        url,
        bundled: typeof feed.bundled === 'boolean' ? feed.bundled : undefined,
        sourceUrl: safeHttpUrl(str(feed.sourceUrl ?? '', '', 500)) ?? undefined,
      } satisfies RssFeed;
    })
    .filter((feed): feed is RssFeed => feed !== null)
    .slice(0, 12);
}

function sanitiseWidgetSettingsFor(type: WidgetType, raw: unknown): AnyWidgetSettings {
  const value = isRecord(raw) ? raw : {};
  switch (type) {
    case 'clock': {
      const defaults = createDefaultWidgetSettings('clock');
      return {
        analogue: bool(value.analogue, defaults.analogue),
        hour12: bool(value.hour12, defaults.hour12),
        showSeconds: bool(value.showSeconds, defaults.showSeconds),
        timeZone: str(value.timeZone, defaults.timeZone, 60),
      };
    }
    case 'weather': {
      const defaults = createDefaultWidgetSettings('weather');
      const location = isRecord(value.location) ? value.location : {};
      return {
        location: {
          name: str(location.name, defaults.location.name, 80),
          country: str(location.country, defaults.location.country ?? '', 80) || undefined,
          latitude: num(location.latitude, defaults.location.latitude, -90, 90),
          longitude: num(location.longitude, defaults.location.longitude, -180, 180),
        },
        unit: value.unit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
        forecast: bool(value.forecast, defaults.forecast),
      };
    }
    case 'calendar': {
      const defaults = createDefaultWidgetSettings('calendar');
      return {
        weekStartsOn: value.weekStartsOn === 0 ? 0 : defaults.weekStartsOn,
      };
    }
    case 'notes': {
      const defaults = createDefaultWidgetSettings('notes');
      return { tall: bool(value.tall, defaults.tall) };
    }
    case 'todo': {
      const defaults = createDefaultWidgetSettings('todo');
      return { showCompleted: bool(value.showCompleted, defaults.showCompleted) };
    }
    case 'rss': {
      const defaults = createDefaultWidgetSettings('rss');
      return {
        feeds: sanitiseRssFeeds(value.feeds, defaults.feeds),
        limit: num(value.limit, defaults.limit, 1, 30),
        tall: bool(value.tall, defaults.tall),
      };
    }
    case 'news': {
      const defaults = createDefaultWidgetSettings('news');
      return {
        categories: sanitiseCategoryList(value.categories, defaults.categories),
        sources: sanitiseStringList(value.sources, 30, 80),
        limit: num(value.limit, defaults.limit, 1, 30),
        tall: bool(value.tall, defaults.tall),
      };
    }
    case 'bookmarks': {
      const defaults = createDefaultWidgetSettings('bookmarks');
      return { tall: bool(value.tall, defaults.tall) };
    }
    case 'welcome': {
      const defaults = createDefaultWidgetSettings('welcome');
      return {
        name: str(value.name, defaults.name, 50),
        message: str(value.message, defaults.message, 240),
      };
    }
  }
}

/** Relative paths are permitted for bundled feed snapshots. */
function safeDataUrlLocal(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input) return null;
  if (input.startsWith('./') || input.startsWith('/')) return input.slice(0, 500);
  return safeHttpUrl(input)?.slice(0, 500) ?? null;
}

function sanitiseCategoryList(value: unknown, fallback: NewsCategory[]): NewsCategory[] {
  if (!Array.isArray(value)) return [...fallback];
  const list = value.filter(
    (item): item is NewsCategory =>
      typeof item === 'string' && ALL_NEWS_CATEGORIES.includes(item as NewsCategory),
  );
  return [...new Set(list)];
}

function sanitiseStringList(value: unknown, max: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    .map((item) => item.slice(0, maxLength))
    .slice(0, max);
}

function sanitiseSettings(raw: unknown): Settings {
  const defaults = createDefaultSettings();
  const value = isRecord(raw) ? raw : {};
  const appearance = sanitiseAppearance(value.appearance, defaults.appearance);
  const layoutRaw = isRecord(value.layout) ? value.layout : {};
  const searchRaw = isRecord(value.search) ? value.search : {};
  const newsRaw = isRecord(value.news) ? value.news : {};
  const shortcutRaw = isRecord(value.shortcuts) ? value.shortcuts : {};

  const columns = (Number.isInteger(layoutRaw.columns) ? layoutRaw.columns : defaults.layout.columns) as number;
  const safeColumns = (clamp(columns, 1, 4) as ColumnCount) ?? 3;

  const customEngines: SearchEngine[] = Array.isArray(searchRaw.customEngines)
    ? uniqueBy(
        searchRaw.customEngines
          .map(sanitiseSearchEngine)
          .filter((engine): engine is SearchEngine => engine !== null),
        (engine) => engine.id,
      ).slice(0, 10)
    : [];

  const datasetUrl = safeDataUrlLocal(newsRaw.datasetUrl) ?? defaults.news.datasetUrl;

  return {
    portalName: str(value.portalName, defaults.portalName, 40) || defaults.portalName,
    showTabs: bool(value.showTabs, defaults.showTabs),
    appearance,
    layout: {
      columns: safeColumns,
      gap: num(layoutRaw.gap, defaults.layout.gap, 8, 32),
      positions: Array.isArray(layoutRaw.positions)
        ? layoutRaw.positions
            .filter((column): column is string[] => Array.isArray(column))
            .map((column) =>
              [...new Set(column.filter((id): id is string => typeof id === 'string'))].slice(0, 40),
            )
            .slice(0, 4)
        : defaults.layout.positions.map((column) => [...column]),
    },
    search: {
      engineId: str(searchRaw.engineId, defaults.search.engineId, 80),
      openInNewTab: bool(searchRaw.openInNewTab, defaults.search.openInNewTab),
      saveHistory: bool(searchRaw.saveHistory, defaults.search.saveHistory),
      customEngines,
    },
    news: {
      datasetUrl,
      categories: sanitiseCategoryList(newsRaw.categories, defaults.news.categories),
      sources: sanitiseStringList(newsRaw.sources, 30, 80),
      articleLimit: num(newsRaw.articleLimit, defaults.news.articleLimit, 1, 40),
      refreshMinutes: num(newsRaw.refreshMinutes, defaults.news.refreshMinutes, 5, 120),
      tickerEnabled: bool(newsRaw.tickerEnabled, defaults.news.tickerEnabled),
      tickerSpeed:
        typeof newsRaw.tickerSpeed === 'string' &&
        (TICKER_SPEEDS as readonly string[]).includes(newsRaw.tickerSpeed)
          ? (newsRaw.tickerSpeed as Settings['news']['tickerSpeed'])
          : defaults.news.tickerSpeed,
      tickerCategories: sanitiseCategoryList(
        newsRaw.tickerCategories,
        defaults.news.tickerCategories,
      ),
    },
    shortcuts: {
      style: shortcutRaw.style === 'compact' ? 'compact' : 'large',
      showLabels: bool(shortcutRaw.showLabels, defaults.shortcuts.showLabels),
    },
  };
}

function sanitiseShortcuts(raw: unknown, categories: ShortcutCategory[]): Shortcut[] {
  if (!Array.isArray(raw)) return createDefaultPortalData().shortcuts;
  const categoryIds = new Set(categories.map((category) => category.id));
  return uniqueBy(
    raw
      .map((item) => {
        if (!isRecord(item)) return null;
        const url = safeHttpUrlWithHttpsFallback(str(item.url, '', 500));
        if (!url) return null;
        const label = str(item.label, '', 50).trim();
        if (!label) return null;
        const iconRaw = isRecord(item.icon) ? item.icon : {};
        let icon: ShortcutIcon = { type: 'favicon' };
        if (iconRaw.type === 'text') {
          icon = { type: 'text', value: str(iconRaw.value, '★', 2) };
        } else if (iconRaw.type === 'url') {
          const iconUrl = safeHttpUrl(str(iconRaw.value, '', 500));
          if (iconUrl) icon = { type: 'url', value: iconUrl };
        }
        const categoryId = str(item.categoryId, '', 80);
        return {
          id: safeId(item.id, 'shortcut'),
          label,
          url,
          categoryId: categoryIds.has(categoryId) ? categoryId : '',
          icon,
        } satisfies Shortcut;
      })
      .filter((item): item is Shortcut => item !== null),
    (item) => item.id,
  ).slice(0, 60);
}

function sanitiseCategories(raw: unknown): ShortcutCategory[] {
  if (!Array.isArray(raw)) return createDefaultPortalData().shortcutCategories;
  return uniqueBy(
    raw
      .map((item) => {
        if (!isRecord(item)) return null;
        const name = str(item.name, '', 30).trim();
        if (!name) return null;
        return { id: safeId(item.id, 'category'), name };
      })
      .filter((item): item is ShortcutCategory => item !== null),
    (item) => item.id,
  ).slice(0, 20);
}

function sanitiseWidgets(raw: unknown): WidgetInstance[] {
  if (!Array.isArray(raw)) return createDefaultPortalData().widgets;
  return uniqueBy(
    raw
      .map((item): WidgetInstance | null => {
        if (!isRecord(item)) return null;
        const type = item.type as WidgetType;
        if (!WIDGET_TYPES.includes(type)) return null;
        const title = str(item.title, '', 60).trim();
        const widget: WidgetInstance = {
          id: safeId(item.id, defaultWidgetId(type)),
          type,
          collapsed: bool(item.collapsed, false),
        };
        if (title) widget.title = title;
        return widget;
      })
      .filter((item): item is WidgetInstance => item !== null),
    (item) => item.id,
  ).slice(0, 64);
}

interface WidgetOwnership {
  byType: Map<WidgetType, string>;
  byId: Map<string, WidgetType>;
}

function buildOwnership(widgets: WidgetInstance[]): WidgetOwnership {
  const byType = new Map<WidgetType, string>();
  const byId = new Map<string, WidgetType>();
  for (const widget of widgets) {
    if (!byType.has(widget.type)) byType.set(widget.type, widget.id);
    byId.set(widget.id, widget.type);
  }
  return { byType, byId };
}

function ownedWidgetId(
  raw: unknown,
  type: WidgetType,
  ownership: WidgetOwnership,
): string | undefined {
  if (typeof raw === 'string' && ownership.byId.get(raw) === type) return raw;
  return ownership.byType.get(type);
}

function sanitiseNotes(raw: unknown, ownership: WidgetOwnership): Note[] {
  if (!Array.isArray(raw)) {
    const widgetId = ownership.byType.get('notes');
    return widgetId
      ? createDefaultPortalData().notes.map((note) => ({ ...note, widgetId }))
      : [];
  }
  return uniqueBy(
    raw
      .map((item): Note | null => {
        if (!isRecord(item)) return null;
        const title = str(item.title, 'Untitled note', 80);
        const body = str(item.body, '', 50000);
        const colour = (SHORTCUT_COLOURS as readonly string[]).includes(String(item.colour))
          ? (item.colour as Note['colour'])
          : 'yellow';
        const note: Note = {
          id: safeId(item.id, 'note'),
          title,
          body,
          colour,
          updatedAt: num(item.updatedAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
        };
        const widgetId = ownedWidgetId(item.widgetId, 'notes', ownership);
        if (widgetId) note.widgetId = widgetId;
        return note;
      })
      .filter((item): item is Note => item !== null),
    (item) => item.id,
  ).slice(0, 400);
}

function sanitiseTasks(raw: unknown, ownership: WidgetOwnership): Task[] {
  if (!Array.isArray(raw)) {
    const widgetId = ownership.byType.get('todo');
    return widgetId
      ? createDefaultPortalData().tasks.map((task) => ({ ...task, widgetId }))
      : [];
  }
  return uniqueBy(
    raw
      .map((item): Task | null => {
        if (!isRecord(item)) return null;
        const title = str(item.title, '', 200).trim();
        if (!title) return null;
        const task: Task = {
          id: safeId(item.id, 'task'),
          title,
          completed: bool(item.completed, false),
          createdAt: num(item.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
        };
        const widgetId = ownedWidgetId(item.widgetId, 'todo', ownership);
        if (widgetId) task.widgetId = widgetId;
        if (typeof item.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) {
          task.dueDate = item.dueDate;
        }
        return task;
      })
      .filter((item): item is Task => item !== null),
    (item) => item.id,
  ).slice(0, 1000);
}

function sanitiseEvents(raw: unknown, ownership: WidgetOwnership): CalendarEvent[] {
  if (!Array.isArray(raw)) return [];
  return uniqueBy(
    raw
      .map((item): CalendarEvent | null => {
        if (!isRecord(item)) return null;
        const title = str(item.title, '', 120).trim();
        const date = typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
          ? item.date
          : '';
        if (!title || !date) return null;
        const event: CalendarEvent = {
          id: safeId(item.id, 'event'),
          title,
          date,
          colour:
            item.colour === 'green' || item.colour === 'pink' || item.colour === 'yellow'
              ? item.colour
              : 'blue',
        };
        const widgetId = ownedWidgetId(item.widgetId, 'calendar', ownership);
        if (widgetId) event.widgetId = widgetId;
        if (typeof item.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)) {
          event.time = item.time;
        }
        return event;
      })
      .filter((item): item is CalendarEvent => item !== null),
    (item) => item.id,
  ).slice(0, 2000);
}

function sanitiseBookmarks(raw: unknown, ownership: WidgetOwnership): BookmarkCategory[] {
  if (!Array.isArray(raw)) {
    const widgetId = ownership.byType.get('bookmarks');
    return widgetId
      ? createDefaultPortalData().bookmarks.map((category) => ({ ...category, widgetId }))
      : [];
  }
  return uniqueBy(
    raw
      .map((item): BookmarkCategory | null => {
        if (!isRecord(item)) return null;
        const name = str(item.name, '', 40).trim();
        if (!name) return null;
        const links = Array.isArray(item.links)
          ? item.links
              .map((link) => {
                if (!isRecord(link)) return null;
                const url = safeHttpUrlWithHttpsFallback(str(link.url, '', 500));
                const label = str(link.label, '', 60).trim();
                if (!url || !label) return null;
                return { id: safeId(link.id, 'bookmark'), label, url };
              })
              .filter((link): link is { id: string; label: string; url: string } => link !== null)
              .slice(0, 40)
          : [];
        const category: BookmarkCategory = {
          id: safeId(item.id, 'bookmark-cat'),
          name,
          links,
        };
        const widgetId = ownedWidgetId(item.widgetId, 'bookmarks', ownership);
        if (widgetId) category.widgetId = widgetId;
        return category;
      })
      .filter((item): item is BookmarkCategory => item !== null),
    (item) => item.id,
  ).slice(0, 40);
}

function sanitiseHistory(raw: unknown): PortalData['searchHistory'] {
  if (!Array.isArray(raw)) return [];
  return uniqueBy(
    raw
      .map((item) => {
        if (!isRecord(item)) return null;
        const query = str(item.query, '', 200).trim();
        if (!query) return null;
        return { query, at: num(item.at, Date.now(), 0, Number.MAX_SAFE_INTEGER) };
      })
      .filter((item): item is { query: string; at: number } => item !== null),
    (item) => item.query.toLowerCase(),
  )
    .sort((a, b) => b.at - a.at)
    .slice(0, 20);
}

function reconcileLayout(data: PortalData): PortalData {
  const columnCount = data.settings.layout.columns;
  const positions = data.settings.layout.positions.slice(0, columnCount);
  while (positions.length < columnCount) positions.push([]);

  const widgetIds = new Set(data.widgets.map((widget) => widget.id));
  const seen = new Set<string>();
  const cleaned = positions.map((column) =>
    column.filter((id) => {
      if (!widgetIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  );

  for (const widget of data.widgets) {
    if (seen.has(widget.id)) continue;
    let target = 0;
    for (let index = 1; index < cleaned.length; index += 1) {
      if (cleaned[index].length < cleaned[target].length) target = index;
    }
    cleaned[target].push(widget.id);
    seen.add(widget.id);
  }

  return {
    ...data,
    settings: {
      ...data.settings,
      layout: { ...data.settings.layout, positions: cleaned },
    },
  };
}

export function normalisePortalData(raw: unknown): PortalData {
  if (!isRecord(raw)) return createDefaultPortalData();
  const source = isRecord(raw.data) ? raw.data : raw;

  const categories = sanitiseCategories(source.shortcutCategories);
  const widgets = sanitiseWidgets(source.widgets);
  const ownership = buildOwnership(widgets);
  const settings = sanitiseSettings(source.settings);
  const rawWidgetSettings = isRecord(source.widgetSettings) ? source.widgetSettings : {};
  // v1 stored settings under widget type names. v2 stores them under instance
  // ids. Accept both so upgrades and old backups keep every preference.
  const hasLegacySettings = Object.keys(rawWidgetSettings).some((key) =>
    (WIDGET_TYPES as readonly string[]).includes(key),
  );

  const widgetSettings: Record<string, AnyWidgetSettings> = {};
  for (const widget of widgets) {
    const instanceSettings = rawWidgetSettings[widget.id];
    const legacySettings = hasLegacySettings ? rawWidgetSettings[widget.type] : undefined;
    widgetSettings[widget.id] = sanitiseWidgetSettingsFor(
      widget.type,
      instanceSettings ?? legacySettings,
    );
  }

  const data: PortalData = {
    version: CURRENT_DATA_VERSION,
    settings,
    shortcuts: sanitiseShortcuts(source.shortcuts, categories),
    shortcutCategories: categories,
    widgets,
    widgetSettings,
    notes: sanitiseNotes(source.notes, ownership),
    tasks: sanitiseTasks(source.tasks, ownership),
    calendarEvents: sanitiseEvents(source.calendarEvents, ownership),
    bookmarks: sanitiseBookmarks(source.bookmarks, ownership),
    searchHistory: sanitiseHistory(source.searchHistory),
  };

  return reconcileLayout(data);
}

export function migratePortalData(raw: unknown): PortalData {
  if (!isRecord(raw)) return createDefaultPortalData();
  const version = typeof raw.version === 'number' ? raw.version : 0;
  // Version 0 was the pre-release storage shape. v1 used type-keyed widget
  // settings and global content; v2 uses instance ids and per-widget content.
  // Normalisation doubles as the migration step for every older shape.
  if (version > CURRENT_DATA_VERSION) {
    // Never discard a newer backup. Normalisation will keep every field it
    // understands while ignoring future additions.
    return normalisePortalData(raw);
  }
  return normalisePortalData(raw);
}

export function createBackupEnvelope(data: PortalData, backgroundImage?: string) {
  return {
    app: 'retroportal',
    version: CURRENT_DATA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    ...(backgroundImage ? { backgroundImage } : {}),
  };
}

export function validateBackgroundDataUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)) return null;
  if (value.length > 6_000_000) return null;
  return value;
}

export function parseBackup(raw: unknown): { data: PortalData; backgroundImage?: string } {
  if (!isRecord(raw)) throw new Error('The selected file is not a RetroPortal backup.');
  const source = isRecord(raw.data) ? raw.data : raw;
  if (!isRecord(source)) throw new Error('The backup does not contain any settings.');
  if ('app' in raw && raw.app !== 'retroportal') {
    throw new Error('This JSON file was not exported by RetroPortal.');
  }
  return {
    data: normalisePortalData(source),
    backgroundImage: validateBackgroundDataUrl(raw.backgroundImage) ?? undefined,
  };
}

export function validateNewsDataset(raw: unknown): NewsDataset | null {
  if (!isRecord(raw) || !Array.isArray(raw.articles)) return null;
  const updatedAt = str(raw.updatedAt, new Date().toISOString(), 40);
  const articles: NewsArticle[] = raw.articles
    .map((item): NewsArticle | null => {
      if (!isRecord(item)) return null;
      const title = str(item.title, '', 300).trim();
      const source = str(item.source, '', 80).trim();
      const url = safeHttpUrl(str(item.url, '', 1000));
      if (!title || !source || !url) return null;
      const category = ALL_NEWS_CATEGORIES.includes(item.category as NewsCategory)
        ? (item.category as NewsCategory)
        : 'uk';
      const publishedAt = str(item.publishedAt, updatedAt, 40);
      return {
        id: safeId(item.id, 'article'),
        title,
        source,
        sourceUrl: safeHttpUrl(str(item.sourceUrl ?? '', '', 1000)) ?? undefined,
        url,
        publishedAt,
        category,
        summary: str(item.summary ?? '', '', 500) || undefined,
      } satisfies NewsArticle;
    })
    .filter((item): item is NewsArticle => item !== null)
    .slice(0, 500);

  return {
    version: 1,
    updatedAt,
    generatedAt: str(raw.generatedAt ?? '', '', 40) || undefined,
    articles,
    feeds: Array.isArray(raw.feeds)
      ? raw.feeds
          .map((feed) => {
            if (!isRecord(feed)) return null;
            return {
              id: safeId(feed.id, 'feed'),
              name: str(feed.name, '', 80),
              url: safeHttpUrl(str(feed.url ?? '', '', 500)) ?? '',
              ok: bool(feed.ok, false),
              error: str(feed.error ?? '', '', 200) || undefined,
              count: num(feed.count, 0, 0, 500),
            };
          })
          .filter((feed): feed is NonNullable<typeof feed> => feed !== null)
      : undefined,
  };
}

export function themeColoursForPreset(id: string): ThemeColours {
  return { ...themeById(id).colours };
}

export function gradientById(id: string): string {
  return BACKGROUND_GRADIENTS.find((gradient) => gradient.id === id)?.value ?? BACKGROUND_GRADIENTS[0].value;
}

export function newsCategoryLabel(category: NewsCategory): string {
  return NEWS_CATEGORY_LABELS[category];
}
