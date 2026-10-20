import { NotebookPen } from 'lucide-react';
import { createDefaultWidgetSettings } from '../defaults';
import type { WidgetManifest } from '../manifest';
import { NotesSettings, NotesWidget } from './NotesWidget';

const manifest: WidgetManifest<'notes'> = {
  type: 'notes',
  title: 'Notes',
  description: 'Colour-coded notepad that saves automatically.',
  order: 60,
  icon: NotebookPen,
  Component: NotesWidget,
  Settings: NotesSettings,
  createDefaultSettings: () => createDefaultWidgetSettings('notes'),
};

export default manifest;
