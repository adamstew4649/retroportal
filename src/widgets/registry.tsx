import type { AnyWidgetManifest } from './manifest';
import type { WidgetType } from '../types';

// Eagerly discover every widget manifest at build time. Adding a widget is a
// matter of dropping a folder with a manifest.ts into src/widgets; no central
// import list needs editing. Vite inlines these modules into the bundle.
const modules = import.meta.glob<{ default: AnyWidgetManifest }>('./*/manifest.ts', {
  eager: true,
});

export const WIDGET_MANIFESTS: AnyWidgetManifest[] = Object.values(modules)
  .map((module) => module.default)
  .sort((a, b) => a.order - b.order);

export const WIDGET_TYPES_ORDER: WidgetType[] = WIDGET_MANIFESTS.map((manifest) => manifest.type);

export const WIDGET_REGISTRY = Object.fromEntries(
  WIDGET_MANIFESTS.map((manifest) => [manifest.type, manifest]),
) as Record<WidgetType, AnyWidgetManifest>;
