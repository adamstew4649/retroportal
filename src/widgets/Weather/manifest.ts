import { CloudSun } from 'lucide-react';
import { createDefaultWidgetSettings } from '../defaults';
import type { WidgetManifest } from '../manifest';
import { WeatherSettings, WeatherWidget } from './WeatherWidget';

const manifest: WidgetManifest<'weather'> = {
  type: 'weather',
  title: 'Weather',
  description: 'Current conditions and a short forecast from Open-Meteo.',
  order: 30,
  icon: CloudSun,
  Component: WeatherWidget,
  Settings: WeatherSettings,
  createDefaultSettings: () => createDefaultWidgetSettings('weather'),
};

export default manifest;
