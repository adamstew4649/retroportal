import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EXTENSION_SETTINGS,
  isExtensionContext,
  readExtensionSettings,
  validHostedUrl,
} from '../src/services/extension';

describe('validHostedUrl', () => {
  it('accepts HTTPS addresses', () => {
    expect(validHostedUrl('https://example.com/portal/')).toBe('https://example.com/portal/');
  });

  it('accepts local development over HTTP', () => {
    expect(validHostedUrl('http://localhost:5173/')).toBe('http://localhost:5173/');
    expect(validHostedUrl('http://127.0.0.1:4173/')).toBe('http://127.0.0.1:4173/');
  });

  it('rejects insecure remote addresses', () => {
    expect(validHostedUrl('http://example.com/')).toBeNull();
    expect(validHostedUrl('http://localhost.example.com/')).toBeNull();
  });

  it('rejects unsafe schemes and malformed values', () => {
    expect(validHostedUrl('javascript:alert(1)')).toBeNull();
    expect(validHostedUrl('data:text/html,hello')).toBeNull();
    expect(validHostedUrl('not a url')).toBeNull();
    expect(validHostedUrl('')).toBeNull();
  });
});

describe('extension defaults', () => {
  it('does not ship a placeholder hosted URL', () => {
    expect(DEFAULT_EXTENSION_SETTINGS.mode).toBe('bundled');
    expect(DEFAULT_EXTENSION_SETTINGS.hostedUrl).toBe('');
  });

  it('is outside an extension context in jsdom', () => {
    expect(isExtensionContext()).toBe(false);
  });

  it('returns no settings when chrome.storage is unavailable', async () => {
    await expect(readExtensionSettings()).resolves.toBeNull();
  });
});
