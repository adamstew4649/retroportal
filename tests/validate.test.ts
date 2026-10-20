import { describe, expect, it } from 'vitest';
import {
  createBackupEnvelope,
  migratePortalData,
  normalisePortalData,
  parseBackup,
  validateBackgroundDataUrl,
  validateNewsDataset,
} from '../src/services/storage/validate';
import { createDefaultPortalData, CURRENT_DATA_VERSION } from '../src/config/defaults';

describe('normalisePortalData', () => {
  it('returns defaults for non-object input', () => {
    const data = normalisePortalData(null);
    expect(data.version).toBe(CURRENT_DATA_VERSION);
    expect(data.settings.portalName).toBe('RetroPortal');
    expect(data.widgets.length).toBeGreaterThan(0);
  });

  it('drops unknown widget types and reconciles the layout', () => {
    const data = normalisePortalData({
      widgets: [
        { id: 'widget-clock-1', type: 'clock', collapsed: false },
        { id: 'widget-evil', type: 'iframe', collapsed: false },
      ],
      settings: {
        layout: {
          columns: 2,
          positions: [['widget-clock-1', 'widget-evil'], ['widget-clock-1']],
        },
      },
    });
    expect(data.widgets.map((widget) => widget.id)).toEqual(['widget-clock-1']);
    const placed = data.settings.layout.positions.flat();
    expect(placed).toEqual(['widget-clock-1']);
    expect(data.settings.layout.positions).toHaveLength(2);
  });

  it('adds widgets missing from positions to the shortest column', () => {
    const data = normalisePortalData({
      widgets: [
        { id: 'widget-clock-1', type: 'clock', collapsed: false },
        { id: 'widget-weather-1', type: 'weather', collapsed: false },
      ],
      settings: {
        layout: { columns: 2, positions: [['widget-clock-1'], []] },
      },
    });
    const placed = data.settings.layout.positions.flat();
    expect(placed).toContain('widget-clock-1');
    expect(placed).toContain('widget-weather-1');
    expect(placed).toHaveLength(2);
  });

  it('clamps layout columns and gap to supported ranges', () => {
    const data = normalisePortalData({
      settings: { layout: { columns: 99, gap: 999, positions: [] } },
    });
    expect(data.settings.layout.columns).toBe(4);
    expect(data.settings.layout.gap).toBe(32);
  });

  it('removes unsafe shortcut URLs', () => {
    const data = normalisePortalData({
      shortcutCategories: [{ id: 'everyday', name: 'Everyday' }],
      shortcuts: [
        { id: 'safe', label: 'Safe', url: 'https://example.com/', categoryId: 'everyday' },
        { id: 'unsafe', label: 'Unsafe', url: 'javascript:alert(1)', categoryId: 'everyday' },
      ],
    });
    expect(data.shortcuts.map((shortcut) => shortcut.id)).toEqual(['safe']);
  });

  it('deduplicates widgets, notes and search history', () => {
    const data = normalisePortalData({
      widgets: [
        { id: 'same', type: 'clock', collapsed: false },
        { id: 'same', type: 'weather', collapsed: false },
      ],
      notes: [
        { id: 'note', title: 'One', body: '', colour: 'yellow', updatedAt: 1 },
        { id: 'note', title: 'Two', body: '', colour: 'blue', updatedAt: 2 },
      ],
      searchHistory: [
        { query: 'Weather', at: 2 },
        { query: 'weather', at: 1 },
      ],
    });
    expect(data.widgets).toHaveLength(1);
    expect(data.notes).toHaveLength(1);
    expect(data.searchHistory).toHaveLength(1);
    expect(data.searchHistory[0].at).toBe(2);
  });
});

describe('migratePortalData', () => {
  it('treats legacy data as v0 and normalises it', () => {
    const migrated = migratePortalData({
      version: 0,
      settings: { portalName: 'Legacy Portal' },
    });
    expect(migrated.version).toBe(CURRENT_DATA_VERSION);
    expect(migrated.settings.portalName).toBe('Legacy Portal');
  });

  it('keeps fields it understands from newer backups', () => {
    const migrated = migratePortalData({
      version: 99,
      settings: { portalName: 'Future Portal' },
    });
    expect(migrated.version).toBe(CURRENT_DATA_VERSION);
    expect(migrated.settings.portalName).toBe('Future Portal');
  });
});

describe('backup envelopes', () => {
  it('round-trips exported data', () => {
    const data = createDefaultPortalData();
    data.settings.portalName = 'My Portal';
    const envelope = createBackupEnvelope(data);
    const parsed = parseBackup(JSON.parse(JSON.stringify(envelope)));
    expect(parsed.data.settings.portalName).toBe('My Portal');
    expect(parsed.backgroundImage).toBeUndefined();
  });

  it('rejects files exported by a different app', () => {
    expect(() => parseBackup({ app: 'other', data: {} })).toThrow(/not exported by RetroPortal/);
  });

  it('rejects non-object input', () => {
    expect(() => parseBackup('not json')).toThrow(/not a RetroPortal backup/);
  });

  it('only accepts safe raster data URLs for backgrounds', () => {
    expect(validateBackgroundDataUrl('data:image/png;base64,AAAA')).toBe(
      'data:image/png;base64,AAAA',
    );
    expect(
      validateBackgroundDataUrl('data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+'),
    ).toBeNull();
    expect(validateBackgroundDataUrl('data:text/html;base64,AAAA')).toBeNull();
    expect(validateBackgroundDataUrl('not a data url')).toBeNull();
  });

  it('includes a valid background image in a backup', () => {
    const data = createDefaultPortalData();
    const image = 'data:image/png;base64,AAAA';
    const parsed = parseBackup(JSON.parse(JSON.stringify(createBackupEnvelope(data, image))));
    expect(parsed.backgroundImage).toBe(image);
  });
});

describe('validateNewsDataset', () => {
  const validArticle = {
    id: 'article-1',
    title: 'A headline',
    source: 'BBC News',
    url: 'https://www.bbc.co.uk/news/uk-1',
    publishedAt: '2026-10-20T10:00:00Z',
    category: 'uk',
  };

  it('accepts a valid dataset and filters invalid articles', () => {
    const dataset = validateNewsDataset({
      updatedAt: '2026-10-20T10:00:00Z',
      articles: [
        validArticle,
        { ...validArticle, id: 'bad-url', url: 'javascript:alert(1)' },
        { ...validArticle, id: 'no-title', title: '' },
        { ...validArticle, id: 'unknown-category', category: 'celebrity' },
      ],
    });
    expect(dataset).not.toBeNull();
    expect(dataset?.articles).toHaveLength(2);
    expect(dataset?.articles[1].category).toBe('uk');
  });

  it('returns null when articles are missing', () => {
    expect(validateNewsDataset({ updatedAt: '2026-10-20T10:00:00Z' })).toBeNull();
    expect(validateNewsDataset(null)).toBeNull();
  });
});
