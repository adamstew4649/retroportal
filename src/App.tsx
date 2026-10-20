import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { SettingsTab } from './components/Settings/SettingsModal';
import { Header } from './components/Header/Header';
import { SearchBar } from './components/SearchBar/SearchBar';
import { Shortcuts } from './components/Shortcuts/Shortcuts';
import { Dashboard } from './components/Dashboard/Dashboard';
import { NewsTicker } from './components/NewsTicker/NewsTicker';
import { SettingsModal } from './components/Settings/SettingsModal';
import { usePortal } from './state/PortalContext';
import { FONT_FAMILIES } from './themes/presets';
import { savePortalData } from './services/storage/localStorage';
import './styles/base.css';
import './styles/retro.css';
import './app.css';

function safeCssUrl(url: string): string {
  return `url("${url.replace(/"/g, '%22').replace(/\r|\n/g, '')}")`;
}

export function App() {
  const { data, backgroundImageUrl } = usePortal();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('appearance');
  const { appearance } = data.settings;
  const { background } = appearance;

  useEffect(() => {
    const root = document.documentElement;
    const colours = appearance.colours;
    root.style.setProperty('--bg', colours.bg);
    root.style.setProperty('--content-bg', colours.contentBg);
    root.style.setProperty('--widget-bg', colours.widgetBg);
    root.style.setProperty('--header-top', colours.headerTop);
    root.style.setProperty('--header-bottom', colours.headerBottom);
    root.style.setProperty('--accent', colours.accent);
    root.style.setProperty('--text', colours.text);
    root.style.setProperty('--muted', colours.muted);
    root.style.setProperty('--border', colours.border);
    root.style.setProperty('--radius', `${appearance.radius}px`);
    root.style.setProperty('--font-size', `${appearance.fontSize}px`);
    root.style.setProperty('--font-family', FONT_FAMILIES[appearance.fontPreset]);
    root.style.setProperty('--shadow', appearance.shadows
      ? '0 5px 16px rgba(0, 0, 0, 0.38), 0 1px 2px rgba(0, 0, 0, 0.5)'
      : '0 1px 2px rgba(0, 0, 0, 0.35)');
    root.dataset.density = appearance.density;
    root.dataset.shadows = appearance.shadows ? 'on' : 'off';
    root.dataset.searchStyle = appearance.searchBar;

    document.body.style.backgroundColor = colours.bg;
    document.title =
      data.settings.portalName === 'RetroPortal'
        ? 'RetroPortal — your personal start page'
        : `${data.settings.portalName} — RetroPortal`;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', colours.headerBottom);
  }, [appearance, data.settings.portalName]);

  useEffect(() => {
    const handler = () => savePortalData(data);
    const visibility = () => {
      if (document.visibilityState === 'hidden') savePortalData(data);
    };
    window.addEventListener('beforeunload', handler);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('beforeunload', handler);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [data]);

  const openSettings = useCallback((tab: SettingsTab = 'appearance') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  const backgroundStyle: CSSProperties = (() => {
    if (background.type === 'image') {
      const url = backgroundImageUrl || background.imageUrl;
      if (url) {
        const overlay = Math.min(0.85, Math.max(0, background.overlay));
        return {
          backgroundColor: background.colour,
          backgroundImage: `linear-gradient(rgba(8, 12, 17, ${overlay}), rgba(8, 12, 17, ${overlay})), ${safeCssUrl(url)}`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        };
      }
      return { backgroundColor: background.colour, backgroundImage: 'none' };
    }
    if (background.type === 'gradient') {
      return {
        backgroundColor: background.colour,
        backgroundImage: background.gradient,
        backgroundAttachment: 'fixed',
      };
    }
    return { backgroundColor: background.colour, backgroundImage: 'none' };
  })();

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="app-shell" style={backgroundStyle} data-search-style={appearance.searchBar}>
        <Header onOpenSettings={() => openSettings('appearance')} />
        <main
          className={`portal-main${data.settings.news.tickerEnabled ? '' : ' portal-main--no-ticker'}`}
          id="main-content"
          tabIndex={-1}
        >
          <SearchBar />
          <Shortcuts />
          <Dashboard onOpenSettings={() => openSettings('layout')} />
        </main>
        {data.settings.news.tickerEnabled && <NewsTicker />}
      </div>
      <SettingsModal
        open={settingsOpen}
        initialTab={settingsTab}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
