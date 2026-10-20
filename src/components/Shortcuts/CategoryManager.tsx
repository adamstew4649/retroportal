import { useEffect, useState } from 'react';
import { FolderCog, Plus, Trash2 } from 'lucide-react';
import type { ShortcutCategory } from '../../types';
import { Modal } from '../Modal/Modal';

interface CategoryManagerProps {
  open: boolean;
  categories: ShortcutCategory[];
  counts: Record<string, number>;
  onClose: () => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

interface CategoryRowProps {
  category: ShortcutCategory;
  count: number;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

function CategoryRow({ category, count, onRename, onRemove }: CategoryRowProps) {
  const [name, setName] = useState(category.name);

  useEffect(() => {
    setName(category.name);
  }, [category.name]);

  const commit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(category.name);
      return;
    }
    if (trimmed !== category.name) onRename(category.id, trimmed);
  };

  return (
    <div className="category-row">
      <input
        className="retro-field"
        value={name}
        maxLength={30}
        aria-label={`Rename ${category.name}`}
        onChange={(event) => setName(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
      <span className="category-row__count">{count} links</span>
      <button
        type="button"
        className="icon-button icon-button--danger"
        aria-label={`Delete ${category.name}`}
        onClick={() => onRemove(category.id)}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function CategoryManager({
  open,
  categories,
  counts,
  onClose,
  onAdd,
  onRename,
  onRemove,
}: CategoryManagerProps) {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const name = newName.trim();
    if (!name) {
      setError('Enter a category name.');
      return;
    }
    if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      setError('A category with that name already exists.');
      return;
    }
    onAdd(name);
    setNewName('');
    setError(null);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Shortcut categories"
      icon={<FolderCog size={16} aria-hidden="true" />}
      footer={
        <button type="button" className="glossy-button" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="form-stack">
        {categories.length === 0 && (
          <p className="empty-state">No categories yet. Shortcuts will appear under “Unfiled”.</p>
        )}
        {categories.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            count={counts[category.id] ?? 0}
            onRename={onRename}
            onRemove={onRemove}
          />
        ))}

        <hr className="retro-divider" />

        <div className="field-row">
          <input
            className="retro-field"
            value={newName}
            maxLength={30}
            placeholder="New category name"
            aria-label="New category name"
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
          />
          <button type="button" className="glossy-button" onClick={add}>
            <Plus size={14} aria-hidden="true" />
            Add
          </button>
        </div>
        {error && (
          <p className="error-note" role="alert">
            {error}
          </p>
        )}
        <p className="info-note">
          Deleting a category moves its shortcuts to “Unfiled” — no links are lost.
        </p>
      </div>
    </Modal>
  );
}
