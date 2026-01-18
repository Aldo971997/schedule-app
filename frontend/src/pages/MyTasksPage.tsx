import { useQuery } from '@tanstack/react-query'
import { tasksApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import type { Task, TaskStatus, TaskPriority } from '../types'

const statusColors: Record<TaskStatus, string> = {
  BACKLOG: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  TODO: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  IN_PROGRESS: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  REVIEW: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  DONE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
}

const statusLabels: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'Da fare',
  IN_PROGRESS: 'In corso',
  REVIEW: 'In revisione',
  DONE: 'Completato',
}

const priorityColors: Record<TaskPriority, string> = {
  LOW: 'text-gray-500',
  MEDIUM: 'text-blue-500',
  HIGH: 'text-orange-500',
  URGENT: 'text-red-500',
}

export default function MyTasksPage() {
  const { user } = useAuthStore()

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', { assigneeId: user?.id }],
    queryFn: () => tasksApi.getAll({ assigneeId: user?.id }),
  })

  const activeTasks = tasks.filter((t) => t.status !== 'DONE')
  const completedTasks = tasks.filter((t) => t.status === 'DONE')

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">Caricamento...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">I miei Task</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {activeTasks.length} attivi, {completedTasks.length} completati
        </p>
      </div>

      {activeTasks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Task attivi</h2>
          <div className="space-y-3">
            {activeTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {completedTasks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Completati</h2>
          <div className="space-y-3 opacity-60">
            {completedTasks.slice(0, 5).map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Non hai task assegnati
        </div>
      )}
    </div>
  )
}

function TaskCard({ task }: { task: Task }) {
  const dueDate = task.dueDate ? new Date(task.dueDate) : null
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'DONE'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded ${statusColors[task.status]}`}>
              {statusLabels[task.status]}
            </span>
            <span className={`text-xs ${priorityColors[task.priority]}`}>
              {task.priority}
            </span>
          </div>
          <h3 className="font-medium text-gray-900 dark:text-white">{task.title}</h3>
          {task.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
            <span>{task.project?.name}</span>
            {dueDate && (
              <span className={isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                Scadenza: {dueDate.toLocaleDateString('it-IT')}
              </span>
            )}
            {task.estimatedHours && <span>{task.estimatedHours}h stimate</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
