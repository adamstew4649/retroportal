import { CalendarDays } from 'lucide-react';
import { createDefaultWidgetSettings } from '../defaults';
import type { WidgetManifest } from '../manifest';
import { CalendarSettings, CalendarWidget } from './CalendarWidget';

const manifest: WidgetManifest<'calendar'> = {
  type: 'calendar',
  title: 'Calendar',
  description: 'A compact month view with private local events.',
  order: 50,
  icon: CalendarDays,
  Component: CalendarWidget,
  Settings: CalendarSettings,
  createDefaultSettings: () => createDefaultWidgetSettings('calendar'),
};

export default manifest;
