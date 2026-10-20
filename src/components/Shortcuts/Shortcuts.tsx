import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FolderCog,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
} from 'lucide-react';
import { usePortal } from '../../state/PortalContext';
import { createDefaultPortalData } from '../../config/defaults';
import { createId } from '../../utils/id';
import type { Shortcut } from '../../types';
import { ShortcutIcon } from './ShortcutIcon';
import { ShortcutEditor } from './ShortcutEditor';
import { CategoryManager } from './CategoryManager';
import { useToast } from '../../state/ToastContext';
import './shortcuts.css';

type Filter = 'all' | 'uncategorised' | string;

interface SortableShortcutProps {
  shortcut: Shortcut;
  editMode: boolean;
  compact: boolean;
  showLabels: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

function SortableShortcut({
  shortcut,
  editMode,
  compact,
  showLabels,
  onEdit,
  onRemove,
}: SortableShortcutProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: shortcut.id,
    disabled: !editMode,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 5 : undefined,
    opacity: isDragging ? 0.65 : undefined,
  };

  const tileClass = [
    'shortcut-tile',
    compact ? 'shortcut-tile--compact' : '',
    editMode ? 'shortcut-tile--editing' : '',
    isDragging ? 'shortcut-tile--dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      <span className="shortcut-tile__gloss" aria-hidden="true" />
      <ShortcutIcon icon={shortcut.icon} label={shortcut.label} url={shortcut.url} size={compact ? 'small' : 'large'} />
      {showLabels && <span className="shortcut-tile__label">{shortcut.label}</span>}
    </>
  );

