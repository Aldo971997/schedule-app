import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskPriority } from '../../types'

interface TaskCardProps {
  task: Task
  isDragging?: boolean
  onUpdate?: (id: string, data: Partial<Task>) => void
  onClick?: () => void
}

const priorityColors: Record<TaskPriority, string> = {
  LOW: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  MEDIUM: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  HIGH: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  URGENT: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
}

const priorityLabels: Record<TaskPriority, string> = {
  LOW: 'Bassa',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

export default function TaskCard({ task, isDragging, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSorting,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSorting ? 0.5 : 1,
  }

  const dueDate = task.dueDate ? new Date(task.dueDate) : null
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'DONE'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all ${
        isDragging ? 'shadow-lg ring-2 ring-primary-300 dark:ring-primary-500' : ''
      }`}
    >
      {/* Drag handle area */}
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={`text-xs px-1.5 py-0.5 rounded ${priorityColors[task.priority]}`}>
            {priorityLabels[task.priority]}
          </span>
          <div className="flex items-center gap-1">
            {task.project && (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[80px]">
                {task.project.code}
              </span>
            )}
            {/* Click to open details */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClick?.()
              }}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Apri dettagli"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </div>

        <h4
          className="font-medium text-gray-900 dark:text-white text-sm mb-2 line-clamp-2 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400"
          onClick={(e) => {
            e.stopPropagation()
            onClick?.()
          }}
        >
          {task.title}
        </h4>

        {task.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{task.description}</p>
        )}

        <div className="flex items-center justify-between mt-3">
          {task.assignee ? (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-200">
                  {task.assignee.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[80px]">
                {task.assignee.name}
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">Non assegnato</span>
          )}

          {dueDate && (
            <span
              className={`text-xs ${
                isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {dueDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>

        {task.estimatedHours && (
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Stimate: {task.estimatedHours}h</span>
            {task.actualHours !== undefined && task.actualHours > 0 && (
              <span>Effettive: {task.actualHours}h</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
