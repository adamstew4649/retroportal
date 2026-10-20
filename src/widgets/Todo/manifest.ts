import { ListChecks } from 'lucide-react';
import { createDefaultWidgetSettings } from '../defaults';
import type { WidgetManifest } from '../manifest';
import { TodoSettings, TodoWidget } from './TodoWidget';

const manifest: WidgetManifest<'todo'> = {
  type: 'todo',
  title: 'To-Do List',
  description: 'Tasks with due dates, reordering and local persistence.',
  order: 70,
  icon: ListChecks,
  Component: TodoWidget,
  Settings: TodoSettings,
  createDefaultSettings: () => createDefaultWidgetSettings('todo'),
};

export default manifest;
