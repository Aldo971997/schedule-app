import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import TaskCard from './TaskCard'
import type { Task, TaskStatus } from '../../types'

interface KanbanColumnProps {
  id: TaskStatus
  title: string
  tasks: Task[]
  onUpdateTask: (id: string, data: Partial<Task>) => void
  onTaskClick?: (task: Task) => void
}

const columnColors: Record<TaskStatus, string> = {
  BACKLOG: 'border-t-gray-400',
  TODO: 'border-t-blue-400',
  IN_PROGRESS: 'border-t-yellow-400',
  REVIEW: 'border-t-purple-400',
  DONE: 'border-t-green-400',
}

export default function KanbanColumn({
  id,
  title,
  tasks,
  onUpdateTask,
  onTaskClick,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-t-4 ${columnColors[id]} ${
        isOver ? 'ring-2 ring-primary-300 dark:ring-primary-500' : ''
      } transition-colors`}
    >
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>

      <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdate={onUpdateTask}
              onClick={() => onTaskClick?.(task)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
            Nessun task
          </div>
        )}
      </div>
    </div>
  )
}
