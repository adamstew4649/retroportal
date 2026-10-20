/**
 * Uploaded backgrounds live in IndexedDB rather than LocalStorage because data
 * URLs can easily exceed the ~5 MB synchronous storage budget. If IndexedDB is
 * unavailable we fall back to LocalStorage for small images.
 */

const DB_NAME = 'retroportal';
const DB_VERSION = 1;
const STORE = 'backgrounds';
const FALLBACK_KEY = 'retroportal:background:fallback';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB.'));
  });
}

export async function saveBackgroundImage(dataUrl: string): Promise<string> {
  const id = `bg-${Date.now().toString(36)}`;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(dataUrl, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not save the image.'));
    });
    db.close();
    return id;
  } catch {
    if (dataUrl.length < 2_000_000) {
      try {
        localStorage.setItem(FALLBACK_KEY, JSON.stringify({ id, dataUrl }));
        return id;
      } catch {
        throw new Error('The background image is too large to store in this browser.');
      }
    }
    throw new Error('The background image could not be stored in this browser.');
  }
}

export async function loadBackgroundImage(id: string): Promise<string | null> {
  try {
    const db = await openDb();
    const result = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(id);
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (result) return result;
  } catch {
    // Fall through to the LocalStorage fallback.
  }
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; dataUrl?: string };
    return parsed.id === id && typeof parsed.dataUrl === 'string' ? parsed.dataUrl : null;
  } catch {
    return null;
  }
}

export async function deleteBackgroundImage(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // Ignore.
  }
  try {
    localStorage.removeItem(FALLBACK_KEY);
  } catch {
    // Ignore.
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choose a PNG, JPEG, WebP or GIF image.'));
      return;
    }
    if (file.size > 6_000_000) {
      reject(new Error('Choose an image smaller than 6 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read that image.'));
    };
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}
