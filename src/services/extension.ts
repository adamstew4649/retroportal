/**
 * Small, deliberately isolated bridge between the shared web app and the
 * browser extension. The web build never depends on any of these globals.
 */

interface ChromeStorageArea {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface ChromeApi {
  runtime?: { id?: string; openOptionsPage?: () => void };
  storage?: { local?: ChromeStorageArea };
}

declare global {
  interface Window {
    chrome?: ChromeApi;
  }
}

export interface ExtensionSettings {
  mode: 'bundled' | 'hosted';
  hostedUrl: string;
}

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  mode: 'bundled',
  hostedUrl: '',
};

export function extensionApi(): ChromeApi | null {
  return typeof window !== 'undefined' && window.chrome?.runtime?.id ? window.chrome : null;
}

export function isExtensionContext(): boolean {
  return extensionApi() !== null;
}

export async function readExtensionSettings(): Promise<ExtensionSettings | null> {
  const api = extensionApi();
  if (!api?.storage?.local) return null;
  try {
    const values = await api.storage.local.get(['mode', 'hostedUrl']);
    const mode = values.mode === 'hosted' ? 'hosted' : 'bundled';
    const hostedUrl = typeof values.hostedUrl === 'string' ? values.hostedUrl : '';
    return { mode, hostedUrl };
  } catch {
    return null;
  }
}

export function validHostedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return url.toString();
    if (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    ) {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * In hosted mode the extension's new-tab page redirects to the published app.
 * In bundled mode this resolves immediately and the local React app renders.
 */
export async function applyExtensionMode(): Promise<void> {
  const settings = await readExtensionSettings();
  if (!settings || settings.mode !== 'hosted') return;
  const target = validHostedUrl(settings.hostedUrl);
  if (target) window.location.replace(target);
}

export function openExtensionOptions(): boolean {
  const api = extensionApi();
  if (!api?.runtime?.openOptionsPage) return false;
  api.runtime.openOptionsPage();
  return true;
}
