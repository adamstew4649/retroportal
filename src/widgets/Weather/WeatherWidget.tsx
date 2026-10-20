import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  LoaderCircle,
  MapPin,
  Moon,
  Search,
  Sun,
  TriangleAlert,
  Wind,
} from 'lucide-react';
import { useWidgetSettings } from '../../state/PortalContext';
import {
  fetchWeather,
  searchLocations,
  weatherDescription,
  weatherKind,
  type GeocodeLocation,
} from '../../services/weather/weather';
import type { WeatherData } from '../../types';
import { formatShortDate } from '../../utils/date';
import '../widgets.css';

function WeatherIcon({ code, isDay, size = 52 }: { code: number; isDay: boolean; size?: number }) {
  const weather = weatherKind(code, isDay);
  const props = { size, strokeWidth: 1.4 } as const;
  switch (weather) {
    case 'clear':
      return isDay ? <Sun {...props} /> : <Moon {...props} />;
    case 'partly':
      return <CloudSun {...props} />;
    case 'fog':
      return <CloudFog {...props} />;
    case 'drizzle':
      return <CloudDrizzle {...props} />;
    case 'rain':
      return <CloudRain {...props} />;
    case 'snow':
      return <CloudSnow {...props} />;
    case 'storm':
      return <CloudLightning {...props} />;
    default:
      return <Cloud {...props} />;
  }
}

function unitSuffix(unit: 'celsius' | 'fahrenheit') {
  return unit === 'celsius' ? '°C' : '°F';
}

