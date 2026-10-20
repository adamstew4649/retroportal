import type { LucideIcon } from 'lucide-react';
import {
  Bookmark,
  CalendarDays,
  Clock3,
  ListChecks,
  Newspaper,
  NotebookPen,
  Rss,
  Search,
  SunMedium,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { WidgetType } from '../types';
import { WelcomeWidget, WelcomeSettings } from './Welcome/WelcomeWidget';
import { ClockWidget, ClockSettings } from './Clock/ClockWidget';
import { WeatherWidget, WeatherSettings } from './Weather/WeatherWidget';
import { CalendarWidget, CalendarSettings } from './Calendar/CalendarWidget';
import { NotesWidget, NotesSettings } from './Notes/NotesWidget';
import { TodoWidget, TodoSettings } from './Todo/TodoWidget';
import { RssWidget, RssSettings } from './RSS/RssWidget';
import { NewsWidget, NewsSettings } from './News/NewsWidget';
import { BookmarksWidget, BookmarksSettings } from './Bookmarks/BookmarksWidget';

export interface WidgetDefinition {
  type: WidgetType;
  title: string;
  description: string;
  icon: LucideIcon;
  Component: ComponentType;
  Settings: ComponentType;
}

export const WIDGET_REGISTRY: Record<WidgetType, WidgetDefinition> = {
  welcome: {
    type: 'welcome',
    title: 'Welcome',
    description: 'A personal greeting that changes through the day.',
    icon: SunMedium,
    Component: WelcomeWidget,
    Settings: WelcomeSettings,
  },
  clock: {
    type: 'clock',
    title: 'Clock',
    description: 'Digital and analogue clocks with UK time zone support.',
    icon: Clock3,
    Component: ClockWidget,
    Settings: ClockSettings,
  },
  weather: {
    type: 'weather',
    title: 'Weather',
    description: 'Current conditions and a short forecast from Open-Meteo.',
    icon: SunMedium,
    Component: WeatherWidget,
    Settings: WeatherSettings,
  },
  news: {
    type: 'news',
    title: 'UK News',
    description: 'Aggregated UK, world, technology, business and science headlines.',
    icon: Newspaper,
    Component: NewsWidget,
    Settings: NewsSettings,
  },
  calendar: {
    type: 'calendar',
    title: 'Calendar',
    description: 'A compact month view with private local events.',
    icon: CalendarDays,
    Component: CalendarWidget,
    Settings: CalendarSettings,
  },
  notes: {
    type: 'notes',
    title: 'Notes',
    description: 'Colour-coded notepad that saves automatically.',
    icon: NotebookPen,
    Component: NotesWidget,
    Settings: NotesSettings,
  },
  todo: {
    type: 'todo',
    title: 'To-Do List',
    description: 'Tasks with due dates, reordering and local persistence.',
    icon: ListChecks,
    Component: TodoWidget,
    Settings: TodoSettings,
  },
  rss: {
    type: 'rss',
    title: 'RSS Feeds',
    description: 'Follow feeds with bundled snapshots and direct fetching.',
    icon: Rss,
    Component: RssWidget,
    Settings: RssSettings,
  },
  bookmarks: {
    type: 'bookmarks',
    title: 'Bookmarks',
    description: 'A second set of links organised into categories.',
    icon: Bookmark,
    Component: BookmarksWidget,
    Settings: BookmarksSettings,
  },
};

export const SEARCH_ICON = Search;
