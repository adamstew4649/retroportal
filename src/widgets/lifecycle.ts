import { createDefaultPortalData, defaultWidgetId } from '../config/defaults';
import type {
  BookmarkCategory,
  CalendarEvent,
  Note,
  PortalData,
  Task,
  WidgetInstance,
  WidgetSettingsMap,
  WidgetType,
} from '../types';
import { createDefaultWidgetSettings } from './defaults';

type Settings = WidgetSettingsMap[WidgetType];

function shortestColumn(positions: string[][]): number {
  if (positions.length === 0) return 0;
  let target = 0;
  for (let index = 1; index < positions.length; index += 1) {
    if (positions[index].length < positions[target].length) target = index;
  }
  return target;
}

function claimOrphanedNotes(notes: Note[], widgetId: string): Note[] {
  return notes.map((note) => (note.widgetId ? note : { ...note, widgetId }));
}

function claimOrphanedTasks(tasks: Task[], widgetId: string): Task[] {
  return tasks.map((task) => (task.widgetId ? task : { ...task, widgetId }));
}

function claimOrphanedEvents(events: CalendarEvent[], widgetId: string): CalendarEvent[] {
  return events.map((event) => (event.widgetId ? event : { ...event, widgetId }));
}

function claimOrphanedBookmarks(
  categories: BookmarkCategory[],
  widgetId: string,
): BookmarkCategory[] {
  return categories.map((category) =>
    category.widgetId ? category : { ...category, widgetId },
  );
}

/**
 * Add a widget instance, seed its settings and place it in the shortest
 * column. Content widgets keep their data private to the instance. If this is
 * the first widget of its type, any orphaned legacy content is adopted.
 */
export function addWidgetToData(data: PortalData, type: WidgetType): PortalData {
  const widget: WidgetInstance = {
    id: defaultWidgetId(type),
    type,
    collapsed: false,
  };
  const positions = data.settings.layout.positions.map((column) => [...column]);
  if (positions.length === 0) positions.push([]);
  positions[shortestColumn(positions)].push(widget.id);

  const wasFirstOfType = !data.widgets.some((item) => item.type === type);
  const next: PortalData = {
    ...data,
    widgets: [...data.widgets, widget],
    widgetSettings: {
      ...data.widgetSettings,
      [widget.id]: createDefaultWidgetSettings(type),
    },
    settings: {
      ...data.settings,
      layout: { ...data.settings.layout, positions },
    },
  };

  if (!wasFirstOfType) return next;

  switch (type) {
    case 'notes':
      return { ...next, notes: claimOrphanedNotes(next.notes, widget.id) };
    case 'todo':
      return { ...next, tasks: claimOrphanedTasks(next.tasks, widget.id) };
    case 'calendar':
      return { ...next, calendarEvents: claimOrphanedEvents(next.calendarEvents, widget.id) };
    case 'bookmarks':
      return { ...next, bookmarks: claimOrphanedBookmarks(next.bookmarks, widget.id) };
    default:
      return next;
  }
}

/**
 * Remove a widget instance, its settings, its layout entry and any content it
 * owns. Orphaned content is left untouched so it can be adopted later.
 */
export function removeWidgetFromData(data: PortalData, widgetId: string): PortalData {
  return {
    ...data,
    widgets: data.widgets.filter((widget) => widget.id !== widgetId),
    widgetSettings: Object.fromEntries(
      Object.entries(data.widgetSettings).filter(([id]) => id !== widgetId),
    ),
    notes: data.notes.filter((note) => note.widgetId !== widgetId),
    tasks: data.tasks.filter((task) => task.widgetId !== widgetId),
    calendarEvents: data.calendarEvents.filter((event) => event.widgetId !== widgetId),
    bookmarks: data.bookmarks.filter((category) => category.widgetId !== widgetId),
    settings: {
      ...data.settings,
      layout: {
        ...data.settings.layout,
        positions: data.settings.layout.positions.map((column) =>
          column.filter((id) => id !== widgetId),
        ),
      },
    },
  };
}

/**
 * Replace the dashboard with the default widget set while preserving as much
 * user data as possible: settings come from the first existing instance of
 * each type, and all content is reassigned to the new default instance.
 */
export function restoreDefaultWidgets(data: PortalData): PortalData {
  const defaults = createDefaultPortalData();
  const firstCurrentByType = new Map<WidgetType, WidgetInstance>();
  for (const widget of data.widgets) {
    if (!firstCurrentByType.has(widget.type)) firstCurrentByType.set(widget.type, widget);
  }

  const widgetSettings: Record<string, Settings> = {};
  for (const widget of defaults.widgets) {
    const current = firstCurrentByType.get(widget.type);
    widgetSettings[widget.id] = {
      ...(current
        ? (data.widgetSettings[current.id] ?? defaults.widgetSettings[widget.id])
        : defaults.widgetSettings[widget.id]),
    };
  }

  const defaultIdForType = (type: WidgetType): string | undefined =>
    defaults.widgets.find((widget) => widget.type === type)?.id;

  const reassign = <T extends { widgetId?: string }>(
    items: T[],
    type: WidgetType,
  ): T[] => {
    const target = defaultIdForType(type);
    if (!target) return items;
    return items.map((item) => ({ ...item, widgetId: target }));
  };

  return {
    ...data,
    widgets: defaults.widgets.map((widget) => ({ ...widget })),
    widgetSettings,
    settings: {
      ...data.settings,
      layout: {
        ...data.settings.layout,
        columns: 3,
        positions: defaults.settings.layout.positions,
      },
    },
    notes: reassign(data.notes, 'notes'),
    tasks: reassign(data.tasks, 'todo'),
    calendarEvents: reassign(data.calendarEvents, 'calendar'),
    bookmarks: reassign(data.bookmarks, 'bookmarks'),
  };
}

export function widgetContentCount(data: PortalData, widget: WidgetInstance): number {
  switch (widget.type) {
    case 'notes':
      return data.notes.filter((note) => note.widgetId === widget.id).length;
    case 'todo':
      return data.tasks.filter((task) => task.widgetId === widget.id).length;
    case 'calendar':
      return data.calendarEvents.filter((event) => event.widgetId === widget.id).length;
    case 'bookmarks':
      return data.bookmarks.filter((category) => category.widgetId === widget.id).length;
    default:
      return 0;
  }
}
