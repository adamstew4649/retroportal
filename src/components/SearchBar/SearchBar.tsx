import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Clock3, Search, X } from 'lucide-react';
import { usePortal } from '../../state/PortalContext';
import { allSearchEngines, buildSearchUrl, engineById, engineInitial } from '../../services/search/engines';
import type { SearchEngine } from '../../types';
import './search.css';

export function SearchBar() {
  const { data, setData } = usePortal();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const engines = useMemo(
    () => allSearchEngines(data.settings.search.customEngines),
    [data.settings.search.customEngines],
  );
  const engine = engineById(data.settings.search.engineId, data.settings.search.customEngines);

  const suggestions = useMemo(() => {
    const history = data.searchHistory;
    const term = query.trim().toLowerCase();
    const filtered = term
      ? history.filter((entry) => entry.query.toLowerCase().includes(term))
      : history;
    return filtered.slice(0, 8);
  }, [data.searchHistory, query]);

  const showSuggestions = focused && suggestions.length > 0 && data.settings.search.saveHistory;

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const submitSearch = useCallback(
    (rawQuery: string) => {
      const trimmed = rawQuery.trim();
      if (!trimmed) return;
      const url = buildSearchUrl(engine, trimmed);
      if (!url) return;

      if (data.settings.search.saveHistory) {
        setData((current) => {
          const withoutDuplicate = current.searchHistory.filter(
            (entry) => entry.query.toLowerCase() !== trimmed.toLowerCase(),
          );
          return {
            ...current,
            searchHistory: [{ query: trimmed, at: Date.now() }, ...withoutDuplicate].slice(0, 20),
          };
        });
      }

      setFocused(false);
      setActiveIndex(-1);
      if (data.settings.search.openInNewTab) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.assign(url);
      }
    },
    [data.settings.search.openInNewTab, data.settings.search.saveHistory, engine, setData],
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      submitSearch(suggestions[activeIndex].query);
      return;
    }
    submitSearch(query);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (showSuggestions) {
        setFocused(false);
        setActiveIndex(-1);
      } else {
        setQuery('');
      }
      return;
    }
    if (!showSuggestions) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    }
  };

  const selectEngine = (value: string) => {
    setData((current) => ({
      ...current,
      settings: {
        ...current.settings,
        search: { ...current.settings.search, engineId: value },
      },
    }));
  };

  const clearHistory = () => {
    setData((current) => ({ ...current, searchHistory: [] }));
    setFocused(false);
  };

  const suggestionId = (index: number) => `${listId}-option-${index}`;

  return (
    <section className="search-section" aria-label="Web search">
      <div className="search-glow" aria-hidden="true" />
      <div className="search-tagline">
        <span className="search-tagline__rule" aria-hidden="true" />
        <p>The web starts here</p>
        <span className="search-tagline__rule" aria-hidden="true" />
      </div>
      <form
        className={`search-bar${focused ? ' search-bar--focused' : ''}`}
        onSubmit={onSubmit}
        role="search"
      >
        <div className="search-engine">
          <span
            className="search-engine__badge"
            style={{ '--engine-colour': engine.colour } as CSSProperties}
            aria-hidden="true"
          >
            {engineInitial(engine)}
          </span>
          <label className="visually-hidden" htmlFor={`${listId}-engine`}>
            Search engine
          </label>
          <select
            id={`${listId}-engine`}
            className="search-engine__select"
            value={engine.id}
            onChange={(event) => selectEngine(event.target.value)}
          >
            {engines.map((item: SearchEngine) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="search-input-wrap">
          <Search className="search-input-icon" size={19} aria-hidden="true" />
          <input
            ref={inputRef}
            className="search-input"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(-1);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            placeholder={`Search with ${engine.name}…`}
            aria-label="Search the web"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls={showSuggestions ? listId : undefined}
            aria-activedescendant={activeIndex >= 0 ? suggestionId(activeIndex) : undefined}
            onKeyDown={onKeyDown}
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        <button type="submit" className="search-submit" disabled={!query.trim()} aria-label="Search">
          <Search size={17} aria-hidden="true" />
          <span>Search</span>
        </button>

        {showSuggestions && (
          <div className="search-suggestions" role="listbox" id={listId} aria-label="Recent searches">
            <div className="search-suggestions__head">
              <Clock3 size={12} aria-hidden="true" />
              <span>Recent searches</span>
              <button type="button" className="link-button" onMouseDown={(event) => event.preventDefault()} onClick={clearHistory}>
                Clear
              </button>
            </div>
            {suggestions.map((entry, index) => (
              <button
                key={`${entry.query}-${entry.at}`}
                type="button"
                id={suggestionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                className={`search-suggestion${index === activeIndex ? ' search-suggestion--active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  setQuery(entry.query);
                  submitSearch(entry.query);
                }}
              >
                <Clock3 size={13} aria-hidden="true" />
                <span>{entry.query}</span>
              </button>
            ))}
          </div>
        )}
      </form>
      <p className="search-hint">
        <kbd>/</kbd> to focus · <kbd>Esc</kbd> to clear · Results open{' '}
        {data.settings.search.openInNewTab ? 'in a new tab' : 'in this tab'}
      </p>
    </section>
  );
}
