import { useEffect, useMemo, useState } from 'react';
import { useWidgetSettings } from '../../state/PortalContext';
import { formatDateInZone, formatTimeInZone } from '../../utils/date';
import '../widgets.css';

const TIME_ZONES = [
  'Europe/London',
  'Europe/Dublin',
  'UTC',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Kolkata',
  'Australia/Sydney',
];

function zoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const name =
    new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? timeZone;
  return { hours: get('hour') % 24, minutes: get('minute'), seconds: get('second'), name };
}

export function ClockWidget() {
  const [settings] = useWidgetSettings('clock');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const time = formatTimeInZone(now, settings.timeZone, settings.hour12, settings.showSeconds);
  const date = formatDateInZone(now, settings.timeZone);
  const parts = useMemo(() => zoneParts(now, settings.timeZone), [now, settings.timeZone]);

  const secondAngle = parts.seconds * 6;
  const minuteAngle = parts.minutes * 6 + parts.seconds * 0.1;
  const hourAngle = (parts.hours % 12) * 30 + parts.minutes * 0.5;

  return (
    <div className="clock-widget">
      {settings.analogue && (
        <div className="clock-analogue" role="img" aria-label={`Analogue clock showing ${time}`}>
          <svg viewBox="0 0 100 100">
            <defs>
              <radialGradient id="clock-face" cx="42%" cy="32%" r="78%">
                <stop offset="0%" stopColor="#31414f" />
                <stop offset="100%" stopColor="#151c24" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="47" fill="url(#clock-face)" stroke="#5d6f82" strokeWidth="2" />
            <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            {Array.from({ length: 12 }).map((_, index) => {
              const angle = (index * 30 * Math.PI) / 180;
              const x1 = 50 + Math.sin(angle) * 39;
              const y1 = 50 - Math.cos(angle) * 39;
              const x2 = 50 + Math.sin(angle) * 43;
              const y2 = 50 - Math.cos(angle) * 43;
              return (
                <line
                  key={index}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(232,237,244,0.7)"
                  strokeWidth={index % 3 === 0 ? 2.4 : 1.2}
                  strokeLinecap="round"
                />
              );
            })}
            <line
              x1="50"
              y1="50"
              x2={50 + Math.sin((hourAngle * Math.PI) / 180) * 24}
              y2={50 - Math.cos((hourAngle * Math.PI) / 180) * 24}
              stroke="#eef4fb"
              strokeWidth="3.6"
              strokeLinecap="round"
            />
            <line
              x1="50"
              y1="50"
              x2={50 + Math.sin((minuteAngle * Math.PI) / 180) * 34}
              y2={50 - Math.cos((minuteAngle * Math.PI) / 180) * 34}
              stroke="#cfe0f2"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <line
              x1="50"
              y1="50"
              x2={50 + Math.sin((secondAngle * Math.PI) / 180) * 36}
              y2={50 - Math.cos((secondAngle * Math.PI) / 180) * 36}
              stroke="var(--accent)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <circle cx="50" cy="50" r="3.2" fill="var(--accent)" stroke="#10171f" strokeWidth="1" />
          </svg>
        </div>
      )}
      <p className="clock-widget__time">{time}</p>
      <p className="clock-widget__date">{date}</p>
      <p className="clock-widget__zone">
        {parts.name} · {settings.hour12 ? '12-hour' : '24-hour'}
      </p>
    </div>
  );
}

export function ClockSettings() {
  const [settings, update] = useWidgetSettings('clock');
  return (
    <div className="form-stack">
      <label className="retro-check">
        <input
          type="checkbox"
          checked={settings.analogue}
          onChange={(event) => update({ analogue: event.target.checked })}
        />
        Show analogue clock
      </label>
      <label className="retro-check">
        <input
          type="checkbox"
          checked={settings.hour12}
          onChange={(event) => update({ hour12: event.target.checked })}
        />
        Use 12-hour time
      </label>
      <label className="retro-check">
        <input
          type="checkbox"
          checked={settings.showSeconds}
          onChange={(event) => update({ showSeconds: event.target.checked })}
        />
        Show seconds
      </label>
      <label>
        <span className="field-label">Time zone</span>
        <input
          className="retro-field"
          list="clock-time-zones"
          value={settings.timeZone}
          onChange={(event) => update({ timeZone: event.target.value || 'Europe/London' })}
          onBlur={(event) => {
            try {
              new Intl.DateTimeFormat('en-GB', { timeZone: event.target.value });
            } catch {
              update({ timeZone: 'Europe/London' });
            }
          }}
        />
        <datalist id="clock-time-zones">
          {TIME_ZONES.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </label>
      <p className="info-note">UK users default to Europe/London, so BST and GMT change automatically.</p>
    </div>
  );
}
