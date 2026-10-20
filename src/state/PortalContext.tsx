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
import { createDefaultPortalData } from '../config/defaults';
import type {
  AppearanceSettings,
  LayoutSettings,
  PortalData,
  Settings,
  WidgetSettingsMap,
  WidgetType,
} from '../types';
import {
  clearPortalData,
  loadPortalData,
  savePortalData,
} from '../services/storage/localStorage';
import {
  deleteBackgroundImage,
  loadBackgroundImage,
  saveBackgroundImage,
} from '../services/storage/imageStore';
import { useToast } from './ToastContext';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface PortalContextValue {
  data: PortalData;
  setData: (updater: (current: PortalData) => PortalData) => void;
  saveState: SaveState;
  backgroundImageUrl: string | null;
  updateSettings: (patch: Partial<Settings>) => void;
  updateAppearance: (patch: Partial<AppearanceSettings>) => void;
  updateLayout: (patch: Partial<LayoutSettings>) => void;
  updateWidgetSettings: <K extends WidgetType>(
    type: K,
    patch: Partial<WidgetSettingsMap[K]>,
  ) => void;
  applyBackgroundImage: (dataUrl: string) => Promise<void>;
  removeBackgroundImage: () => Promise<void>;
  importPortalData: (data: PortalData, backgroundImage?: string) => Promise<void>;
  resetEverything: () => Promise<void>;
}

const PortalContext = createContext<PortalContextValue | null>(null);

const DEFAULT_WIDGET_SETTINGS = createDefaultPortalData().widgetSettings;

