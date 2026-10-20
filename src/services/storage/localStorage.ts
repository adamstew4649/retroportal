import {
  CURRENT_DATA_VERSION,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  createDefaultPortalData,
} from '../../config/defaults';
import type { PortalData } from '../../types';
import { migratePortalData, normalisePortalData } from './validate';

export interface StorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export const browserStorage: StorageAdapter = {
  read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // Quota errors are surfaced to the UI by the caller through a custom event.
      window.dispatchEvent(
        new CustomEvent('retroportal:storage-error', {
          detail: error instanceof Error ? error.message : 'Local storage is unavailable.',
        }),
      );
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore unavailable storage.
    }
  },
};

export function loadPortalData(storage: StorageAdapter = browserStorage): PortalData {
  const currentRaw = storage.read(STORAGE_KEY);
  const raw = currentRaw ?? storage.read(LEGACY_STORAGE_KEY);
  if (!raw) return createDefaultPortalData();
  try {
    const parsed: unknown = JSON.parse(raw);
    const migrated = migratePortalData(parsed);
    if (migrated.version !== CURRENT_DATA_VERSION || !currentRaw) {
      savePortalData(migrated, storage);
      if (!currentRaw) storage.remove(LEGACY_STORAGE_KEY);
    }
    return migrated;
  } catch {
    // A corrupt value should not leave the user with a blank page. Keep a copy
    // for manual recovery, then start from safe defaults.
    storage.write(`${STORAGE_KEY}:corrupt`, raw.slice(0, 100_000));
    return createDefaultPortalData();
  }
}

export function savePortalData(data: PortalData, storage: StorageAdapter = browserStorage): boolean {
  try {
    storage.write(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearPortalData(storage: StorageAdapter = browserStorage): void {
  storage.remove(STORAGE_KEY);
  storage.remove(LEGACY_STORAGE_KEY);
}

export function replacePortalData(raw: unknown): PortalData {
  return normalisePortalData(raw);
}