  if (!editMode) {
    return (
      <div ref={setNodeRef} style={style}>
        <a
          className={tileClass}
          href={shortcut.url}
          target="_blank"
          rel="noopener noreferrer"
          title={shortcut.label}
          aria-label={`Open ${shortcut.label} in a new tab`}
        >
          {inner}
        </a>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={tileClass}>
      <span className="shortcut-tile__gloss" aria-hidden="true" />
      <button
        type="button"
        className="shortcut-tile__drag"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${shortcut.label}`}
      >
        <GripVertical size={13} aria-hidden="true" />
      </button>
      <ShortcutIcon icon={shortcut.icon} label={shortcut.label} url={shortcut.url} size={compact ? 'small' : 'large'} />
      {showLabels && <span className="shortcut-tile__label">{shortcut.label}</span>}
      <span className="shortcut-tile__actions">
        <button
          type="button"
          className="shortcut-tile__action"
          onClick={onEdit}
          aria-label={`Edit ${shortcut.label}`}
          title="Edit"
        >
          <Pencil size={11} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="shortcut-tile__action shortcut-tile__action--danger"
          onClick={onRemove}
          aria-label={`Remove ${shortcut.label}`}
          title="Remove"
        >
          <Trash2 size={11} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

export function Shortcuts() {
  const { data, setData } = usePortal();
  const { notify } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const categories = data.shortcutCategories;
  const compact = data.settings.shortcuts.style === 'compact';
  const showLabels = data.settings.shortcuts.showLabels;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (filter !== 'all' && filter !== 'uncategorised' && !categories.some((category) => category.id === filter)) {
      setFilter('all');
    }
  }, [categories, filter]);

  const matchesFilter = (shortcut: Shortcut) => {
    if (filter === 'all') return true;
    if (filter === 'uncategorised') return !shortcut.categoryId;
    return shortcut.categoryId === filter;
  };

  const visibleShortcuts = useMemo(
    () => data.shortcuts.filter((shortcut) => matchesFilter(shortcut)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.shortcuts, filter],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const shortcut of data.shortcuts) {
      counts[shortcut.categoryId || 'uncategorised'] =
        (counts[shortcut.categoryId || 'uncategorised'] ?? 0) + 1;
    }
    return counts;
  }, [data.shortcuts]);

  const openAdd = () => {
    setEditingShortcut(null);
    setEditorOpen(true);
  };

  const openEdit = (shortcut: Shortcut) => {
    setEditingShortcut(shortcut);
    setEditorOpen(true);
  };

  const saveShortcut = (shortcut: Shortcut) => {
    setData((current) => {
      const exists = current.shortcuts.some((item) => item.id === shortcut.id);
      return {
        ...current,
        shortcuts: exists
          ? current.shortcuts.map((item) => (item.id === shortcut.id ? shortcut : item))
          : [...current.shortcuts, shortcut],
      };
    });
    notify(editingShortcut ? 'Shortcut updated.' : 'Shortcut added.', 'success');
  };

  const removeShortcut = (shortcut: Shortcut) => {
    if (!window.confirm(`Remove the ${shortcut.label} shortcut?`)) return;
    setData((current) => ({
      ...current,
      shortcuts: current.shortcuts.filter((item) => item.id !== shortcut.id),
    }));
    notify('Shortcut removed.', 'success');
  };

  const restoreDefaults = () => {
    if (!window.confirm('Restore the six default shortcuts and categories? Your custom shortcuts will be replaced.')) {
      return;
    }
    const defaults = createDefaultPortalData();
    setData((current) => ({
      ...current,
      shortcuts: defaults.shortcuts,
      shortcutCategories: defaults.shortcutCategories,
    }));
    setFilter('all');
    notify('Default shortcuts restored.', 'success');
  };

  const addCategory = (name: string) => {
    const category = { id: createId('category'), name };
    setData((current) => ({
      ...current,
      shortcutCategories: [...current.shortcutCategories, category],
    }));
  };

  const renameCategory = (id: string, name: string) => {
    setData((current) => ({
      ...current,
      shortcutCategories: current.shortcutCategories.map((category) =>
        category.id === id ? { ...category, name } : category,
      ),
    }));
  };

  const removeCategory = (id: string) => {
    if (!window.confirm('Delete this category? Its shortcuts will move to “Unfiled”.')) return;
    setData((current) => ({
      ...current,
      shortcutCategories: current.shortcutCategories.filter((category) => category.id !== id),
      shortcuts: current.shortcuts.map((shortcut) =>
        shortcut.categoryId === id ? { ...shortcut, categoryId: '' } : shortcut,
      ),
    }));
    if (filter === id) setFilter('all');
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setData((current) => {
      const matches = (shortcut: Shortcut) => {
        if (filter === 'all') return true;
        if (filter === 'uncategorised') return !shortcut.categoryId;
        return shortcut.categoryId === filter;
      };
      if (filter === 'all') {
        const oldIndex = current.shortcuts.findIndex((item) => item.id === active.id);
        const newIndex = current.shortcuts.findIndex((item) => item.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return current;
        return { ...current, shortcuts: arrayMove(current.shortcuts, oldIndex, newIndex) };
      }
      const subset = current.shortcuts.filter(matches);
      const oldIndex = subset.findIndex((item) => item.id === active.id);
      const newIndex = subset.findIndex((item) => item.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      const reordered = arrayMove(subset, oldIndex, newIndex);
      let cursor = 0;
      return {
        ...current,
        shortcuts: current.shortcuts.map((item) =>
          matches(item) ? reordered[cursor++] : item,
        ),
      };
    });
  };

  const categoryName = (id: string) =>
    id === 'all'
      ? 'All'
      : id === 'uncategorised'
        ? 'Unfiled'
        : (categories.find((category) => category.id === id)?.name ?? 'Unknown');

  return (
    <section className="shortcuts-section" id="shortcuts-section" aria-label="Quick access shortcuts">
      <div className="section-bar">
        <div className="section-bar__title">
          <h2>Quick Access</h2>
          <span className="section-bar__count">{data.shortcuts.length} links</span>
        </div>
        <div className="section-bar__actions">
          {editMode ? (
            <>
              <button type="button" className="mini-button" onClick={openAdd}>
                <Plus size={12} aria-hidden="true" /> Add
              </button>
              <button type="button" className="mini-button" onClick={() => setCategoriesOpen(true)}>
                <FolderCog size={12} aria-hidden="true" /> Categories
              </button>
              <button type="button" className="mini-button" onClick={restoreDefaults}>
                <RotateCcw size={12} aria-hidden="true" /> Defaults
              </button>
              <button
                type="button"
                className="glossy-button glossy-button--primary shortcuts-done"
                onClick={() => setEditMode(false)}
              >
                Done
              </button>
            </>
          ) : (
            <button type="button" className="mini-button" onClick={() => setEditMode(true)}>
              <Settings2 size={12} aria-hidden="true" /> Customise
            </button>
          )}
        </div>
      </div>

      <div className="shortcut-filter" role="group" aria-label="Filter shortcuts by category">
        {(['all', ...categories.map((category) => category.id), ...(categoryCounts.uncategorised ? ['uncategorised'] : [])] as Filter[]).map(
          (id) => (
            <button
              key={id}
              type="button"
              className={`shortcut-filter__button${filter === id ? ' shortcut-filter__button--active' : ''}`}
              onClick={() => setFilter(id)}
            >
              {categoryName(id)}
            </button>
          ),
        )}
      </div>

      {editMode && (
        <p className="shortcuts-edit-hint">
          Drag the grip to reorder. Filtered categories reorder within their own group.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visibleShortcuts.map((shortcut) => shortcut.id)} strategy={rectSortingStrategy}>
          <div className={`shortcut-grid${compact ? ' shortcut-grid--compact' : ''}`}>
            {visibleShortcuts.map((shortcut) => (
              <SortableShortcut
                key={shortcut.id}
                shortcut={shortcut}
                editMode={editMode}
                compact={compact}
                showLabels={showLabels}
                onEdit={() => openEdit(shortcut)}
                onRemove={() => removeShortcut(shortcut)}
              />
            ))}
            {editMode && (
              <button type="button" className="shortcut-add-tile" onClick={openAdd}>
                <Plus size={20} aria-hidden="true" />
                <span>Add shortcut</span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {visibleShortcuts.length === 0 && !editMode && (
        <p className="empty-state">No shortcuts in this category yet.</p>
      )}

      <ShortcutEditor
        open={editorOpen}
        shortcut={editingShortcut}
        categories={categories}
        defaultCategoryId={filter !== 'all' && filter !== 'uncategorised' ? filter : ''}
        onClose={() => setEditorOpen(false)}
        onSave={saveShortcut}
      />

      <CategoryManager
        open={categoriesOpen}
        categories={categories}
        counts={categoryCounts}
        onClose={() => setCategoriesOpen(false)}
        onAdd={addCategory}
        onRename={renameCategory}
        onRemove={removeCategory}
      />
    </section>
  );
}
