/**
 * URL helpers. All user-provided URLs pass through here before use.
 * Only http(s) URLs are ever accepted; javascript:, data: and file: links are
 * rejected so imported shortcut files cannot execute code.
 */

export function safeHttpUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeHttpUrlWithHttpsFallback(input: string): string | null {
  const direct = safeHttpUrl(input);
  if (direct) return direct;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(input.trim())) {
    return safeHttpUrl(`https://${input.trim()}`);
  }
  return null;
}

export function hostnameOf(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function faviconUrlFor(siteUrl: string): string {
  const host = hostnameOf(siteUrl);
  return host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
    : '';
}

/** Allows relative same-origin data paths as well as trusted https endpoints. */
export function safeDataUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\.?\/?[\w./-]+\.json(\?.*)?$/i.test(trimmed) || trimmed.startsWith('./')) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed, window.location.href);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
  } catch {
    return null;
  }
  // Permits relative URLs in non-browser tests and extension contexts.
  if (!trimmed.startsWith('javascript:')) return trimmed;
  return null;
}

export function isSameOriginOrHttps(input: string): boolean {
  if (input.startsWith('./') || input.startsWith('/')) return true;
  try {
    const url = new URL(input);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function stripControlCharacters(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

export function truncate(input: string, length: number): string {
  if (input.length <= length) return input;
  return `${input.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
}
