import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  DatabaseBackup,
  Info,
  LayoutGrid,
  Newspaper,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Download,
  RotateCcw,
  TriangleAlert,
  ExternalLink,
} from 'lucide-react';
import { Modal } from '../Modal/Modal';
import { usePortal } from '../../state/PortalContext';
import { useToast } from '../../state/ToastContext';
import { useNews } from '../../state/NewsContext';
import {
  BACKGROUND_GRADIENTS,
  THEME_PRESETS,
  type ThemePreset,
} from '../../themes/presets';
import {
  ALL_NEWS_CATEGORIES,
  NEWS_CATEGORY_LABELS,
  createDefaultPortalData,
} from '../../config/defaults';
import { WIDGET_REGISTRY, WIDGET_TYPES_ORDER } from '../../widgets/registry';
import {
  addWidgetToData,
  restoreDefaultWidgets as restoreDefaultWidgetsInData,
} from '../../widgets/lifecycle';
import { fileToDataUrl, loadBackgroundImage } from '../../services/storage/imageStore';
import { parseBackup, createBackupEnvelope } from '../../services/storage/validate';
import { safeDataUrl, safeHttpUrl } from '../../utils/url';
import { validateEngineTemplate } from '../../services/search/engines';
import { createId } from '../../utils/id';
import {
  isExtensionContext,
  openExtensionOptions,
} from '../../services/extension';
import type {
  AppearanceSettings,
  ColumnCount,
  NewsCategory,
  PortalData,
  SearchEngine,
  ThemeColours,
  WidgetType,
} from '../../types';
import './settings.css';

type SettingsTab = 'appearance' | 'layout' | 'search' | 'news' | 'data' | 'about';

interface SettingsModalProps {
  open: boolean;
  initialTab?: SettingsTab;
  onClose: () => void;
}

const TABS: Array<{ id: SettingsTab; label: string; icon: typeof Palette }> = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'layout', label: 'Layout', icon: LayoutGrid },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'data', label: 'Backup & data', icon: DatabaseBackup },
  { id: 'about', label: 'About', icon: Info },
];

const COLOUR_FIELDS: Array<{ key: keyof ThemeColours; label: string }> = [
  { key: 'bg', label: 'Page background' },
  { key: 'contentBg', label: 'Main content' },
  { key: 'widgetBg', label: 'Widget body' },
  { key: 'headerTop', label: 'Header gradient top' },
  { key: 'headerBottom', label: 'Header gradient bottom' },
  { key: 'accent', label: 'Accent' },
  { key: 'text', label: 'Primary text' },
  { key: 'muted', label: 'Secondary text' },
  { key: 'border', label: 'Borders' },
];

function applyPresetToAppearance(preset: ThemePreset, current: AppearanceSettings): AppearanceSettings {
  return {
    ...current,
    themeId: preset.id,
    colours: { ...preset.colours },
    background: {
      ...current.background,
      type: 'gradient',
      colour: preset.background.colour,
      gradient: preset.background.gradient,
      overlay: preset.background.overlay,
      imageId: undefined,
      imageUrl: undefined,
    },
  };
}

