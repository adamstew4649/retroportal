import type { SearchEngine } from '../../types';

export const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    template: 'https://www.google.com/search?q=%s',
    colour: '#4285f4',
    builtin: true,
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    template: 'https://duckduckgo.com/?q=%s',
    colour: '#de5833',
    builtin: true,
  },
  {
    id: 'bing',
    name: 'Bing',
    template: 'https://www.bing.com/search?q=%s',
    colour: '#008373',
    builtin: true,
  },
  {
    id: 'brave',
    name: 'Brave Search',
    template: 'https://search.brave.com/search?q=%s',
    colour: '#fb542b',
    builtin: true,
  },
  {
    id: 'startpage',
    name: 'Startpage',
    template: 'https://www.startpage.com/sp/search?query=%s',
    colour: '#6573ff',
    builtin: true,
  },
];

export function allSearchEngines(custom: SearchEngine[] = []): SearchEngine[] {
  return [...DEFAULT_SEARCH_ENGINES, ...custom.filter((engine) => !engine.builtin)];
}

export function engineById(id: string, custom: SearchEngine[] = []): SearchEngine {
  return (
    allSearchEngines(custom).find((engine) => engine.id === id) ?? DEFAULT_SEARCH_ENGINES[0]
  );
}

/**
 * Build a search URL without ever concatenating unencoded user text. The
 * template always lives in configuration and must be HTTPS.
 */
export function buildSearchUrl(engine: SearchEngine, rawQuery: string): string | null {
  const query = rawQuery.trim();
  if (!query) return null;
  if (!engine.template.includes('%s')) return null;

  const encoded = encodeURIComponent(query);
  const candidate = engine.template.replaceAll('%s', encoded);
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function validateEngineTemplate(template: string): string | null {
  if (!template.includes('%s')) return 'The template must include %s where the query goes.';
  const candidate = template.replaceAll('%s', 'test%20query');
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return 'Only HTTPS search URLs are allowed.';
  } catch {
    return 'Enter a valid URL, for example https://example.com/search?q=%s';
  }
  if (/%s/.test(encodeURIComponent(candidate))) {
    return 'The template could not be parsed.';
  }
  return null;
}

export function engineInitial(engine: SearchEngine): string {
  return engine.name.trim().charAt(0).toUpperCase() || '?';
}
