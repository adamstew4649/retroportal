import { useEffect, useState, type FormEvent } from 'react';
import { Link2 } from 'lucide-react';
import type { Shortcut, ShortcutCategory, ShortcutIcon as ShortcutIconType } from '../../types';
import { createId } from '../../utils/id';
import { safeHttpUrlWithHttpsFallback } from '../../utils/url';
import { Modal } from '../Modal/Modal';
import { ShortcutIcon } from './ShortcutIcon';

interface ShortcutEditorProps {
  open: boolean;
  shortcut: Shortcut | null;
  categories: ShortcutCategory[];
  defaultCategoryId: string;
  onClose: () => void;
  onSave: (shortcut: Shortcut) => void;
}

export function ShortcutEditor({
  open,
  shortcut,
  categories,
  defaultCategoryId,
  onClose,
  onSave,
}: ShortcutEditorProps) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [iconType, setIconType] = useState<ShortcutIconType['type']>('favicon');
  const [iconValue, setIconValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(shortcut?.label ?? '');
    setUrl(shortcut?.url ?? '');
    setCategoryId(shortcut?.categoryId ?? defaultCategoryId);
    setIconType(shortcut?.icon.type ?? 'favicon');
    setIconValue(shortcut?.icon.type === 'text' || shortcut?.icon.type === 'url' ? shortcut.icon.value : '');
    setError(null);
  }, [open, shortcut, defaultCategoryId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Give the shortcut a label.');
      return;
    }
    const safeUrl = safeHttpUrlWithHttpsFallback(url);
    if (!safeUrl) {
      setError('Enter a valid http:// or https:// address.');
      return;
    }
    if (iconType === 'url' && !safeHttpUrlWithHttpsFallback(iconValue)) {
      setError('The custom icon address must be a valid http:// or https:// URL.');
      return;
    }
    if (iconType === 'text' && !iconValue.trim()) {
      setError('Enter a letter or emoji for the icon.');
      return;
    }

    const icon: ShortcutIconType =
      iconType === 'text'
        ? { type: 'text', value: iconValue.trim().slice(0, 2) }
        : iconType === 'url'
          ? { type: 'url', value: safeHttpUrlWithHttpsFallback(iconValue)! }
          : { type: 'favicon' };

    onSave({
      id: shortcut?.id ?? createId('shortcut'),
      label: trimmedLabel.slice(0, 50),
      url: safeUrl,
      categoryId,
      icon,
    });
    onClose();
  };

  const previewShortcut: Shortcut = {
    id: 'preview',
    label: label || 'Shortcut',
    url: url || 'https://example.com',
    categoryId,
    icon:
      iconType === 'text'
        ? { type: 'text', value: iconValue || '★' }
        : iconType === 'url' && safeHttpUrlWithHttpsFallback(iconValue)
          ? { type: 'url', value: safeHttpUrlWithHttpsFallback(iconValue)! }
          : { type: 'favicon' },
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={shortcut ? 'Edit shortcut' : 'Add shortcut'}
      icon={<Link2 size={16} aria-hidden="true" />}
      footer={
        <>
          <button type="button" className="glossy-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="shortcut-form" className="glossy-button glossy-button--primary">
            {shortcut ? 'Save changes' : 'Add shortcut'}
          </button>
        </>
      }
    >
      <form id="shortcut-form" className="form-stack" onSubmit={submit} noValidate>
        <div className="shortcut-editor-preview">
          <span className="shortcut-editor-preview__tile">
            <ShortcutIcon
              icon={previewShortcut.icon}
              label={previewShortcut.label}
              url={previewShortcut.url}
            />
            <span>{previewShortcut.label}</span>
          </span>
          <span className="text-small text-muted">Preview</span>
        </div>

        <div className="form-grid">
          <label>
            <span className="field-label">Label</span>
            <input
              className="retro-field"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={50}
              placeholder="My favourite site"
              autoComplete="off"
            />
          </label>
          <label>
            <span className="field-label">Category</span>
            <select
              className="retro-select"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Unfiled</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span className="field-label">Website address</span>
          <input
            className="retro-field"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com"
            inputMode="url"
            autoComplete="url"
          />
        </label>

        <div className="form-grid">
          <label>
            <span className="field-label">Icon style</span>
            <select
              className="retro-select"
              value={iconType}
              onChange={(event) => setIconType(event.target.value as ShortcutIconType['type'])}
            >
              <option value="favicon">Website favicon</option>
              <option value="text">Letter or emoji</option>
              <option value="url">Custom image URL</option>
            </select>
          </label>
          {iconType !== 'favicon' && (
            <label>
              <span className="field-label">
                {iconType === 'text' ? 'Letter or emoji' : 'Image address'}
              </span>
              <input
                className="retro-field"
                value={iconValue}
                onChange={(event) => setIconValue(event.target.value)}
                maxLength={iconType === 'text' ? 2 : 500}
                placeholder={iconType === 'text' ? '★' : 'https://example.com/icon.png'}
              />
            </label>
          )}
        </div>

        {iconType === 'favicon' && (
          <p className="info-note">
            Favicons are requested from Google&apos;s public favicon service when the page loads. Choose a
            letter if you would rather avoid that request.
          </p>
        )}

        {error && (
          <p className="error-note" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