export function PortalProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<PortalData>(() => loadPortalData());
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const firstRender = useRef(true);
  const { notify } = useToast();

  const setData = useCallback((updater: (current: PortalData) => PortalData) => {
    setDataState((current) => updater(current));
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setData((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
    },
    [setData],
  );

  const updateAppearance = useCallback(
    (patch: Partial<AppearanceSettings>) => {
      setData((current) => ({
        ...current,
        settings: {
          ...current.settings,
          appearance: { ...current.settings.appearance, ...patch },
        },
      }));
    },
    [setData],
  );

  const updateLayout = useCallback(
    (patch: Partial<LayoutSettings>) => {
      setData((current) => ({
        ...current,
        settings: {
          ...current.settings,
          layout: { ...current.settings.layout, ...patch },
        },
      }));
    },
    [setData],
  );

  const updateWidgetSettings = useCallback(
    <K extends WidgetType>(type: K, patch: Partial<WidgetSettingsMap[K]>) => {
      setData((current) => ({
        ...current,
        widgetSettings: {
          ...current.widgetSettings,
          [type]: {
            ...(current.widgetSettings[type] ?? DEFAULT_WIDGET_SETTINGS[type]),
            ...patch,
          },
        },
      }));
    },
    [setData],
  );

  const persist = useCallback((next: PortalData): boolean => {
    const ok = savePortalData(next);
    setSaveState(ok ? 'saved' : 'error');
    if (!ok) notify('Changes could not be saved. Browser storage may be full.', 'error');
    return ok;
  }, [notify]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState('saving');
    const timer = window.setTimeout(() => persist(data), 220);
    return () => window.clearTimeout(timer);
  }, [data, persist]);

  useEffect(() => {
    const onStorageError = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setSaveState('error');
      notify(detail || 'Local storage is unavailable.', 'error');
    };
    window.addEventListener('retroportal:storage-error', onStorageError);
    return () => window.removeEventListener('retroportal:storage-error', onStorageError);
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    const background = data.settings.appearance.background;
    if (background.type !== 'image' || !background.imageId) {
      setBackgroundImageUrl(background.imageUrl ?? null);
      return;
    }
    loadBackgroundImage(background.imageId).then((url) => {
      if (!cancelled) setBackgroundImageUrl(url ?? background.imageUrl ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [
    data.settings.appearance.background.type,
    data.settings.appearance.background.imageId,
    data.settings.appearance.background.imageUrl,
  ]);

  const applyBackgroundImage = useCallback(
    async (dataUrl: string) => {
      const oldId = data.settings.appearance.background.imageId;
      const id = await saveBackgroundImage(dataUrl);
      setData((current) => ({
        ...current,
        settings: {
          ...current.settings,
          appearance: {
            ...current.settings.appearance,
            background: {
              ...current.settings.appearance.background,
              type: 'image',
              imageId: id,
              imageUrl: undefined,
            },
          },
        },
      }));
      setBackgroundImageUrl(dataUrl);
      if (oldId && oldId !== id) await deleteBackgroundImage(oldId);
      notify('Background image saved.', 'success');
    },
    [data.settings.appearance.background.imageId, notify, setData],
  );

  const removeBackgroundImage = useCallback(async () => {
    const id = data.settings.appearance.background.imageId;
    if (id) await deleteBackgroundImage(id);
    setBackgroundImageUrl(null);
    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        appearance: {
          ...current.settings.appearance,
          background: {
            ...current.settings.appearance.background,
            type: 'gradient',
            imageId: undefined,
            imageUrl: undefined,
          },
        },
      },
    }));
  }, [data.settings.appearance.background.imageId, setData]);

  const importPortalData = useCallback(
    async (next: PortalData, backgroundImage?: string) => {
      let toApply = next;
      if (backgroundImage) {
        try {
          const oldId = data.settings.appearance.background.imageId;
          const id = await saveBackgroundImage(backgroundImage);
          toApply = {
            ...next,
            settings: {
              ...next.settings,
              appearance: {
                ...next.settings.appearance,
                background: {
                  ...next.settings.appearance.background,
                  type: 'image',
                  imageId: id,
                  imageUrl: undefined,
                },
              },
            },
          };
          if (oldId) await deleteBackgroundImage(oldId);
          setBackgroundImageUrl(backgroundImage);
        } catch (error) {
          notify(
            error instanceof Error ? error.message : 'The backup background could not be restored.',
            'error',
          );
        }
      }
      setDataState(toApply);
      persist(toApply);
      notify('Settings imported successfully.', 'success');
    },
    [data.settings.appearance.background.imageId, notify, persist],
  );

  const resetEverything = useCallback(async () => {
    const oldId = data.settings.appearance.background.imageId;
    if (oldId) await deleteBackgroundImage(oldId);
    const defaults = createDefaultPortalData();
    clearPortalData();
    setDataState(defaults);
    setBackgroundImageUrl(null);
    persist(defaults);
    notify('RetroPortal has been reset to its defaults.', 'success');
  }, [data.settings.appearance.background.imageId, notify, persist]);

  const value = useMemo<PortalContextValue>(
    () => ({
      data,
      setData,
      saveState,
      backgroundImageUrl,
      updateSettings,
      updateAppearance,
      updateLayout,
      updateWidgetSettings,
      applyBackgroundImage,
      removeBackgroundImage,
      importPortalData,
      resetEverything,
    }),
    [
      data,
      setData,
      saveState,
      backgroundImageUrl,
      updateSettings,
      updateAppearance,
      updateLayout,
      updateWidgetSettings,
      applyBackgroundImage,
      removeBackgroundImage,
      importPortalData,
      resetEverything,
    ],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalContextValue {
  const context = useContext(PortalContext);
  if (!context) throw new Error('usePortal must be used inside PortalProvider');
  return context;
}

export function useWidgetSettings<K extends WidgetType>(
  type: K,
): [WidgetSettingsMap[K], (patch: Partial<WidgetSettingsMap[K]>) => void] {
  const { data, updateWidgetSettings } = usePortal();
  const merged = {
    ...DEFAULT_WIDGET_SETTINGS[type],
    ...(data.widgetSettings[type] as Partial<WidgetSettingsMap[K]> | undefined),
  } as WidgetSettingsMap[K];
  const update = useCallback(
    (patch: Partial<WidgetSettingsMap[K]>) => updateWidgetSettings(type, patch),
    [type, updateWidgetSettings],
  );
  return [merged, update];
}

export { DEFAULT_WIDGET_SETTINGS };
