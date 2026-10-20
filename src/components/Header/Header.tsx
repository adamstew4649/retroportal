import { useEffect, useState } from 'react';
import { Check, Compass, LoaderCircle, Settings2, WifiOff } from 'lucide-react';
import { usePortal } from '../../state/PortalContext';
import { formatUKDate } from '../../utils/date';
import './header.css';

interface HeaderProps {
  onOpenSettings: () => void;
}

const TAB_LINKS = [
  { id: 'top', label: 'Home' },
  { id: 'shortcuts-section', label: 'Shortcuts' },
  { id: 'news-widget', label: 'News' },
  { id: 'rss-widget', label: 'Feeds' },
];

function scrollToId(id: string) {
  if (id === 'top') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  element.classList.remove('widget--flash');
  window.requestAnimationFrame(() => element.classList.add('widget--flash'));
  window.setTimeout(() => element.classList.remove('widget--flash'), 1200);
}

export function Header({ onOpenSettings }: HeaderProps) {
  const { data, saveState } = usePortal();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);

  return (
    <header className="portal-header">
      <div className="portal-header__inner">
        <div className="portal-brand">
          <span className="portal-brand__orb" aria-hidden="true">
            <Compass size={25} strokeWidth={2.1} />
          </span>
          <div className="portal-brand__text">
            <h1>{data.settings.portalName}</h1>
            <p>Your personal start page</p>
          </div>
        </div>

        {data.settings.showTabs && (
          <nav className="portal-tabs" aria-label="Portal sections">
            {TAB_LINKS.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                className={`portal-tab${index === 0 ? ' portal-tab--active' : ''}`}
                onClick={() => scrollToId(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        <div className="portal-header__meta">
          <div className="portal-datetime">
            <span className="portal-datetime__time">{time}</span>
            <span className="portal-datetime__date">{formatUKDate(now)}</span>
          </div>
          <span
            className={`save-indicator save-indicator--${saveState}`}
            title="Changes are saved automatically in this browser"
          >
            {saveState === 'saving' ? (
              <LoaderCircle size={13} className="spin" aria-hidden="true" />
            ) : saveState === 'error' ? (
              <WifiOff size={13} aria-hidden="true" />
            ) : (
              <Check size={13} aria-hidden="true" />
            )}
            <span>
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'error'
                  ? 'Not saved'
                  : 'Saved'}
            </span>
          </span>
          <button
            type="button"
            className="glossy-button header-settings-button"
            onClick={onOpenSettings}
            aria-haspopup="dialog"
            aria-label="Open settings"
          >
            <Settings2 size={15} aria-hidden="true" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}