export function SettingsModal({ open, initialTab = 'appearance', onClose }: SettingsModalProps) {
  const { data, setData, updateSettings, updateAppearance, updateLayout, importPortalData, resetEverything, applyBackgroundImage, removeBackgroundImage, backgroundImageUrl } = usePortal();
  const { notify } = useToast();
  const { status, updatedAt, error, lastChecked, refresh, refreshing } = useNews();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const appearance = data.settings.appearance;
  const background = appearance.background;
  const [engineName, setEngineName] = useState('');
  const [engineTemplate, setEngineTemplate] = useState('');
  const [engineError, setEngineError] = useState<string | null>(null);
  const [datasetDraft, setDatasetDraft] = useState(data.settings.news.datasetUrl);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageUrlDraft, setImageUrlDraft] = useState(background.imageUrl ?? '');
  const importInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    setImageUrlDraft(background.imageUrl ?? '');
  }, [background.imageUrl, background.imageId]);

  useEffect(() => {
    setDatasetDraft(data.settings.news.datasetUrl);
  }, [data.settings.news.datasetUrl]);

  const setColour = (key: keyof ThemeColours, value: string) => {
    updateAppearance({
      themeId: 'custom',
      colours: { ...appearance.colours, [key]: value },
    });
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      await applyBackgroundImage(dataUrl);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'The image could not be loaded.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const setColumns = (columns: ColumnCount) => {
    setData((current) => {
      const allIds = current.widgets.map((widget) => widget.id);
      const flat = current.settings.layout.positions.flat();
      for (const id of allIds) if (!flat.includes(id)) flat.push(id);
      const positions: string[][] = Array.from({ length: columns }, () => []);
      flat.forEach((id, index) => positions[index % columns].push(id));
      return {
        ...current,
        settings: {
          ...current.settings,
          layout: { ...current.settings.layout, columns, positions },
        },
      };
    });
  };

  const addWidget = (type: WidgetType) => {
    setData((current) => addWidgetToData(current, type));
    notify(`${WIDGET_REGISTRY[type].title} widget added.`, 'success');
  };

  const resetWidgetPositions = () => {
    if (!window.confirm('Reset widget positions using the current widgets?')) return;
    setData((current) => {
      const order = current.widgets
        .slice()
        .sort(
          (a, b) =>
            WIDGET_TYPES_ORDER.indexOf(a.type) - WIDGET_TYPES_ORDER.indexOf(b.type),
        )
        .map((widget) => widget.id);
      const positions = Array.from(
        { length: current.settings.layout.columns },
        (): string[] => [],
      );
      order.forEach((id, index) => positions[index % positions.length].push(id));
      return {
        ...current,
        settings: {
          ...current.settings,
          layout: { ...current.settings.layout, positions },
        },
      };
    });
    notify('Widget positions reset.', 'success');
  };

  const restoreDefaultWidgets = () => {
    if (
      !window.confirm(
        'Restore all nine default widgets? Your layout will be replaced, but your notes, tasks, events and bookmarks will be preserved.',
      )
    ) {
      return;
    }
    setData(restoreDefaultWidgetsInData);
    notify('Default widgets restored.', 'success');
  };

  const addEngine = () => {
    const name = engineName.trim();
    const template = engineTemplate.trim();
    if (!name) {
      setEngineError('Give the search engine a name.');
      return;
    }
    const templateError = validateEngineTemplate(template);
    if (templateError) {
      setEngineError(templateError);
      return;
    }
    const engine: SearchEngine = {
      id: createId('engine'),
      name: name.slice(0, 40),
      template,
      colour: appearance.colours.accent,
      builtin: false,
    };
    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        search: {
          ...current.settings.search,
          customEngines: [...current.settings.search.customEngines, engine],
        },
      },
    }));
    setEngineName('');
    setEngineTemplate('');
    setEngineError(null);
    notify('Custom search engine added.', 'success');
  };

  const removeEngine = (id: string) => {
    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        search: {
          ...current.settings.search,
          engineId: current.settings.search.engineId === id ? 'google' : current.settings.search.engineId,
          customEngines: current.settings.search.customEngines.filter((engine) => engine.id !== id),
        },
      },
    }));
  };

  const applyDatasetUrl = () => {
    const safe = safeDataUrl(datasetDraft);
    if (!safe) {
      setDatasetError('Enter a relative data path or an https:// JSON address.');
      return;
    }
    setDatasetError(null);
    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        news: { ...current.settings.news, datasetUrl: safe },
      },
    }));
    notify('News data endpoint updated.', 'success');
  };

  const toggleTickerCategory = (category: NewsCategory) => {
    const current = data.settings.news.tickerCategories;
    const next = current.includes(category)
      ? current.filter((item) => item !== category)
      : [...current, category];
    setData((state) => ({
      ...state,
      settings: {
        ...state.settings,
        news: { ...state.settings.news, tickerCategories: next },
      },
    }));
  };

  const exportBackup = async () => {
    try {
      const imageId = background.imageId;
      const loadedImage = imageId ? await loadBackgroundImage(imageId) : null;
      const image = loadedImage && loadedImage.length <= 6_000_000 ? loadedImage : undefined;
      const envelope = createBackupEnvelope(data, image);
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `retroportal-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify('Backup exported.', 'success');
    } catch {
      notify('The backup could not be created.', 'error');
    }
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 8_000_000) {
        throw new Error('That backup is larger than 8 MB and cannot be imported.');
      }
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const backup = parseBackup(parsed);
      if (!window.confirm('Import this backup? It will replace all current RetroPortal settings and personal data.')) {
        return;
      }
      await importPortalData(backup.data, backup.backgroundImage);
    } catch (caught) {
      notify(
        caught instanceof Error ? caught.message : 'That file could not be imported.',
        'error',
      );
    }
  };

  const resetSection = (kind: 'appearance' | 'layout' | 'search' | 'news' | 'personal' | 'bookmarks') => {
    const defaults = createDefaultPortalData();
    const messages: Record<typeof kind, string> = {
      appearance: 'Reset appearance and background to the Classic iGoogle Dark defaults?',
      layout: 'Restore the default three-column widget layout?',
      search: 'Reset search preferences and clear search history?',
      news: 'Reset news and ticker preferences?',
      personal: 'Delete all notes, tasks and calendar events?',
      bookmarks: 'Restore the default bookmark categories and links?',
    };
    if (!window.confirm(messages[kind])) return;
    setData((current) => {
      switch (kind) {
        case 'appearance':
          return {
            ...current,
            settings: { ...current.settings, appearance: defaults.settings.appearance },
          };
        case 'layout':
          return restoreDefaultWidgetsInData(current);
        case 'search':
          return {
            ...current,
            searchHistory: [],
            settings: { ...current.settings, search: defaults.settings.search },
          };
        case 'news':
          return {
            ...current,
            settings: { ...current.settings, news: defaults.settings.news },
          };
        case 'personal':
          return { ...current, notes: [], tasks: [], calendarEvents: [] };
        case 'bookmarks': {
          const target = current.widgets.find((widget) => widget.type === 'bookmarks')?.id;
          return {
            ...current,
            bookmarks: target
              ? defaults.bookmarks.map((category) => ({ ...category, widgetId: target }))
              : [],
          };
        }
      }
    });
    notify('Section reset.', 'success');
  };

  const fullReset = async () => {
    if (
      !window.confirm(
        'Reset everything? All notes, tasks, events, shortcuts, bookmarks, themes and preferences will be deleted and replaced with the defaults.',
      )
    ) {
      return;
    }
    await resetEverything();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="RetroPortal Settings"
      icon={<Palette size={16} aria-hidden="true" />}
      className="settings-modal"
      footer={
        <>
          <span className="settings-footer-note">
            Preferences save automatically in this browser.
          </span>
          <button type="button" className="glossy-button glossy-button--primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`settings-tab${tab === item.id ? ' settings-tab--active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="settings-panel" role="tabpanel">
        {tab === 'appearance' && (
          <div className="settings-section">
            <section>
              <h3 className="settings-heading">Theme presets</h3>
              <div className="theme-grid">
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`theme-card${appearance.themeId === preset.id ? ' theme-card--active' : ''}`}
                    onClick={() => updateAppearance(applyPresetToAppearance(preset, appearance))}
                    title={preset.description}
                  >
                    <span className="theme-card__preview" aria-hidden="true">
                      <span style={{ background: preset.colours.headerTop }} />
                      <span style={{ background: preset.colours.widgetBg }} />
                      <span style={{ background: preset.colours.accent }} />
                      <span style={{ background: preset.colours.border }} />
                    </span>
                    <span className="theme-card__name">{preset.name}</span>
                    <span className="theme-card__description">{preset.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="settings-heading">Portal identity</h3>
              <div className="form-grid">
                <label>
                  <span className="field-label">Portal name</span>
                  <input
                    className="retro-field"
                    value={data.settings.portalName}
                    maxLength={40}
                    onChange={(event) => updateSettings({ portalName: event.target.value })}
                  />
                </label>
                <label className="retro-check settings-check-row">
                  <input
                    type="checkbox"
                    checked={data.settings.showTabs}
                    onChange={(event) => updateSettings({ showTabs: event.target.checked })}
                  />
                  Show classic navigation tabs
                </label>
              </div>
            </section>

            <section>
              <h3 className="settings-heading">Colours</h3>
              <p className="settings-help">
                Editing a colour switches the theme to Custom. Theme presets can be reapplied at any
                time.
              </p>
              <div className="colour-grid">
                {COLOUR_FIELDS.map((field) => (
                  <label className="colour-field" key={field.key}>
                    <input
                      type="color"
                      value={appearance.colours[field.key]}
                      onChange={(event) => setColour(field.key, event.target.value)}
                      aria-label={field.label}
                    />
                    <span className="colour-field__text">
                      <span>{field.label}</span>
                      <code>{appearance.colours[field.key]}</code>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section>
              <h3 className="settings-heading">Background</h3>
              <div className="segmented" role="radiogroup" aria-label="Background type">
                {(['colour', 'gradient', 'image'] as const).map((type) => (
                  <label key={type} className="segmented__option">
                    <input
                      type="radio"
                      name="background-type"
                      checked={background.type === type}
                      onChange={() =>
                        updateAppearance({
                          background: { ...background, type },
                        })
                      }
                    />
                    <span>{type === 'colour' ? 'Solid colour' : type === 'gradient' ? 'Gradient' : 'Image'}</span>
                  </label>
                ))}
              </div>

              {background.type === 'colour' && (
                <label className="colour-field settings-inline-colour">
                  <input
                    type="color"
                    value={background.colour}
                    onChange={(event) =>
                      updateAppearance({
                        background: { ...background, colour: event.target.value },
                      })
                    }
                    aria-label="Background colour"
                  />
                  <span className="colour-field__text">
                    <span>Background colour</span>
                    <code>{background.colour}</code>
                  </span>
                </label>
              )}

              {background.type === 'gradient' && (
                <div className="form-stack">
                  <label>
                    <span className="field-label">Gradient preset</span>
                    <select
                      className="retro-select"
                      value={
                        BACKGROUND_GRADIENTS.find((item) => item.value === background.gradient)?.id ?? 'custom'
                      }
                      onChange={(event) => {
                        const selected = BACKGROUND_GRADIENTS.find((item) => item.id === event.target.value);
                        if (selected) {
                          updateAppearance({
                            background: { ...background, gradient: selected.value },
                          });
                        }
                      }}
                    >
                      {BACKGROUND_GRADIENTS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                      <option value="custom">Custom CSS gradient</option>
                    </select>
                  </label>
                  <label>
                    <span className="field-label">CSS gradient</span>
                    <textarea
                      className="retro-textarea"
                      value={background.gradient}
                      rows={2}
                      spellCheck={false}
                      onChange={(event) =>
                        updateAppearance({
                          background: { ...background, gradient: event.target.value },
                        })
                      }
                    />
                  </label>
                </div>
              )}

              {background.type === 'image' && (
                <div className="form-stack">
                  {backgroundImageUrl && (
                    <div className="background-preview">
                      <img src={backgroundImageUrl} alt="Current background preview" />
                    </div>
                  )}
                  <div className="field-row settings-wrap">
                    <input
                      ref={imageInput}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="visually-hidden"
                      onChange={(event) => void handleImageUpload(event)}
                    />
                    <button
                      type="button"
                      className="glossy-button"
                      onClick={() => imageInput.current?.click()}
                      disabled={uploading}
                    >
                      <Upload size={14} aria-hidden="true" />
                      {uploading ? 'Saving image…' : 'Upload image'}
                    </button>
                    {background.imageId && (
                      <button
                        type="button"
                        className="glossy-button glossy-button--danger"
                        onClick={() => void removeBackgroundImage()}
                      >
                        <Trash2 size={14} aria-hidden="true" /> Remove
                      </button>
                    )}
                  </div>
                  <label>
                    <span className="field-label">Or use an image URL</span>
                    <div className="field-row">
                      <input
                        className="retro-field"
                        type="url"
                        placeholder="https://example.com/background.jpg"
                        value={imageUrlDraft}
                        onChange={(event) => setImageUrlDraft(event.target.value)}
                      />
                      <button
                        type="button"
                        className="glossy-button"
                        onClick={() => {
                          const value = imageUrlDraft.trim();
                          if (!value) {
                            updateAppearance({
                              background: {
                                ...background,
                                imageUrl: undefined,
                                imageId: undefined,
                              },
                            });
                            return;
                          }
                          const safe = safeHttpUrl(value);
                          if (!safe) {
                            notify('Enter a valid http:// or https:// image address.', 'error');
                            return;
                          }
                          updateAppearance({
                            background: {
                              ...background,
                              type: 'image',
                              imageUrl: safe,
                              imageId: undefined,
                            },
                          });
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </label>
                  <p className="info-note">
                    Uploaded images are stored in IndexedDB (up to 6 MB) and are included in JSON
                    backups when they fit.
                  </p>
                </div>
              )}

              <label className="settings-slider">
                <span className="field-label">Image / background overlay: {Math.round(background.overlay * 100)}%</span>
                <input
                  className="retro-range"
                  type="range"
                  min={0}
                  max={0.85}
                  step={0.05}
                  value={background.overlay}
                  onChange={(event) =>
                    updateAppearance({
                      background: { ...background, overlay: Number(event.target.value) },
                    })
                  }
                />
              </label>
            </section>

            <section>
              <h3 className="settings-heading">Type &amp; shape</h3>
              <div className="form-grid">
                <label>
                  <span className="field-label">Font preset</span>
                  <select
                    className="retro-select"
                    value={appearance.fontPreset}
                    onChange={(event) =>
                      updateAppearance({ fontPreset: event.target.value as 'retro' | 'modern' })
                    }
                  >
                    <option value="retro">Retro (Trebuchet MS / Verdana)</option>
                    <option value="modern">Modern system fonts</option>
                  </select>
                </label>
                <label>
                  <span className="field-label">Density</span>
                  <select
                    className="retro-select"
                    value={appearance.density}
                    onChange={(event) =>
                      updateAppearance({ density: event.target.value as 'comfortable' | 'compact' })
                    }
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </label>
                <label>
                  <span className="field-label">Search bar style</span>
                  <select
                    className="retro-select"
                    value={appearance.searchBar}
                    onChange={(event) =>
                      updateAppearance({ searchBar: event.target.value as 'classic' | 'slim' })
                    }
                  >
                    <option value="classic">Classic glossy</option>
                    <option value="slim">Slim</option>
                  </select>
                </label>
                <label>
                  <span className="field-label">Shortcut layout</span>
                  <select
                    className="retro-select"
                    value={data.settings.shortcuts.style}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          shortcuts: {
                            ...current.settings.shortcuts,
                            style: event.target.value as 'large' | 'compact',
                          },
                        },
                      }))
                    }
                  >
                    <option value="large">Large buttons</option>
                    <option value="compact">Compact buttons</option>
                  </select>
                </label>
              </div>

              <div className="settings-slider-grid">
                <label className="settings-slider">
                  <span className="field-label">Base font size: {appearance.fontSize}px</span>
                  <input
                    className="retro-range"
                    type="range"
                    min={12}
                    max={20}
                    value={appearance.fontSize}
                    onChange={(event) => updateAppearance({ fontSize: Number(event.target.value) })}
                  />
                </label>
                <label className="settings-slider">
                  <span className="field-label">Corner radius: {appearance.radius}px</span>
                  <input
                    className="retro-range"
                    type="range"
                    min={0}
                    max={22}
                    value={appearance.radius}
                    onChange={(event) => updateAppearance({ radius: Number(event.target.value) })}
                  />
                </label>
              </div>

              <div className="settings-checks">
                <label className="retro-check">
                  <input
                    type="checkbox"
                    checked={appearance.shadows}
                    onChange={(event) => updateAppearance({ shadows: event.target.checked })}
                  />
                  Widget shadows
                </label>
                <label className="retro-check">
                  <input
                    type="checkbox"
                    checked={data.settings.shortcuts.showLabels}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          shortcuts: {
                            ...current.settings.shortcuts,
                            showLabels: event.target.checked,
                          },
                        },
                      }))
                    }
                  />
                  Show shortcut labels
                </label>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => resetSection('appearance')}
                >
                  <RotateCcw size={11} aria-hidden="true" /> Reset appearance
                </button>
              </div>
            </section>
          </div>
        )}

        {tab === 'layout' && (
          <div className="settings-section">
            <section>
              <h3 className="settings-heading">Dashboard grid</h3>
              <div className="form-grid">
                <label>
                  <span className="field-label">Columns</span>
                  <select
                    className="retro-select"
                    value={data.settings.layout.columns}
                    onChange={(event) => setColumns(Number(event.target.value) as ColumnCount)}
                  >
                    <option value={1}>One column</option>
                    <option value={2}>Two columns</option>
                    <option value={3}>Three columns (classic)</option>
                    <option value={4}>Four columns</option>
                  </select>
                </label>
                <label className="settings-slider">
                  <span className="field-label">Spacing: {data.settings.layout.gap}px</span>
                  <input
                    className="retro-range"
                    type="range"
                    min={8}
                    max={32}
                    value={data.settings.layout.gap}
                    onChange={(event) => updateLayout({ gap: Number(event.target.value) })}
                  />
                </label>
              </div>
              <p className="settings-help">
                Drag widgets by their grip handle, or use the gear panel&apos;s Move left / Move right
                buttons for a keyboard-friendly alternative. Narrow screens automatically stack the
                columns.
              </p>
              <div className="field-row settings-wrap">
                <button type="button" className="mini-button" onClick={resetWidgetPositions}>
                  <RotateCcw size={11} aria-hidden="true" /> Reset positions
                </button>
                <button type="button" className="mini-button" onClick={restoreDefaultWidgets}>
                  Restore default widgets
                </button>
              </div>
            </section>

            <section>
              <h3 className="settings-heading">Widgets</h3>
              <div className="widget-list-settings">
                {WIDGET_TYPES_ORDER.map((type) => {
                  const definition = WIDGET_REGISTRY[type];
                  const Icon = definition.icon;
                  const count = data.widgets.filter((widget) => widget.type === type).length;
                  return (
                    <div className="widget-list-row" key={type}>
                      <span className="widget-list-row__icon" aria-hidden="true">
                        <Icon size={14} />
                      </span>
                      <span className="widget-list-row__text">
                        <span className="widget-list-row__name">{definition.title}</span>
                        <span className="widget-list-row__description">{definition.description}</span>
                      </span>
                      {count > 0 && (
                        <span className="chip">
                          {count} added
                        </span>
                      )}
                      <button
                        type="button"
                        className="mini-button mini-button--active"
                        onClick={() => addWidget(type)}
                      >
                        <Plus size={11} aria-hidden="true" /> {count > 0 ? 'Add another' : 'Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {tab === 'search' && (
          <div className="settings-section">
            <section>
              <h3 className="settings-heading">Search behaviour</h3>
              <div className="form-grid">
                <label>
                  <span className="field-label">Default engine</span>
                  <select
                    className="retro-select"
                    value={data.settings.search.engineId}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          search: { ...current.settings.search, engineId: event.target.value },
                        },
                      }))
                    }
                  >
                    {[
                      { id: 'google', name: 'Google' },
                      { id: 'duckduckgo', name: 'DuckDuckGo' },
                      { id: 'bing', name: 'Bing' },
                      { id: 'brave', name: 'Brave Search' },
                      { id: 'startpage', name: 'Startpage' },
                      ...data.settings.search.customEngines.map((engine) => ({
                        id: engine.id,
                        name: `${engine.name} (custom)`,
                      })),
                    ].map((engine) => (
                      <option key={engine.id} value={engine.id}>
                        {engine.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-check-stack">
                  <span className="retro-check">
                    <input
                      type="checkbox"
                      checked={data.settings.search.openInNewTab}
                      onChange={(event) =>
                        setData((current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            search: {
                              ...current.settings.search,
                              openInNewTab: event.target.checked,
                            },
                          },
                        }))
                      }
                    />
                    Open results in a new tab
                  </span>
                  <span className="retro-check">
                    <input
                      type="checkbox"
                      checked={data.settings.search.saveHistory}
                      onChange={(event) =>
                        setData((current) => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            search: {
                              ...current.settings.search,
                              saveHistory: event.target.checked,
                            },
                          },
                        }))
                      }
                    />
                    Save recent searches locally
                  </span>
                </label>
              </div>

              <div className="field-row">
                <span className="settings-help">
                  {data.searchHistory.length} saved search
                  {data.searchHistory.length === 1 ? '' : 'es'} in this browser.
                </span>
                <button
                  type="button"
                  className="mini-button"
                  disabled={data.searchHistory.length === 0}
                  onClick={() => {
                    setData((current) => ({ ...current, searchHistory: [] }));
                    notify('Search history cleared.', 'success');
                  }}
                >
                  Clear history
                </button>
              </div>
              <p className="info-note">
                Queries are sent only to the engine you choose, never to several engines at once. No
                search suggestions are requested from third parties.
              </p>
            </section>

            <section>
              <h3 className="settings-heading">Custom search engines</h3>
              <ul className="custom-engine-list">
                {data.settings.search.customEngines.length === 0 && (
                  <li className="text-small text-muted">No custom engines yet.</li>
                )}
                {data.settings.search.customEngines.map((engine) => (
                  <li key={engine.id}>
                    <span className="custom-engine-list__text">
                      <strong>{engine.name}</strong>
                      <code>{engine.template}</code>
                    </span>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      onClick={() => removeEngine(engine.id)}
                      aria-label={`Remove ${engine.name}`}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="form-grid">
                <label>
                  <span className="field-label">Name</span>
                  <input
                    className="retro-field"
                    value={engineName}
                    onChange={(event) => setEngineName(event.target.value)}
                    maxLength={40}
                    placeholder="My search"
                  />
                </label>
                <label>
                  <span className="field-label">URL template</span>
                  <input
                    className="retro-field"
                    value={engineTemplate}
                    onChange={(event) => setEngineTemplate(event.target.value)}
                    placeholder="https://example.com/search?q=%s"
                  />
                </label>
              </div>
              {engineError && <p className="error-note" role="alert">{engineError}</p>}
              <button type="button" className="mini-button" onClick={addEngine}>
                <Plus size={11} aria-hidden="true" /> Add engine
              </button>
            </section>
          </div>
        )}

        {tab === 'news' && (
          <div className="settings-section">
            <section>
              <h3 className="settings-heading">News data endpoint</h3>
              <label>
                <span className="field-label">JSON dataset URL or path</span>
                <div className="field-row">
                  <input
                    className="retro-field"
                    value={datasetDraft}
                    onChange={(event) => setDatasetDraft(event.target.value)}
                    spellCheck={false}
                  />
                  <button type="button" className="glossy-button" onClick={applyDatasetUrl}>
                    Apply
                  </button>
                </div>
              </label>
              {datasetError && <p className="error-note" role="alert">{datasetError}</p>}
              <div className="field-row settings-wrap">
                <span className="status-pill">
                  <span className={`status-dot${error ? ' status-dot--error' : status === 'ready' ? '' : ' status-dot--stale'}`} />
                  {error ? error : updatedAt ? `Updated ${new Date(updatedAt).toLocaleString('en-GB')}` : 'Awaiting data'}
                </span>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => void refresh()}
                  disabled={refreshing}
                >
                  <RefreshCw size={11} className={refreshing ? 'spin' : undefined} aria-hidden="true" />
                  Refresh now
                </button>
              </div>
              <p className="settings-help">
                Last checked: {lastChecked ? new Date(lastChecked).toLocaleTimeString('en-GB') : 'not yet'}.
                The default dataset is generated by the GitHub Action and served alongside the site.
              </p>
            </section>

            <section>
              <h3 className="settings-heading">Automatic refresh</h3>
              <div className="form-grid">
                <label>
                  <span className="field-label">Refresh interval</span>
                  <select
                    className="retro-select"
                    value={data.settings.news.refreshMinutes}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          news: {
                            ...current.settings.news,
                            refreshMinutes: Number(event.target.value),
                          },
                        },
                      }))
                    }
                  >
                    {[5, 10, 15, 30, 60, 120].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        Every {minutes} minutes
                      </option>
                    ))}
                  </select>
                </label>
                <p className="settings-help">
                  Headline count and categories are configured on each News widget individually.
                </p>
              </div>
            </section>

            <section>
              <h3 className="settings-heading">Bottom news ticker</h3>
              <div className="settings-checks">
                <label className="retro-check">
                  <input
                    type="checkbox"
                    checked={data.settings.news.tickerEnabled}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          news: { ...current.settings.news, tickerEnabled: event.target.checked },
                        },
                      }))
                    }
                  />
                  Show the scrolling news ticker
                </label>
                <label>
                  <span className="field-label">Scrolling speed</span>
                  <select
                    className="retro-select"
                    value={data.settings.news.tickerSpeed}
                    onChange={(event) =>
                      setData((current) => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          news: {
                            ...current.settings.news,
                            tickerSpeed: event.target.value as 'slow' | 'normal' | 'fast',
                          },
                        },
                      }))
                    }
                  >
                    <option value="slow">Slow</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Fast</option>
                  </select>
                </label>
              </div>
              <div>
                <span className="field-label">Ticker categories</span>
                <div className="chip-row">
                  {ALL_NEWS_CATEGORIES.map((category) => (
                    <label className="retro-check" key={category}>
                      <input
                        type="checkbox"
                        checked={data.settings.news.tickerCategories.includes(category)}
                        onChange={() => toggleTickerCategory(category)}
                      />
                      {NEWS_CATEGORY_LABELS[category]}
                    </label>
                  ))}
                </div>
                {data.settings.news.tickerCategories.length === 0 && (
                  <p className="info-note">
                    No categories selected — the ticker shows all available headlines.
                  </p>
                )}
              </div>
              <p className="info-note">
                The ticker pauses on hover and when you focus its controls. It respects reduced-motion
                preferences, and manual previous / next buttons remain available. Categories can also be
                changed directly from the ticker bar.
              </p>
            </section>

            <button type="button" className="mini-button" onClick={() => resetSection('news')}>
              <RotateCcw size={11} aria-hidden="true" /> Reset news preferences
            </button>
          </div>
        )}

        {tab === 'data' && (
          <div className="settings-section">
            <section>
              <h3 className="settings-heading">Backup &amp; restore</h3>
              <p className="settings-help">
                Export shortcuts, themes, widget layout, notes, tasks, calendar events, bookmarks,
                feeds and preferences as one JSON file. Background images are included when they fit.
                No credentials or tokens are stored by RetroPortal.
              </p>
              <div className="field-row settings-wrap">
                <button type="button" className="glossy-button" onClick={() => void exportBackup()}>
                  <Download size={14} aria-hidden="true" /> Export JSON
                </button>
                <input
                  ref={importInput}
                  type="file"
                  accept="application/json,.json"
                  className="visually-hidden"
                  onChange={(event) => void importBackup(event)}
                />
                <button
                  type="button"
                  className="glossy-button"
                  onClick={() => importInput.current?.click()}
                >
                  <Upload size={14} aria-hidden="true" /> Import JSON
                </button>
              </div>
              <p className="info-note">
                Imports are validated and sanitised. Unsafe URLs and malformed values are discarded
                rather than executed. GitHub Pages does not sync preferences between devices — use this
                backup file to move them.
              </p>
            </section>

            <section>
              <h3 className="settings-heading">Reset sections</h3>
              <div className="reset-grid">
                <button type="button" className="mini-button" onClick={() => resetSection('appearance')}>
                  Appearance &amp; background
                </button>
                <button type="button" className="mini-button" onClick={() => resetSection('layout')}>
                  Widget layout
                </button>
                <button type="button" className="mini-button" onClick={() => resetSection('search')}>
                  Search &amp; history
                </button>
                <button type="button" className="mini-button" onClick={() => resetSection('news')}>
                  News &amp; ticker
                </button>
                <button type="button" className="mini-button" onClick={() => resetSection('personal')}>
                  Notes, tasks &amp; events
                </button>
                <button type="button" className="mini-button" onClick={() => resetSection('bookmarks')}>
                  Bookmarks
                </button>
              </div>
            </section>

            <section className="danger-zone">
              <h3 className="settings-heading">Danger zone</h3>
              <p className="settings-help">
                Deletes everything stored by RetroPortal in this browser and restores the first-run
                state. Export a backup first if you might want your data back.
              </p>
              <button type="button" className="glossy-button glossy-button--danger" onClick={() => void fullReset()}>
                <TriangleAlert size={14} aria-hidden="true" /> Erase all RetroPortal data
              </button>
            </section>
          </div>
        )}

        {tab === 'about' && (
          <div className="settings-section about-section">
            <section>
              <h3 className="settings-heading">RetroPortal v1.0.0</h3>
              <p>
                A dark-mode love letter to the personalised start pages of 2005–2009. Built with React,
                TypeScript and Vite, designed for static hosting on GitHub Pages and packaged as a
                Manifest V3 new-tab extension.
              </p>
              <div className="about-grid">
                <div>
                  <strong>Local-first</strong>
                  <p>All preferences and personal data live in this browser. No account, no tracking, no cloud sync.</p>
                </div>
                <div>
                  <strong>Live data</strong>
                  <p>Weather comes from Open-Meteo. UK headlines are aggregated from publisher RSS feeds by GitHub Actions.</p>
                </div>
                <div>
                  <strong>No API keys</strong>
                  <p>The basic experience never asks for credentials and contains no embedded secrets.</p>
                </div>
                <div>
                  <strong>Accessible by design</strong>
                  <p>Keyboard navigation, visible focus, reduced-motion support and a ticker that does not auto-announce.</p>
                </div>
              </div>
            </section>

            <section>
              <h3 className="settings-heading">Browser extension</h3>
              {isExtensionContext() ? (
                <>
                  <p>You are running the bundled extension. Choose bundled or hosted mode on its options page.</p>
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() => {
                      if (!openExtensionOptions()) notify('Open chrome://extensions to configure this extension.', 'info');
                    }}
                  >
                    <ExternalLink size={11} aria-hidden="true" /> Extension options
                  </button>
                </>
              ) : (
                <p>
                  The extension is generated with <code>npm run build:extension</code>, then loaded
                  unpacked from <code>extension/dist</code>. It supports bundled local mode and an
                  optional redirect to the hosted GitHub Pages URL.
                </p>
              )}
            </section>

            <section>
              <h3 className="settings-heading">Known limitations</h3>
              <ul className="about-list">
                <li>GitHub Pages cannot synchronise data across browsers or devices.</li>
                <li>Most publishers block direct browser RSS requests (CORS). Bundled feed snapshots keep the RSS widget useful; custom feeds report clear errors.</li>
                <li>Scheduled GitHub Actions runs can be delayed and are not guaranteed to the minute.</li>
                <li>News headlines and weather need a network connection. Local notes, calendar, tasks, shortcuts and search remain usable offline.</li>
                <li>Uploaded backgrounds are stored in IndexedDB and are not synced.</li>
              </ul>
            </section>

            <section>
              <h3 className="settings-heading">Shortcuts</h3>
              <ul className="about-list">
                <li><kbd>/</kbd> focus the search bar</li>
                <li><kbd>Esc</kbd> close suggestions or clear the query</li>
                <li><kbd>Tab</kbd> / <kbd>Shift+Tab</kbd> move through controls; widget grips support keyboard reordering</li>
              </ul>
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}

export type { SettingsTab };
