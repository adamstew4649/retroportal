import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { usePortal, useWidgetSettings } from '../../state/PortalContext';
import { createId } from '../../utils/id';
import { fromDateKey, toDateKey } from '../../utils/date';
import '../widgets.css';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_LABELS_SUNDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarWidget() {
  const { data, setData } = usePortal();
  const [settings] = useWidgetSettings('calendar');
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => toDateKey(today));
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');

  const weekLabels = settings.weekStartsOn === 0 ? WEEKDAY_LABELS_SUNDAY : WEEKDAY_LABELS;

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() - settings.weekStartsOn + 7) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [month, settings.weekStartsOn]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof data.calendarEvents>();
    for (const event of data.calendarEvents) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [data.calendarEvents]);

  const selectedEvents = (eventsByDate.get(selected) ?? []).slice().sort((a, b) =>
    (a.time ?? '').localeCompare(b.time ?? ''),
  );

  const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(month);
  const todayKey = toDateKey(today);

  const addEvent = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setData((current) => ({
      ...current,
      calendarEvents: [
        ...current.calendarEvents,
        {
          id: createId('event'),
          date: selected,
          title: trimmed.slice(0, 120),
          time: /^\d{2}:\d{2}$/.test(time) ? time : undefined,
          colour: 'blue',
        },
      ],
    }));
    setTitle('');
    setTime('');
  };

  const removeEvent = (id: string) => {
    setData((current) => ({
      ...current,
      calendarEvents: current.calendarEvents.filter((event) => event.id !== id),
    }));
  };

  return (
    <div className="calendar-widget">
      <div className="calendar-nav">
        <button
          type="button"
          className="widget-header__button"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft size={13} aria-hidden="true" />
        </button>
        <span className="calendar-nav__label" aria-live="polite">
          {monthLabel}
        </span>
        <button
          type="button"
          className="widget-header__button"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          aria-label="Next month"
        >
          <ChevronRight size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="mini-button calendar-nav__today"
          onClick={() => {
            setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
            setSelected(todayKey);
          }}
        >
          Today
        </button>
      </div>

      <div className="calendar-grid" role="grid" aria-label={monthLabel}>
        {weekLabels.map((label) => (
          <span className="calendar-grid__weekday" role="columnheader" key={label}>
            {label.slice(0, 1)}
          </span>
        ))}
        {days.map((date) => {
          const key = toDateKey(date);
          const inMonth = date.getMonth() === month.getMonth();
          const hasEvents = (eventsByDate.get(key)?.length ?? 0) > 0;
          return (
            <button
              type="button"
              key={key}
              className={[
                'calendar-day',
                inMonth ? '' : 'calendar-day--outside',
                key === todayKey ? 'calendar-day--today' : '',
                key === selected ? 'calendar-day--selected' : '',
                hasEvents ? 'calendar-day--event' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSelected(key)}
              aria-pressed={key === selected}
              aria-label={`${date.toDateString()}${hasEvents ? ', has events' : ''}`}
            >
              {date.getDate()}
              {hasEvents && <span className="calendar-day__dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="calendar-events">
        <p className="calendar-events__heading">
          <CalendarDays size={12} aria-hidden="true" />
          {fromDateKey(selected).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}
        </p>
        {selectedEvents.length === 0 ? (
          <p className="text-small text-muted">No events. Add one below.</p>
        ) : (
          <ul className="calendar-events__list">
            {selectedEvents.map((event) => (
              <li key={event.id}>
                {event.time && <span className="calendar-events__time">{event.time}</span>}
                <span className="calendar-events__title">{event.title}</span>
                <button
                  type="button"
                  className="icon-button icon-button--danger calendar-events__delete"
                  onClick={() => removeEvent(event.id)}
                  aria-label={`Delete ${event.title}`}
                >
                  <Trash2 size={11} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="calendar-add">
          <input
            className="retro-field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add an event…"
            aria-label="Event title"
            maxLength={120}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addEvent();
              }
            }}
          />
          <input
            className="retro-field calendar-add__time"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            aria-label="Event time (optional)"
          />
          <button
            type="button"
            className="glossy-button calendar-add__button"
            onClick={addEvent}
            disabled={!title.trim()}
            aria-label="Add event"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function CalendarSettings() {
  const [settings, update] = useWidgetSettings('calendar');
  return (
    <div className="form-stack">
      <label>
        <span className="field-label">Week starts on</span>
        <select
          className="retro-select"
          value={settings.weekStartsOn}
          onChange={(event) => update({ weekStartsOn: Number(event.target.value) === 0 ? 0 : 1 })}
        >
          <option value={1}>Monday</option>
          <option value={0}>Sunday</option>
        </select>
      </label>
      <p className="info-note">
        Events are stored privately in this browser. Nothing is sent to Google or any other service.
      </p>
    </div>
  );
}
