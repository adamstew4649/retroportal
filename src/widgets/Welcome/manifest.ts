import { SunMedium } from 'lucide-react';
import { createDefaultWidgetSettings } from '../defaults';
import type { WidgetManifest } from '../manifest';
import { WelcomeSettings, WelcomeWidget } from './WelcomeWidget';

const manifest: WidgetManifest<'welcome'> = {
  type: 'welcome',
  title: 'Welcome',
  description: 'A personal greeting that changes through the day.',
  order: 10,
  icon: SunMedium,
  Component: WelcomeWidget,
  Settings: WelcomeSettings,
  createDefaultSettings: () => createDefaultWidgetSettings('welcome'),
};

export default manifest;
