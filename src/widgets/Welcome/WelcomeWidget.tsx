import { useEffect, useState } from 'react';
import { useWidgetSettings } from '../../state/PortalContext';
import { formatUKDate, greetingForHour } from '../../utils/date';
import '../widgets.css';

export function WelcomeWidget() {
  const [settings] = useWidgetSettings('welcome');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const greeting = greetingForHour(now.getHours());
  const name = settings.name.trim();
  const message = settings.message.trim();

  return (
    <div className="welcome-widget">
      <p className="welcome-widget__greeting">
        {greeting}
        {name ? `, ${name}` : ''}!
      </p>
      <p className="welcome-widget__date">{formatUKDate(now)}</p>
      {message ? (
        <p className="welcome-widget__message">{message}</p>
      ) : (
        <p className="welcome-widget__message welcome-widget__message--muted">
          Add a welcome message in this widget&apos;s settings.
        </p>
      )}
      <p className="welcome-widget__footer">
        Welcome to your corner of the old web.
      </p>
    </div>
  );
}

export function WelcomeSettings() {
  const [settings, update] = useWidgetSettings('welcome');
  return (
    <div className="form-stack">
      <label>
        <span className="field-label">Your name</span>
        <input
          className="retro-field"
          value={settings.name}
          maxLength={50}
          placeholder="Optional"
          onChange={(event) => update({ name: event.target.value })}
        />
      </label>
      <label>
        <span className="field-label">Welcome message</span>
        <textarea
          className="retro-textarea"
          value={settings.message}
          maxLength={240}
          rows={3}
          onChange={(event) => update({ message: event.target.value })}
        />
      </label>
    </div>
  );
}
