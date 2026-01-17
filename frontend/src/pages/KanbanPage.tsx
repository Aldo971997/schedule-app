import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { tasksApi, projectsApi, usersApi } from '../services/api'
import KanbanColumn from '../components/kanban/KanbanColumn'
import TaskCard from '../components/kanban/TaskCard'
import TaskModal from '../components/kanban/TaskModal'
import TaskDetailModal from '../components/kanban/TaskDetailModal'
import type { Task, TaskStatus } from '../types'

const columns: { id: TaskStatus; title: string }[] = [
  { id: 'BACKLOG', title: 'Backlog' },
  { id: 'TODO', title: 'Da fare' },
  { id: 'IN_PROGRESS', title: 'In corso' },
  { id: 'REVIEW', title: 'In revisione' },
  { id: 'DONE', title: 'Completato' },
]

export default function KanbanPage() {
  const { projectId } = useParams()
  const queryClient = useQueryClient()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [filterAssignee, setFilterAssignee] = useState<string>('')
  const [filterProject, setFilterProject] = useState<string>(projectId || '')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', { projectId: filterProject }],
    queryFn: () => tasksApi.getAll(filterProject ? { projectId: filterProject } : undefined),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
  })

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setShowModal(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) =>
      tasksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const reorderMutation = useMutation({
    mutationFn: tasksApi.reorder,
  })

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterAssignee && task.assigneeId !== filterAssignee) return false
      return true
    })
  }, [tasks, filterAssignee])

  const tasksByColumn = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
    }

    filteredTasks.forEach((task) => {
      grouped[task.status].push(task)
    })

    Object.keys(grouped).forEach((status) => {
      grouped[status as TaskStatus].sort((a, b) => a.order - b.order)
    })

    return grouped
  }, [filteredTasks])

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task || null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeTask = tasks.find((t) => t.id === activeId)
    if (!activeTask) return

    // Check if dropped on a column
    const targetColumn = columns.find((c) => c.id === overId)
    if (targetColumn) {
      // Moved to empty column or dropped on column header
      if (activeTask.status !== targetColumn.id) {
        updateMutation.mutate({
          id: activeId,
          data: { status: targetColumn.id, order: 0 },
        })
      }
      return
    }

    // Dropped on another task
    const overTask = tasks.find((t) => t.id === overId)
    if (!overTask) return

    const newStatus = overTask.status
    const tasksInColumn = tasksByColumn[newStatus]

    if (activeTask.status === newStatus) {
      // Reorder within same column
      const oldIndex = tasksInColumn.findIndex((t) => t.id === activeId)
      const newIndex = tasksInColumn.findIndex((t) => t.id === overId)

      if (oldIndex !== newIndex) {
        const newOrder = arrayMove(tasksInColumn, oldIndex, newIndex)
        const updates = newOrder.map((t, i) => ({
          id: t.id,
          order: i,
          status: newStatus,
        }))
        reorderMutation.mutate(updates)
        queryClient.setQueryData(['tasks', { projectId: filterProject }], (old: Task[] | undefined) => {
          if (!old) return old
          return old.map((t) => {
            const update = updates.find((u) => u.id === t.id)
            return update ? { ...t, order: update.order } : t
          })
        })
      }
    } else {
      // Move to different column
      const newIndex = tasksInColumn.findIndex((t) => t.id === overId)
      updateMutation.mutate({
        id: activeId,
        data: { status: newStatus, order: newIndex },
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kanban Board</h1>
          <p className="text-gray-600 dark:text-gray-400">Trascina i task per cambiare stato</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Nuovo Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Progetto
          </label>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm"
          >
            <option value="">Tutti i progetti</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Assegnato a
          </label>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm"
          >
            <option value="">Tutti</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              tasks={tasksByColumn[column.id]}
              onUpdateTask={(id, data) => updateMutation.mutate({ id, data })}
              onTaskClick={(task) => setSelectedTask(task)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} isDragging />}
        </DragOverlay>
      </DndContext>

      {showModal && (
        <TaskModal
          projects={projects}
          users={users}
          defaultProjectId={filterProject}
          onClose={() => setShowModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          users={users}
          projects={projects}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}
