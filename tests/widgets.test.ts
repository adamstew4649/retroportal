import { describe, expect, it } from 'vitest';
import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  createDefaultPortalData,
} from '../src/config/defaults';
import { loadPortalData, type StorageAdapter } from '../src/services/storage/localStorage';
import { WIDGET_REGISTRY, WIDGET_TYPES_ORDER } from '../src/widgets/registry';
import { WIDGET_TYPES } from '../src/types';
import {
  addWidgetToData,
  removeWidgetFromData,
  restoreDefaultWidgets,
  widgetContentCount,
} from '../src/widgets/lifecycle';
import { createDefaultWidgetSettings } from '../src/widgets/defaults';
import { normalisePortalData } from '../src/services/storage/validate';

describe('widget manifests', () => {
  it('discovers a manifest for every supported type', () => {
    expect(WIDGET_TYPES_ORDER.slice().sort()).toEqual([...WIDGET_TYPES].sort());
    expect(new Set(WIDGET_TYPES_ORDER).size).toBe(WIDGET_TYPES_ORDER.length);
    for (const type of WIDGET_TYPES) {
      expect(WIDGET_REGISTRY[type]).toMatchObject({
        type,
        title: expect.any(String),
        description: expect.any(String),
      });
      expect(WIDGET_REGISTRY[type].Component).toBeTypeOf('function');
      expect(WIDGET_REGISTRY[type].Settings).toBeTypeOf('function');
      expect(WIDGET_REGISTRY[type].createDefaultSettings()).toEqual(
        createDefaultWidgetSettings(type),
      );
    }
  });
});

describe('widget instances', () => {
  it('seeds per-instance settings and owned content', () => {
    const data = createDefaultPortalData();
    for (const widget of data.widgets) {
      expect(data.widgetSettings[widget.id]).toEqual(createDefaultWidgetSettings(widget.type));
    }
    expect(data.notes.every((note) => note.widgetId === 'widget-notes')).toBe(true);
    expect(data.tasks.every((task) => task.widgetId === 'widget-todo')).toBe(true);
    expect(data.bookmarks.every((category) => category.widgetId === 'widget-bookmarks')).toBe(
      true,
    );
  });

  it('allows several instances of the same type with independent settings', () => {
    let data = createDefaultPortalData();
    data = addWidgetToData(data, 'clock');
    const clocks = data.widgets.filter((widget) => widget.type === 'clock');
    expect(clocks).toHaveLength(2);

    const second = clocks[1];
    data.widgetSettings[second.id] = {
      ...createDefaultWidgetSettings('clock'),
      timeZone: 'Asia/Tokyo',
      hour12: true,
    };

    expect(data.widgetSettings['widget-clock']).toMatchObject({
      timeZone: 'Europe/London',
      hour12: false,
    });
    expect(data.widgetSettings[second.id]).toMatchObject({
      timeZone: 'Asia/Tokyo',
      hour12: true,
    });
  });

  it('keeps content private to its widget and deletes it with the widget', () => {
    let data = createDefaultPortalData();
    data = addWidgetToData(data, 'notes');
    const notesWidget = data.widgets.filter((widget) => widget.type === 'notes').at(-1)!;
    expect(widgetContentCount(data, notesWidget)).toBe(0);

    data = {
      ...data,
      notes: [
        ...data.notes,
        {
          id: 'note-private',
          widgetId: notesWidget.id,
          title: 'Private',
          body: '',
          colour: 'yellow',
          updatedAt: Date.now(),
        },
      ],
    };
    expect(widgetContentCount(data, notesWidget)).toBe(1);

    data = removeWidgetFromData(data, notesWidget.id);
    expect(data.notes.some((note) => note.id === 'note-private')).toBe(false);
    expect(data.widgetSettings[notesWidget.id]).toBeUndefined();
    expect(data.settings.layout.positions.flat()).not.toContain(notesWidget.id);
  });

  it('restores the default layout without losing owned content', () => {
    let data = createDefaultPortalData();
    data = addWidgetToData(data, 'notes');
    const extraNotes = data.widgets.filter((widget) => widget.type === 'notes').at(-1)!;
    data = {
      ...data,
      notes: [
        ...data.notes,
        {
          id: 'note-extra',
          widgetId: extraNotes.id,
          title: 'Extra',
          body: 'Keep me',
          colour: 'blue',
          updatedAt: Date.now(),
        },
      ],
    };

    data = restoreDefaultWidgets(data);
    expect(data.widgets.filter((widget) => widget.type === 'notes')).toHaveLength(1);
    expect(data.notes.some((note) => note.id === 'note-extra')).toBe(true);
    expect(data.notes.find((note) => note.id === 'note-extra')?.widgetId).toBe('widget-notes');
  });
});

