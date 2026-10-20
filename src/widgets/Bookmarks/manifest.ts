import { Bookmark } from 'lucide-react';
import { createDefaultWidgetSettings } from '../defaults';
import type { WidgetManifest } from '../manifest';
import { BookmarksSettings, BookmarksWidget } from './BookmarksWidget';

const manifest: WidgetManifest<'bookmarks'> = {
  type: 'bookmarks',
  title: 'Bookmarks',
  description: 'A second set of links organised into categories.',
  order: 90,
  icon: Bookmark,
  Component: BookmarksWidget,
  Settings: BookmarksSettings,
  createDefaultSettings: () => createDefaultWidgetSettings('bookmarks'),
};

export default manifest;
