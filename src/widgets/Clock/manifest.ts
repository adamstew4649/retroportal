import { Clock3 } from 'lucide-react';
import { createDefaultWidgetSettings } from '../defaults';
import type { WidgetManifest } from '../manifest';
import { ClockSettings, ClockWidget } from './ClockWidget';

const manifest: WidgetManifest<'clock'> = {
  type: 'clock',
  title: 'Clock',
  description: 'Digital and analogue clocks with UK time zone support.',
  order: 20,
  icon: Clock3,
  Component: ClockWidget,
  Settings: ClockSettings,
  createDefaultSettings: () => createDefaultWidgetSettings('clock'),
};

export default manifest;
