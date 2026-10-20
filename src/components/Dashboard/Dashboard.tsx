import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { LayoutGrid } from 'lucide-react';
import { usePortal, WidgetInstanceProvider } from '../../state/PortalContext';
import { WIDGET_REGISTRY } from '../../widgets/registry';
import { WidgetFrame } from '../WidgetFrame/WidgetFrame';
import type { WidgetInstance } from '../../types';
import './dashboard.css';

function columnIndexOf(positions: string[][], id: string): number | null {
  if (id.startsWith('column-')) {
    const index = Number(id.replace('column-', ''));
    return Number.isInteger(index) && index >= 0 && index < positions.length ? index : null;
  }
  const index = positions.findIndex((column) => column.includes(id));
  return index >= 0 ? index : null;
}

function tallFor(widget: WidgetInstance, data: ReturnType<typeof usePortal>['data']): boolean {
  return Boolean((data.widgetSettings[widget.id] as { tall?: boolean } | undefined)?.tall);
}

function DashboardColumn({
  id,
  children,
  isOver,
}: {
  id: string;
  children: ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`dashboard-column${isOver ? ' dashboard-column--over' : ''}`}>
      {children}
    </div>
  );
}

export function Dashboard({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { data, setData } = usePortal();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const positions = data.settings.layout.positions;
  const columns = data.settings.layout.columns;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeWidget = data.widgets.find((widget) => widget.id === activeId);
  const activeDefinition = activeWidget ? WIDGET_REGISTRY[activeWidget.type] : null;

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setOverColumn(null);
      return;
    }
    const activeContainer = columnIndexOf(positions, String(active.id));
    const overContainer = columnIndexOf(positions, String(over.id));
    setOverColumn(overContainer === null ? null : `column-${overContainer}`);
    if (activeContainer === null || overContainer === null || activeContainer === overContainer) {
      return;
    }

    setData((current) => {
      const next = current.settings.layout.positions.map((column) => [...column]);
      const source = next.findIndex((column) => column.includes(String(active.id)));
      const target = listIndex(next, String(over.id));
      if (source < 0 || target === null || source === target) return current;
      const sourceIndex = next[source].indexOf(String(active.id));
      const overIndex = next[target].indexOf(String(over.id));
      next[source].splice(sourceIndex, 1);
      const insertAt = overIndex >= 0 ? overIndex : next[target].length;
      next[target].splice(insertAt, 0, String(active.id));
      return {
        ...current,
        settings: {
          ...current.settings,
          layout: { ...current.settings.layout, positions: next },
        },
      };
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumn(null);
    if (!over) return;

    setData((current) => {
      const next = current.settings.layout.positions.map((column) => [...column]);
      const source = next.findIndex((column) => column.includes(String(active.id)));
      if (source < 0) return current;
      const overColumnIndex = listIndex(current.settings.layout.positions, String(over.id));
      if (overColumnIndex === null) return current;

      if (source !== overColumnIndex) {
        // The item may not have been moved during dragOver (for example when
        // dropped straight onto an empty column).
        const sourceIndex = next[source].indexOf(String(active.id));
        next[source].splice(sourceIndex, 1);
        next[overColumnIndex].push(String(active.id));
      } else {
        const oldIndex = next[source].indexOf(String(active.id));
        const newIndex = next[source].indexOf(String(over.id));
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          next[source] = arrayMove(next[source], oldIndex, newIndex);
        }
      }

      return {
        ...current,
        settings: {
          ...current.settings,
          layout: { ...current.settings.layout, positions: next },
        },
      };
    });
  };

  const anyWidgets = data.widgets.length > 0;

  return (
    <section className="dashboard-section" aria-label="Widget dashboard">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setOverColumn(null);
        }}
      >
        <div
          className={`dashboard${!anyWidgets ? ' dashboard--empty' : ''}`}
          data-columns={columns}
          style={
            {
              '--dashboard-columns': columns,
              gap: `${data.settings.layout.gap}px`,
            } as CSSProperties
          }
        >
          {positions.map((column, index) => (
            <DashboardColumn
              key={`column-${index}`}
              id={`column-${index}`}
              isOver={overColumn === `column-${index}`}
            >
              <SortableContext items={column} strategy={verticalListSortingStrategy}>
                {column.map((widgetId) => {
                  const widget = data.widgets.find((item) => item.id === widgetId);
                  if (!widget) return null;
                  const definition = WIDGET_REGISTRY[widget.type];
                  const Icon = definition.icon;
                  const firstOfType =
                    data.widgets.find((item) => item.type === widget.type)?.id === widget.id;
                  const title = widget.title?.trim() || definition.title;
                  return (
                    <WidgetInstanceProvider key={widget.id} widget={widget}>
                      <WidgetFrame
                        widget={widget}
                        title={title}
                        defaultTitle={definition.title}
                        icon={<Icon size={12} />}
                        settingsContent={<definition.Settings />}
                        anchorId={
                          firstOfType && (widget.type === 'news' || widget.type === 'rss')
                            ? `${widget.type}-widget`
                            : undefined
                        }
                        tall={tallFor(widget, data)}
                      >
                        <definition.Component />
                      </WidgetFrame>
                    </WidgetInstanceProvider>
                  );
                })}
              </SortableContext>
            </DashboardColumn>
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
          {activeWidget && activeDefinition ? (
            <div className="widget-drag-preview">
              <activeDefinition.icon size={14} aria-hidden="true" />
              <span>{activeWidget.title?.trim() || activeDefinition.title}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {!anyWidgets && (
        <div className="dashboard-empty">
          <LayoutGrid size={28} aria-hidden="true" />
          <p>Your dashboard is empty.</p>
          <button type="button" className="glossy-button" onClick={onOpenSettings}>
            Add widgets
          </button>
        </div>
      )}
    </section>
  );
}

function listIndex(positions: string[][], id: string): number | null {
  if (id.startsWith('column-')) {
    const index = Number(id.replace('column-', ''));
    return Number.isInteger(index) && index >= 0 && index < positions.length ? index : null;
  }
  const index = positions.findIndex((column) => column.includes(id));
  return index >= 0 ? index : null;
}