export function WeatherWidget() {
  const [settings] = useWidgetSettings('weather');
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    fetchWeather(settings.location, settings.unit, controller.signal).then((result) => {
      if (cancelled) return;
      setData(result.data);
      setError(result.error ?? null);
      setStale(result.stale);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [settings.location, settings.unit]);

  if (loading && !data) {
    return (
      <div className="weather-widget" aria-busy="true">
        <div className="loading-skeleton skeleton-block" />
        <div className="loading-skeleton skeleton-line" />
        <div className="loading-skeleton skeleton-line" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="weather-widget">
        <div className="empty-state">
          <TriangleAlert size={18} aria-hidden="true" />
          <p>{error ?? 'Weather is unavailable right now.'}</p>
        </div>
        <p className="text-small text-muted">Weather data: Open-Meteo</p>
      </div>
    );
  }

  return (
    <div className="weather-widget">
      <div className="weather-now">
        <span className="weather-now__icon" aria-hidden="true">
          <WeatherIcon code={data.code} isDay={data.isDay} />
        </span>
        <div>
          <p className="weather-now__temp">
            {Math.round(data.temperature)}
            <span>{unitSuffix(data.unit)}</span>
          </p>
          <p className="weather-now__desc">{weatherDescription(data.code)}</p>
          <p className="weather-now__location">
            <MapPin size={11} aria-hidden="true" />
            {data.location.name}
            {data.location.country ? `, ${data.location.country}` : ''}
          </p>
        </div>
      </div>

      <dl className="weather-stats">
        <div>
          <dt>Feels like</dt>
          <dd>
            {Math.round(data.apparentTemperature)}
            {unitSuffix(data.unit)}
          </dd>
        </div>
        <div>
          <dt>High / Low</dt>
          <dd>
            {Math.round(data.high)}° / {Math.round(data.low)}°
          </dd>
        </div>
        <div>
          <dt>
            <Wind size={11} aria-hidden="true" /> Wind
          </dt>
          <dd>{Math.round(data.windSpeed)} mph</dd>
        </div>
        <div>
          <dt>Humidity</dt>
          <dd>{Math.round(data.humidity)}%</dd>
        </div>
      </dl>

      {settings.forecast && data.forecast.length > 1 && (
        <div className="weather-forecast">
          {data.forecast.slice(1, 4).map((day) => (
            <div key={day.date} className="weather-forecast__day">
              <span className="weather-forecast__name">{formatShortDate(`${day.date}T12:00:00`)}</span>
              <span className="weather-forecast__icon" aria-hidden="true">
                <WeatherIcon code={day.code} isDay size={26} />
              </span>
              <span className="weather-forecast__temp">
                {Math.round(day.high)}° <em>{Math.round(day.low)}°</em>
              </span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="error-note" role="status">
          <TriangleAlert size={13} aria-hidden="true" />
          <span>
            {error}
            {stale ? ' Showing the last successful update.' : ''}
          </span>
        </p>
      )}

      <p className="weather-widget__credit">
        {stale ? 'Cached data · ' : ''}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
          Open-Meteo
        </a>
      </p>
    </div>
  );
}

export function WeatherSettings() {
  const [settings, update] = useWidgetSettings('weather');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchLocations(trimmed, controller.signal)
        .then((found) => {
          setResults(found);
          setError(null);
        })
        .catch((caught) => {
          if (controller.signal.aborted) return;
          setError(caught instanceof Error ? caught.message : 'Location search failed.');
        })
        .finally(() => setSearching(false));
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="form-stack">
      <div>
        <span className="field-label">Location</span>
        <p className="text-small">
          {settings.location.name}
          {settings.location.country ? `, ${settings.location.country}` : ''} ·{' '}
          {settings.location.latitude.toFixed(2)}, {settings.location.longitude.toFixed(2)}
        </p>
      </div>

      <label>
        <span className="field-label">Search for a town or city</span>
        <div className="field-row">
          <input
            className="retro-field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. Manchester"
            autoComplete="off"
          />
          {searching && <LoaderCircle size={15} className="spin" aria-label="Searching" />}
        </div>
      </label>

      {error && (
        <p className="error-note" role="alert">
          <TriangleAlert size={13} aria-hidden="true" /> {error}
        </p>
      )}

      {results.length > 0 && (
        <ul className="location-results">
          {results.map((result) => (
            <li key={`${result.latitude}-${result.longitude}`}>
              <button
                type="button"
                className="location-results__button"
                onClick={() => {
                  update({
                    location: {
                      name: result.name,
                      country: result.country,
                      latitude: result.latitude,
                      longitude: result.longitude,
                    },
                  });
                  setQuery('');
                  setResults([]);
                }}
              >
                <Search size={12} aria-hidden="true" />
                <span>
                  {result.name}
                  {result.admin1 && result.admin1 !== result.name ? `, ${result.admin1}` : ''}
                  {result.country ? `, ${result.country}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="form-grid">
        <label>
          <span className="field-label">Latitude</span>
          <input
            className="retro-field"
            type="number"
            step="0.0001"
            min={-90}
            max={90}
            value={settings.location.latitude}
            onChange={(event) =>
              update({
                location: { ...settings.location, latitude: Number(event.target.value) || 0 },
              })
            }
          />
        </label>
        <label>
          <span className="field-label">Longitude</span>
          <input
            className="retro-field"
            type="number"
            step="0.0001"
            min={-180}
            max={180}
            value={settings.location.longitude}
            onChange={(event) =>
              update({
                location: { ...settings.location, longitude: Number(event.target.value) || 0 },
              })
            }
          />
        </label>
      </div>

      <label>
        <span className="field-label">Units</span>
        <select
          className="retro-select"
          value={settings.unit}
          onChange={(event) => update({ unit: event.target.value as 'celsius' | 'fahrenheit' })}
        >
          <option value="celsius">Celsius (°C)</option>
          <option value="fahrenheit">Fahrenheit (°F)</option>
        </select>
      </label>

      <label className="retro-check">
        <input
          type="checkbox"
          checked={settings.forecast}
          onChange={(event) => update({ forecast: event.target.checked })}
        />
        Show multi-day forecast
      </label>

      <p className="info-note">
        Wind is always shown in mph. No precise geolocation permission is requested — search for a
        place or enter coordinates.
      </p>
    </div>
  );
}
