import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../src/components/SearchBar/SearchBar';
import { PortalProvider } from '../src/state/PortalContext';
import { ToastProvider } from '../src/state/ToastContext';
import { STORAGE_KEY, createDefaultPortalData } from '../src/config/defaults';
import { savePortalData } from '../src/services/storage/localStorage';

function renderSearchBar() {
  return render(
    <ToastProvider>
      <PortalProvider>
        <SearchBar />
      </PortalProvider>
    </ToastProvider>,
  );
}

function seedPortal(openInNewTab = true, history: Array<{ query: string; at: number }> = []) {
  const data = createDefaultPortalData();
  data.settings.search.openInNewTab = openInNewTab;
  data.searchHistory = history;
  savePortalData(data);
}

describe('SearchBar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    seedPortal();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens an encoded search in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const user = userEvent.setup();
    renderSearchBar();

    await user.type(screen.getByLabelText('Search the web'), 'retro portal & friends');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      'https://www.google.com/search?q=retro%20portal%20%26%20friends',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('keeps the search button disabled for an empty query', () => {
    renderSearchBar();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
  });

  it('persists successful searches to history', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const user = userEvent.setup();
    renderSearchBar();

    await user.type(screen.getByLabelText('Search the web'), 'uk weather');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
      expect(stored.searchHistory?.[0]?.query).toBe('uk weather');
    });
  });

  it('shows recent searches and runs the selected suggestion', async () => {
    seedPortal(true, [{ query: 'london weather', at: Date.now() }]);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const user = userEvent.setup();
    renderSearchBar();

    await user.click(screen.getByLabelText('Search the web'));
    expect(await screen.findByText('Recent searches')).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'london weather' }));
    expect(open).toHaveBeenCalledWith(
      'https://www.google.com/search?q=london%20weather',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('uses the selected search engine', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const user = userEvent.setup();
    renderSearchBar();

    await user.selectOptions(screen.getByLabelText('Search engine'), 'duckduckgo');
    await user.type(screen.getByLabelText('Search the web'), 'retro portal');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(open).toHaveBeenCalledWith(
      'https://duckduckgo.com/?q=retro%20portal',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('clears the input with Escape', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    const input = screen.getByLabelText('Search the web');

    await user.type(input, 'something');
    expect(input).toHaveValue('something');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });

  it('focuses the search input when / is pressed', async () => {
    const user = userEvent.setup();
    renderSearchBar();
    const input = screen.getByLabelText('Search the web');

    await user.keyboard('/');
    expect(input).toHaveFocus();
  });
});
