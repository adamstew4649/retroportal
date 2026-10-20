import { WEATHER_CACHE_KEY } from '../../config/defaults';
import type { WeatherData, WeatherLocation } from '../../types';

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light rain showers',
  81: 'Rain showers',
  82: 'Violent rain showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm with hail',
};

export function weatherDescription(code: number): string {
  return WEATHER_CODES[code] ?? 'Unsettled weather';
}

export type WeatherKind =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm';

export function weatherKind(code: number, isDay = true): WeatherKind {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return isDay ? 'partly' : 'clear';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

interface CachedWeather {
  savedAt: number;
  data: WeatherData;
}

function cacheKey(location: WeatherLocation, unit: string): string {
  return `${WEATHER_CACHE_KEY}:${location.latitude.toFixed(2)}:${location.longitude.toFixed(2)}:${unit}`;
}

function readCache(location: WeatherLocation, unit: string): CachedWeather | null {
  try {
    const raw = localStorage.getItem(cacheKey(location, unit));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeather;
    return parsed.data && typeof parsed.data.temperature === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(location: WeatherLocation, unit: string, data: WeatherData): void {
  try {
    localStorage.setItem(cacheKey(location, unit), JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Best effort.
  }
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
    is_day?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
}

export interface WeatherResult {
  data: WeatherData | null;
  error?: string;
  stale: boolean;
  cachedAt?: number;
}

export async function fetchWeather(
  location: WeatherLocation,
  unit: 'celsius' | 'fahrenheit',
  signal?: AbortSignal,
): Promise<WeatherResult> {
  const cached = readCache(location, unit);
  if (cached && Date.now() - cached.savedAt < 15 * 60_000) {
    return { data: cached.data, stale: Date.now() - cached.savedAt > 10 * 60_000, cachedAt: cached.savedAt };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(location.latitude));
    url.searchParams.set('longitude', String(location.longitude));
    url.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    );
    url.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min',
    );
    url.searchParams.set('forecast_days', '4');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('wind_speed_unit', 'mph');
    url.searchParams.set('temperature_unit', unit);
    if (unit === 'fahrenheit') url.searchParams.set('wind_speed_unit', 'mph');

    const response = await fetch(url.toString(), { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) throw new Error(`Weather service returned HTTP ${response.status}.`);
    const payload = (await response.json()) as OpenMeteoResponse;
    const current = payload.current;
    if (!current || typeof current.temperature_2m !== 'number') {
      throw new Error('Weather data was incomplete.');
    }

    const forecast = (payload.daily?.time ?? []).slice(0, 4).map((date, index) => ({
      date,
      code: payload.daily?.weather_code?.[index] ?? 0,
      high: payload.daily?.temperature_2m_max?.[index] ?? current.temperature_2m!,
      low: payload.daily?.temperature_2m_min?.[index] ?? current.temperature_2m!,
    }));

    const data: WeatherData = {
      temperature: current.temperature_2m,
      apparentTemperature: current.apparent_temperature ?? current.temperature_2m,
      humidity: current.relative_humidity_2m ?? 0,
      windSpeed: current.wind_speed_10m ?? 0,
      code: current.weather_code ?? 0,
      isDay: current.is_day !== 0,
      high: forecast[0]?.high ?? current.temperature_2m,
      low: forecast[0]?.low ?? current.temperature_2m,
      forecast,
      fetchedAt: Date.now(),
      unit,
      location,
    };
    writeCache(location, unit, data);
    return { data, stale: false, cachedAt: data.fetchedAt };
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'The weather service took too long to respond.'
        : error instanceof Error
          ? error.message
          : 'Weather is unavailable right now.';
    if (cached) {
      return { data: cached.data, error: message, stale: true, cachedAt: cached.savedAt };
    }
    return { data: null, error: message, stale: false };
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

interface GeocodeResponse {
  results?: Array<{
    name?: string;
    latitude?: number;
    longitude?: number;
    country?: string;
    admin1?: string;
  }>;
}

export interface GeocodeLocation extends WeatherLocation {
  admin1?: string;
}

export async function searchLocations(query: string, signal?: AbortSignal): Promise<GeocodeLocation[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', trimmed);
  url.searchParams.set('count', '6');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString(), { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('Location search is unavailable.');
  const payload = (await response.json()) as GeocodeResponse;
  return (payload.results ?? [])
    .filter(
      (result) =>
        typeof result.name === 'string' &&
        typeof result.latitude === 'number' &&
        typeof result.longitude === 'number',
    )
    .map((result) => ({
      name: result.name!,
      admin1: result.admin1,
      country: result.country,
      latitude: result.latitude!,
      longitude: result.longitude!,
    }));
}
