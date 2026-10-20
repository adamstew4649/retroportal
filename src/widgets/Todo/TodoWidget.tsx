import { useMemo, useState, type CSSProperties } from 'react';
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckCircle2, Circle, GripVertical, ListChecks, Plus, Trash2 } from 'lucide-react';
import { usePortal, useWidgetSettings } from '../../state/PortalContext';
import { createId } from '../../utils/id';
import type { Task } from '../../types';
import { toDateKey } from '../../utils/date';
import '../widgets.css';

interface TaskRowProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onDueChange: (due: string) => void;
}

function TaskRow({ task, onToggle, onDelete, onDueChange }: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };
  const overdue = task.dueDate && !task.completed && task.dueDate < toDateKey(new Date());

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`todo-item${task.completed ? ' todo-item--done' : ''}${isDragging ? ' todo-item--dragging' : ''}`}
    >
      <button
        type="button"
        className="todo-item__drag"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${task.title}`}
      >
        <GripVertical size={12} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="todo-item__toggle"
        onClick={onToggle}
        aria-pressed={task.completed}
        aria-label={task.completed ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
      >
        {task.completed ? (
          <CheckCircle2 size={15} aria-hidden="true" />
        ) : (
          <Circle size={15} aria-hidden="true" />
        )}
      </button>
      <span className="todo-item__title" title={task.title}>
        {task.title}
      </span>
      <label className="todo-item__due">
        <span className="visually-hidden">Due date for {task.title}</span>
        <input
          type="date"
          value={task.dueDate ?? ''}
          className={`todo-item__date${overdue ? ' todo-item__date--overdue' : ''}`}
          onChange={(event) => onDueChange(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="icon-button icon-button--danger todo-item__delete"
        onClick={onDelete}
        aria-label={`Delete ${task.title}`}
      >
        <Trash2 size={12} aria-hidden="true" />
      </button>
    </li>
  );
}

export function TodoWidget() {
  const { data, setData } = usePortal();
  const [settings] = useWidgetSettings('todo');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tasks = data.tasks;
  const visible = useMemo(() => {
    if (filter === 'active') return tasks.filter((task) => !task.completed);
    if (filter === 'done') return tasks.filter((task) => task.completed);
    return settings.showCompleted ? tasks : tasks.filter((task) => !task.completed);
  }, [filter, settings.showCompleted, tasks]);

  const remaining = tasks.filter((task) => !task.completed).length;

  const addTask = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setData((current) => ({
      ...current,
      tasks: [
        {
          id: createId('task'),
          title: trimmed.slice(0, 200),
          completed: false,
          dueDate: due || undefined,
          createdAt: Date.now(),
        },
        ...current.tasks,
      ],
    }));
    setTitle('');
    setDue('');
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setData((current) => {
      const oldIndex = current.tasks.findIndex((task) => task.id === active.id);
      const newIndex = current.tasks.findIndex((task) => task.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return { ...current, tasks: arrayMove(current.tasks, oldIndex, newIndex) };
    });
  };

  return (
    <div className="todo-widget">
      <div className="todo-add">
        <input
          className="retro-field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a task…"
          aria-label="New task"
          maxLength={200}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addTask();
            }
          }}
        />
        <input
          type="date"
          className="retro-field todo-add__due"
          value={due}
          onChange={(event) => setDue(event.target.value)}
          aria-label="Due date (optional)"
        />
        <button type="button" className="glossy-button todo-add__button" onClick={addTask} disabled={!title.trim()}>
          <Plus size={13} aria-hidden="true" />
          <span className="visually-hidden">Add task</span>
        </button>
      </div>

      <div className="todo-filter" role="group" aria-label="Filter tasks">
        {(['all', 'active', 'done'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`mini-button${filter === value ? ' mini-button--active' : ''}`}
            onClick={() => setFilter(value)}
          >
            {value === 'all' ? 'All' : value === 'active' ? 'Active' : 'Done'}
          </button>
        ))}
        <span className="todo-filter__count">
          {remaining} left
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <ListChecks size={18} aria-hidden="true" />
          <p>{filter === 'done' ? 'Nothing completed yet.' : 'Nothing to do. Enjoy the quiet!'}</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={visible.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            <ul className="todo-list">
              {visible.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() =>
                    setData((current) => ({
                      ...current,
                      tasks: current.tasks.map((item) =>
                        item.id === task.id ? { ...item, completed: !item.completed } : item,
                      ),
                    }))
                  }
                  onDelete={() =>
                    setData((current) => ({
                      ...current,
                      tasks: current.tasks.filter((item) => item.id !== task.id),
                    }))
                  }
                  onDueChange={(value) =>
                    setData((current) => ({
                      ...current,
                      tasks: current.tasks.map((item) =>
                        item.id === task.id ? { ...item, dueDate: value || undefined } : item,
                      ),
                    }))
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {tasks.some((task) => task.completed) && (
        <button
          type="button"
          className="link-button todo-clear"
          onClick={() =>
            setData((current) => ({
              ...current,
              tasks: current.tasks.filter((task) => !task.completed),
            }))
          }
        >
          Clear completed ({tasks.filter((task) => task.completed).length})
        </button>
      )}
    </div>
  );
}

export function TodoSettings() {
  const [settings, update] = useWidgetSettings('todo');
  return (
    <div className="form-stack">
      <label className="retro-check">
        <input
          type="checkbox"
          checked={settings.showCompleted}
          onChange={(event) => update({ showCompleted: event.target.checked })}
        />
        Show completed tasks in the list
      </label>
      <p className="info-note">Drag the handle beside a task to reorder it.</p>
    </div>
  );
}
