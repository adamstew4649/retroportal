import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEARCH_ENGINES,
  allSearchEngines,
  buildSearchUrl,
  engineById,
  engineInitial,
  validateEngineTemplate,
} from '../src/services/search/engines';
import type { SearchEngine } from '../src/types';

const google = DEFAULT_SEARCH_ENGINES[0];

describe('buildSearchUrl', () => {
  it('encodes the query rather than concatenating it', () => {
    expect(buildSearchUrl(google, 'retro portal & friends')).toBe(
      'https://www.google.com/search?q=retro%20portal%20%26%20friends',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(buildSearchUrl(google, '  weather london  ')).toBe(
      'https://www.google.com/search?q=weather%20london',
    );
  });

  it('refuses empty queries', () => {
    expect(buildSearchUrl(google, '   ')).toBeNull();
  });

  it('requires the %s placeholder', () => {
    const broken: SearchEngine = { ...google, template: 'https://example.com/search' };
    expect(buildSearchUrl(broken, 'test')).toBeNull();
  });

  it('only permits HTTPS templates', () => {
    const insecure: SearchEngine = { ...google, template: 'http://example.com/?q=%s' };
    expect(buildSearchUrl(insecure, 'test')).toBeNull();
  });

  it('rejects unparseable templates', () => {
    const invalid: SearchEngine = { ...google, template: 'not a url %s' };
    expect(buildSearchUrl(invalid, 'test')).toBeNull();
  });
});

describe('validateEngineTemplate', () => {
  it('accepts a valid HTTPS template with %s', () => {
    expect(validateEngineTemplate('https://example.com/search?q=%s')).toBeNull();
  });

  it('reports a missing placeholder', () => {
    expect(validateEngineTemplate('https://example.com/search')).toMatch(/%s/);
  });

  it('reports non-HTTPS schemes', () => {
    expect(validateEngineTemplate('http://example.com/search?q=%s')).toMatch(/HTTPS/);
    expect(validateEngineTemplate('javascript:alert(%s)')).toMatch(/HTTPS/);
  });
});

describe('engine helpers', () => {
  it('appends custom engines and ignores duplicates marked built-in', () => {
    const custom: SearchEngine = {
      id: 'custom',
      name: 'Custom',
      template: 'https://example.com/?q=%s',
      colour: '#fff',
    };
    const disguisedBuiltin: SearchEngine = {
      ...google,
      id: 'google-clone',
      builtin: true,
    };
    const engines = allSearchEngines([custom, disguisedBuiltin]);
    expect(engines).toHaveLength(DEFAULT_SEARCH_ENGINES.length + 1);
    expect(engines.at(-1)?.id).toBe('custom');
  });

  it('falls back to Google for unknown engine ids', () => {
    expect(engineById('missing').id).toBe('google');
  });

  it('finds a custom engine by id', () => {
    const custom: SearchEngine = {
      id: 'custom',
      name: 'Custom',
      template: 'https://example.com/?q=%s',
      colour: '#fff',
    };
    expect(engineById('custom', [custom]).name).toBe('Custom');
  });

  it('uses the first letter of the engine name as a badge', () => {
    expect(engineInitial(google)).toBe('G');
    expect(engineInitial({ ...google, name: '   ' })).toBe('?');
  });
});
