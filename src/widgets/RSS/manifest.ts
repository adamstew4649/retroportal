import { Rss } from 'lucide-react';
import { createDefaultWidgetSettings } from '../defaults';
import type { WidgetManifest } from '../manifest';
import { RssSettings, RssWidget } from './RssWidget';

const manifest: WidgetManifest<'rss'> = {
  type: 'rss',
  title: 'RSS Feeds',
  description: 'Follow feeds with bundled snapshots and direct fetching.',
  order: 80,
  icon: Rss,
  Component: RssWidget,
  Settings: RssSettings,
  createDefaultSettings: () => createDefaultWidgetSettings('rss'),
};

export default manifest;
