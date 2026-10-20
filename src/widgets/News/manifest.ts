import { Newspaper } from 'lucide-react';
import { createDefaultWidgetSettings } from '../defaults';
import type { WidgetManifest } from '../manifest';
import { NewsSettings, NewsWidget } from './NewsWidget';

const manifest: WidgetManifest<'news'> = {
  type: 'news',
  title: 'UK News',
  description: 'Aggregated UK, world, technology, business and science headlines.',
  order: 40,
  icon: Newspaper,
  Component: NewsWidget,
  Settings: NewsSettings,
  createDefaultSettings: () => createDefaultWidgetSettings('news'),
};

export default manifest;
