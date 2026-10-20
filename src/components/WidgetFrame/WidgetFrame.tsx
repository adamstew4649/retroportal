import { useState, type CSSProperties, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Settings2,
  Trash2,
} from 'lucide-react';
import type { WidgetInstance } from '../../types';
import { usePortal } from '../../state/PortalContext';
import { useToast } from '../../state/ToastContext';
import { removeWidgetFromData, widgetContentCount } from '../../widgets/lifecycle';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';
import './widget-frame.css';

interface WidgetFrameProps {
  widget: WidgetInstance;
  title: string;
  defaultTitle: string;
  icon: ReactNode;
  settingsContent?: ReactNode;
  children: ReactNode;
  anchorId?: string;
  tall?: boolean;
}

export function WidgetFrame({
  widget,
  title,
  defaultTitle,
  icon,
  settingsContent,
  children,
  anchorId,
  tall,
}: WidgetFrameProps) {
  const { data, setData } = usePortal();
  const { notify } = useToast();
  const [configOpen, setConfigOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : undefined,
  };

  const toggleCollapsed = () => {
    setData((current) => ({
      ...current,
      widgets: current.widgets.map((item) =>
        item.id === widget.id ? { ...item, collapsed: !item.collapsed } : item,
      ),
    }));
  };

  const removeWidget = () => {
    const contentCount = widgetContentCount(data, widget);
    const contentNote = contentCount
      ? ` Its ${contentCount} saved ${contentCount === 1 ? 'item' : 'items'} will also be deleted.`
      : '';
    if (
      !window.confirm(
        `Remove the ${title} widget?${contentNote} You can add a new one from Settings → Layout.`,
      )
    ) {
      return;
    }
    setData((current) => removeWidgetFromData(current, widget.id));
    notify(`${title} widget removed. Re-add it from Settings → Layout.`, 'info');
  };

  const moveWidget = (direction: -1 | 1) => {
    setData((current) => {
      const positions = current.settings.layout.positions.map((column) => [...column]);
      const source = positions.findIndex((column) => column.includes(widget.id));
      const target = source + direction;
      if (source < 0 || target < 0 || target >= positions.length) return current;
      const index = positions[source].indexOf(widget.id);
      positions[source].splice(index, 1);
      positions[target].splice(Math.min(index, positions[target].length), 0, widget.id);
      return {
        ...current,
        settings: {
          ...current.settings,
          layout: { ...current.settings.layout, positions },
        },
      };
    });
  };

  const columnIndex = data.settings.layout.positions.findIndex((column) =>
    column.includes(widget.id),
  );

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`widget${widget.collapsed ? ' widget--collapsed' : ''}${isDragging ? ' widget--dragging' : ''}${tall ? ' widget--tall' : ''}`}
      id={anchorId}
      aria-labelledby={`${widget.id}-title`}
    >
      <header className="widget-header">
        <button
          type="button"
          className="widget-drag"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${title} widget`}
          title="Drag to rearrange"
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
        <span className="widget-header__icon" aria-hidden="true">
          {icon}
        </span>
        <h3 className="widget-header__title" id={`${widget.id}-title`}>
          {title}
        </h3>
        <div className="widget-header__actions">
          <button
            type="button"
            className={`widget-header__button${configOpen ? ' widget-header__button--active' : ''}`}
            onClick={() => {
              setConfigOpen((current) => !current);
              if (widget.collapsed) toggleCollapsed();
            }}
            aria-label={`${title} settings`}
            aria-expanded={configOpen}
            title="Widget settings"
          >
            <Settings2 size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="widget-header__button"
            onClick={toggleCollapsed}
            aria-label={widget.collapsed ? `Expand ${title}` : `Collapse ${title}`}
            aria-expanded={!widget.collapsed}
            title={widget.collapsed ? 'Expand' : 'Collapse'}
          >
            {widget.collapsed ? (
              <ChevronDown size={13} aria-hidden="true" />
            ) : (
              <ChevronUp size={13} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="widget-header__button widget-header__button--danger"
            onClick={removeWidget}
            aria-label={`Remove ${title}`}
            title="Remove widget"
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        </div>
      </header>

      {!widget.collapsed && configOpen && (
        <div className="widget-config" aria-label={`${title} configuration`}>
          <label>
            <span className="field-label">Widget name</span>
            <input
              className="retro-field"
              value={widget.title ?? ''}
              maxLength={60}
              placeholder={defaultTitle}
              onChange={(event) => {
                const nextTitle = event.target.value.slice(0, 60);
                setData((current) => ({
                  ...current,
                  widgets: current.widgets.map((item) =>
                    item.id === widget.id
                      ? { ...item, title: nextTitle || undefined }
                      : item,
                  ),
                }));
              }}
            />
          </label>
          <div className="widget-config__move">
            <span className="field-label">Position</span>
            <div className="field-row">
              <button
                type="button"
                className="mini-button"
                onClick={() => moveWidget(-1)}
                disabled={columnIndex <= 0}
              >
                <ArrowLeft size={11} aria-hidden="true" /> Move left
              </button>
              <button
                type="button"
                className="mini-button"
                onClick={() => moveWidget(1)}
                disabled={
                  columnIndex < 0 ||
                  columnIndex >= data.settings.layout.positions.length - 1
                }
              >
                Move right <ArrowRight size={11} aria-hidden="true" />
              </button>
              <span className="widget-config__column">
                Column {columnIndex + 1} of {data.settings.layout.positions.length}
              </span>
            </div>
          </div>
          {settingsContent}
        </div>
      )}

      {!widget.collapsed && (
        <div className="widget-body">
          <WidgetErrorBoundary name={title}>{children}</WidgetErrorBoundary>
        </div>
      )}
    </article>
  );
}
