import { useQuery } from '@tanstack/react-query'
import { projectsApi, tasksApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import type { Task, TaskStatus } from '../types'

const statusLabels: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'Da fare',
  IN_PROGRESS: 'In corso',
  REVIEW: 'In revisione',
  DONE: 'Completato',
}

export default function DashboardPage() {
  const { user } = useAuthStore()

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll,
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.getAll(),
  })

  const tasksByStatus = tasks.reduce(
    (acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const myTasks = tasks.filter((t) => t.assigneeId === user?.id)
  const upcomingTasks = myTasks
    .filter((t) => t.dueDate && t.status !== 'DONE')
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5)

  const activeProjects = projects.filter((p) => p.status === 'ACTIVE')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Bentornato, {user?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Progetti attivi"
          value={activeProjects.length}
          color="blue"
        />
        <StatCard
          title="Task totali"
          value={tasks.length}
          color="gray"
        />
        <StatCard
          title="In corso"
          value={tasksByStatus['IN_PROGRESS'] || 0}
          color="yellow"
        />
        <StatCard
          title="Completati"
          value={tasksByStatus['DONE'] || 0}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task status distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Distribuzione Task
          </h2>
          <div className="space-y-3">
            {Object.entries(statusLabels).map(([status, label]) => (
              <div key={status} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-400 w-24">{label}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full"
                    style={{
                      width: `${tasks.length ? ((tasksByStatus[status] || 0) / tasks.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white w-8">
                  {tasksByStatus[status] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming tasks */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Prossime scadenze
          </h2>
          {upcomingTasks.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Nessuna scadenza imminente</p>
          ) : (
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string
  value: number
  color: 'blue' | 'gray' | 'yellow' | 'green'
}) {
  const colors = {
    blue: 'text-blue-600 dark:text-blue-400',
    gray: 'text-gray-600 dark:text-gray-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    green: 'text-green-600 dark:text-green-400',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-colors">
      <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color]}`}>
        {value}
      </p>
    </div>
  )
}

function TaskItem({ task }: { task: Task }) {
  const dueDate = task.dueDate ? new Date(task.dueDate) : null
  const isOverdue = dueDate && dueDate < new Date()

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{task.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{task.project?.name}</p>
      </div>
      {dueDate && (
        <span
          className={`text-xs px-2 py-1 rounded ${
            isOverdue
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
          }`}
        >
          {dueDate.toLocaleDateString('it-IT')}
        </span>
      )}
    </div>
  )
}
