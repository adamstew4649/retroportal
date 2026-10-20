import { useEffect, useState, type FormEvent } from 'react';
import { Bookmark, ExternalLink, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { usePortal, useWidgetSettings } from '../../state/PortalContext';
import { createId } from '../../utils/id';
import { safeHttpUrlWithHttpsFallback } from '../../utils/url';
import type { BookmarkLink } from '../../types';
import { Modal } from '../../components/Modal/Modal';
import '../widgets.css';

interface LinkEditorProps {
  open: boolean;
  link: BookmarkLink | null;
  defaultCategoryId: string;
  categories: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSave: (link: BookmarkLink, categoryId: string) => void;
}

function LinkEditor({ open, link, defaultCategoryId, categories, onClose, onSave }: LinkEditorProps) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(link?.label ?? '');
    setUrl(link?.url ?? '');
    setCategoryId(defaultCategoryId);
    setError(null);
  }, [open, link, defaultCategoryId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = label.trim();
    const safe = safeHttpUrlWithHttpsFallback(url);
    if (!trimmed) {
      setError('Enter a label.');
      return;
    }
    if (!safe) {
      setError('Enter a valid http:// or https:// address.');
      return;
    }
    onSave({ id: link?.id ?? createId('bookmark'), label: trimmed.slice(0, 60), url: safe }, categoryId);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={link ? 'Edit bookmark' : 'Add bookmark'}
      icon={<Bookmark size={16} aria-hidden="true" />}
      footer={
        <>
          <button type="button" className="glossy-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="bookmark-form" className="glossy-button glossy-button--primary">
            Save
          </button>
        </>
      }
    >
      <form id="bookmark-form" className="form-stack" onSubmit={submit} noValidate>
        <label>
          <span className="field-label">Label</span>
          <input
            className="retro-field"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={60}
            autoComplete="off"
          />
        </label>
        <label>
          <span className="field-label">Address</span>
          <input
            className="retro-field"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com"
            inputMode="url"
          />
        </label>
        <label>
          <span className="field-label">Category</span>
          <select
            className="retro-select"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="error-note" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export function BookmarksWidget() {
  const { data, setData } = usePortal();
  const [settings] = useWidgetSettings('bookmarks');
  const [editMode, setEditMode] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<{ link: BookmarkLink; categoryId: string } | null>(null);
  const [addCategoryId, setAddCategoryId] = useState<string>('');
  const [newCategory, setNewCategory] = useState('');

  const defaultCategoryId = data.bookmarks[0]?.id ?? '';

  const saveLink = (link: BookmarkLink, categoryId: string) => {
    setData((current) => {
      const exists = current.bookmarks.some((category) =>
        category.links.some((item) => item.id === link.id),
      );
      return {
        ...current,
        bookmarks: current.bookmarks.map((category) => {
          const without = category.links.filter((item) => item.id !== link.id);
          if (category.id === categoryId) {
            return { ...category, links: exists ? [...without, link] : [...category.links, link] };
          }
          return { ...category, links: without };
        }),
      };
    });
  };

  const removeLink = (link: BookmarkLink) => {
    if (!window.confirm(`Remove ${link.label}?`)) return;
    setData((current) => ({
      ...current,
      bookmarks: current.bookmarks.map((category) => ({
        ...category,
        links: category.links.filter((item) => item.id !== link.id),
      })),
    }));
  };

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    setData((current) => ({
      ...current,
      bookmarks: [...current.bookmarks, { id: createId('bookmark-cat'), name, links: [] }],
    }));
    setNewCategory('');
  };

  const removeCategory = (id: string, name: string) => {
    if (!window.confirm(`Delete the ${name} category and its bookmarks?`)) return;
    setData((current) => ({
      ...current,
      bookmarks: current.bookmarks.filter((category) => category.id !== id),
    }));
  };

  return (
    <div className={`bookmarks-widget${settings.tall ? ' bookmarks-widget--tall' : ''}`}>
      <div className="bookmarks-toolbar">
        <span className="text-small text-muted">{data.bookmarks.length} categories</span>
        <button
          type="button"
          className={`mini-button${editMode ? ' mini-button--active' : ''}`}
          onClick={() => setEditMode((current) => !current)}
        >
          {editMode ? 'Done' : 'Edit'}
        </button>
      </div>

      {data.bookmarks.map((category) => (
        <div className="bookmark-group" key={category.id}>
          <div className="bookmark-group__heading">
            <h4>{category.name}</h4>
            {editMode && (
              <span className="bookmark-group__actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    setEditing(null);
                    setAddCategoryId(category.id);
                    setEditorOpen(true);
                  }}
                  aria-label={`Add bookmark to ${category.name}`}
                >
                  <Plus size={12} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  onClick={() => removeCategory(category.id, category.name)}
                  aria-label={`Delete ${category.name} category`}
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
          {category.links.length === 0 ? (
            <p className="text-small text-muted">No bookmarks.</p>
          ) : (
            <ul className="bookmark-list">
              {category.links.map((link) => (
                <li key={link.id}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={11} aria-hidden="true" />
                    {link.label}
                  </a>
                  {editMode && (
                    <span className="bookmark-list__actions">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => {
                          setEditing({ link, categoryId: category.id });
                          setEditorOpen(true);
                        }}
                        aria-label={`Edit ${link.label}`}
                      >
                        <Pencil size={11} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        onClick={() => removeLink(link)}
                        aria-label={`Remove ${link.label}`}
                      >
                        <Trash2 size={11} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {editMode && (
        <div className="bookmark-category-add">
          <input
            className="retro-field"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder="New category"
            maxLength={40}
            aria-label="New bookmark category"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCategory();
              }
            }}
          />
          <button type="button" className="mini-button" onClick={addCategory} disabled={!newCategory.trim()}>
            <FolderPlus size={12} aria-hidden="true" /> Add
          </button>
        </div>
      )}

      <LinkEditor
        open={editorOpen}
        link={editing?.link ?? null}
        defaultCategoryId={editing?.categoryId ?? (addCategoryId || defaultCategoryId)}
        categories={data.bookmarks.map((category) => ({ id: category.id, name: category.name }))}
        onClose={() => setEditorOpen(false)}
        onSave={saveLink}
      />
    </div>
  );
}

export function BookmarksSettings() {
  const [settings, update] = useWidgetSettings('bookmarks');
  return (
    <div className="form-stack">
      <label className="retro-check">
        <input
          type="checkbox"
          checked={settings.tall}
          onChange={(event) => update({ tall: event.target.checked })}
        />
        Taller bookmarks list
      </label>
      <p className="info-note">
        These bookmarks are separate from Quick Access and can have their own categories.
      </p>
    </div>
  );
}
