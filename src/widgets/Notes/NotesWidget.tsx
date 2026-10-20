import { useMemo, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { usePortal, useWidgetSettings } from '../../state/PortalContext';
import { createId } from '../../utils/id';
import type { Note } from '../../types';
import { formatRelativeTime } from '../../utils/date';
import '../widgets.css';

const COLOURS: Array<Note['colour']> = ['yellow', 'blue', 'green', 'pink', 'plain'];

export function NotesWidget() {
  const { data, setData } = usePortal();
  const [selectedId, setSelectedId] = useState<string | null>(data.notes[0]?.id ?? null);

  const selected = useMemo(
    () => data.notes.find((note) => note.id === selectedId) ?? data.notes[0],
    [data.notes, selectedId],
  );

  const updateNote = (patch: Partial<Note>) => {
    if (!selected) return;
    setData((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === selected.id ? { ...note, ...patch, updatedAt: Date.now() } : note,
      ),
    }));
  };

  const addNote = () => {
    const note: Note = {
      id: createId('note'),
      title: 'New note',
      body: '',
      colour: 'yellow',
      updatedAt: Date.now(),
    };
    setData((current) => ({ ...current, notes: [note, ...current.notes] }));
    setSelectedId(note.id);
  };

  const removeNote = (id: string) => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    setData((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="notes-widget">
      <div className="notes-tabs" role="tablist" aria-label="Notes">
        {data.notes.map((note) => (
          <button
            key={note.id}
            type="button"
            role="tab"
            aria-selected={note.id === selected?.id}
            className={`notes-tab notes-tab--${note.colour}${note.id === selected?.id ? ' notes-tab--active' : ''}`}
            onClick={() => setSelectedId(note.id)}
            title={note.title}
          >
            {note.title || 'Untitled'}
          </button>
        ))}
        <button type="button" className="notes-tab notes-tab--add" onClick={addNote} aria-label="New note">
          <Plus size={12} aria-hidden="true" />
        </button>
      </div>

      {selected ? (
        <div className={`note-sheet note-sheet--${selected.colour}`}>
          <input
            className="note-sheet__title"
            value={selected.title}
            maxLength={80}
            aria-label="Note title"
            onChange={(event) => updateNote({ title: event.target.value })}
          />
          <textarea
            className="note-sheet__body"
            value={selected.body}
            aria-label="Note body"
            placeholder="Start writing…"
            rows={8}
            onChange={(event) => updateNote({ body: event.target.value })}
          />
          <div className="note-sheet__footer">
            <div className="note-sheet__colours" role="group" aria-label="Note colour">
              {COLOURS.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  className={`note-colour note-colour--${colour}${selected.colour === colour ? ' note-colour--active' : ''}`}
                  onClick={() => updateNote({ colour })}
                  aria-label={`${colour} note`}
                  aria-pressed={selected.colour === colour}
                />
              ))}
            </div>
            <span className="note-sheet__saved">Saved {formatRelativeTime(selected.updatedAt)}</span>
            <button
              type="button"
              className="icon-button icon-button--danger"
              onClick={() => removeNote(selected.id)}
              aria-label="Delete note"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <FileText size={18} aria-hidden="true" />
          <p>No notes yet.</p>
          <button type="button" className="glossy-button" onClick={addNote}>
            <Plus size={13} aria-hidden="true" /> New note
          </button>
        </div>
      )}
    </div>
  );
}

export function NotesSettings() {
  const [settings, update] = useWidgetSettings('notes');
  return (
    <div className="form-stack">
      <label className="retro-check">
        <input
          type="checkbox"
          checked={settings.tall}
          onChange={(event) => update({ tall: event.target.checked })}
        />
        Taller editor
      </label>
      <p className="info-note">Notes save automatically as you type and stay in this browser.</p>
    </div>
  );
}