describe('widget data migration', () => {
  it('moves v1 type-keyed settings and global content onto instances', () => {
    const migrated = normalisePortalData({
      version: 1,
      widgets: [
        { id: 'clock-1', type: 'clock', collapsed: false },
        { id: 'notes-1', type: 'notes', collapsed: false },
        { id: 'todo-1', type: 'todo', collapsed: false },
      ],
      widgetSettings: {
        clock: { analogue: true, hour12: true, showSeconds: true, timeZone: 'Asia/Tokyo' },
        notes: { tall: true },
        todo: { showCompleted: false },
      },
      notes: [{ id: 'legacy-note', title: 'Legacy', body: '', colour: 'yellow', updatedAt: 1 }],
      tasks: [{ id: 'legacy-task', title: 'Legacy task', completed: false, createdAt: 1 }],
    });

    expect(migrated.widgetSettings['clock-1']).toMatchObject({
      analogue: true,
      timeZone: 'Asia/Tokyo',
    });
    expect(migrated.widgetSettings['notes-1']).toEqual({ tall: true });
    expect(migrated.widgetSettings['todo-1']).toEqual({ showCompleted: false });
    expect(migrated.notes[0].widgetId).toBe('notes-1');
    expect(migrated.tasks[0].widgetId).toBe('todo-1');
  });

  it('upgrades legacy storage keys in place', () => {
    const values = new Map<string, string>();
    const storage: StorageAdapter = {
      read: (key) => values.get(key) ?? null,
      write: (key, value) => {
        values.set(key, value);
      },
      remove: (key) => {
        values.delete(key);
      },
    };
    values.set(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        widgets: [{ id: 'clock-legacy', type: 'clock', collapsed: false }],
        widgetSettings: {
          clock: { analogue: true, hour12: true, showSeconds: false, timeZone: 'UTC' },
        },
      }),
    );

    const loaded = loadPortalData(storage);
    expect(loaded.version).toBe(2);
    expect(loaded.widgetSettings['clock-legacy']).toMatchObject({
      analogue: true,
      hour12: true,
      timeZone: 'UTC',
    });
    expect(values.has(STORAGE_KEY)).toBe(true);
    expect(values.has(LEGACY_STORAGE_KEY)).toBe(false);
  });

  it('keeps settings isolated when duplicate types are imported', () => {
    const migrated = normalisePortalData({
      version: 2,
      widgets: [
        { id: 'clock-a', type: 'clock', collapsed: false },
        { id: 'clock-b', type: 'clock', collapsed: false },
      ],
      widgetSettings: {
        'clock-a': { analogue: true, hour12: true, showSeconds: true, timeZone: 'UTC' },
        'clock-b': { analogue: false, hour12: false, showSeconds: false, timeZone: 'Asia/Tokyo' },
      },
    });
    expect(migrated.widgetSettings['clock-a']).toMatchObject({ timeZone: 'UTC', analogue: true });
    expect(migrated.widgetSettings['clock-b']).toMatchObject({
      timeZone: 'Asia/Tokyo',
      analogue: false,
    });
  });
});
