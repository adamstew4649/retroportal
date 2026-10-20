import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import type { WidgetSettingsMap, WidgetType } from '../types';

/**
 * A widget manifest is the single build-time definition of a widget type.
 * Drop a new `src/widgets/<Name>/manifest.ts` file in place and Vite's eager
 * glob in `registry.tsx` will pick it up on the next build.
 */
export interface WidgetManifest<K extends WidgetType = WidgetType> {
  type: K;
  title: string;
  description: string;
  /** Controls ordering in the Settings → Layout catalogue. */
  order: number;
  icon: LucideIcon;
  Component: ComponentType;
  Settings: ComponentType;
  createDefaultSettings: () => WidgetSettingsMap[K];
}

export type AnyWidgetManifest = {
  [K in WidgetType]: WidgetManifest<K>;
}[WidgetType];
