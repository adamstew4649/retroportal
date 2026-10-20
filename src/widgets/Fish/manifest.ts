import { Fish } from 'lucide-react';
import { createDefaultWidgetSettings } from '../defaults';
import type { WidgetManifest } from '../manifest';
import { FishSettings, FishWidget } from './FishWidget';

const manifest: WidgetManifest<'fish'> = {
  type: 'fish',
  title: 'Fish',
  description: 'Hungry little fish that follow your pointer and eat the food you drop.',
  order: 35,
  icon: Fish,
  Component: FishWidget,
  Settings: FishSettings,
  createDefaultSettings: () => createDefaultWidgetSettings('fish'),
};

export default manifest;
