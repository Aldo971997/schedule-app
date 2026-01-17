import { useState, useMemo, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  differenceInDays,
  addMonths,
  subMonths,
  addDays,
  parseISO,
  startOfDay,
  isSameDay,
} from 'date-fns'
import { it } from 'date-fns/locale'
import { tasksApi, projectsApi, usersApi } from '../services/api'
import type { Task } from '../types'

const statusColors: Record<string, string> = {
  BACKLOG: 'bg-gray-400 dark:bg-gray-500',
  TODO: 'bg-blue-400 dark:bg-blue-500',
  IN_PROGRESS: 'bg-yellow-400 dark:bg-yellow-500',
  REVIEW: 'bg-purple-400 dark:bg-purple-500',
  DONE: 'bg-green-400 dark:bg-green-500',
}

const priorityBorder: Record<string, string> = {
  LOW: 'border-l-gray-400',
  MEDIUM: 'border-l-blue-400',
  HIGH: 'border-l-orange-400',
  URGENT: 'border-l-red-500',
}

interface DragState {
  taskId: string
  type: 'move' | 'resize-start' | 'resize-end'
  startX: number
  originalStartDate: Date | null
  originalEndDate: Date | null
  currentOffset: number
}

export default function TimelinePage() {
  const queryClient = useQueryClient()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [filterProject, setFilterProject] = useState<string>('')
  const [filterAssignee, setFilterAssignee] = useState<string>('')
  const [dragState, setDragState] = useState<DragState | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) => tasksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterAssignee && task.assigneeId !== filterAssignee) return false
      if (!task.startDate && !task.dueDate) return false
      return true
    })
  }, [tasks, filterAssignee])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const dayWidth = 40 // px per day

  const getTaskPosition = useCallback((task: Task, offsetDays: number = 0) => {
    const start = task.startDate ? parseISO(task.startDate) : task.dueDate ? parseISO(task.dueDate) : null
    const end = task.dueDate ? parseISO(task.dueDate) : start

    if (!start || !end) return null

    let taskStart = addDays(startOfDay(start), offsetDays)
    let taskEnd = addDays(startOfDay(end), offsetDays)

    // Check if task overlaps with current month
    if (taskEnd < monthStart || taskStart > monthEnd) return null

    const effectiveStart = taskStart < monthStart ? monthStart : taskStart
    const effectiveEnd = taskEnd > monthEnd ? monthEnd : taskEnd

    const startOffset = differenceInDays(effectiveStart, monthStart)
    const duration = differenceInDays(effectiveEnd, effectiveStart) + 1

    return {
      left: `${(startOffset / daysInMonth.length) * 100}%`,
      width: `${(duration / daysInMonth.length) * 100}%`,
      leftPx: startOffset * dayWidth,
      widthPx: duration * dayWidth,
      startsBeforeMonth: taskStart < monthStart,
      endsAfterMonth: taskEnd > monthEnd,
    }
  }, [monthStart, monthEnd, daysInMonth.length, dayWidth])

  // Group tasks by project or assignee
  const groupedTasks = useMemo(() => {
    const groups: { key: string; label: string; tasks: Task[] }[] = []

    if (filterProject) {
      const byAssignee = new Map<string, Task[]>()
      filteredTasks.forEach((task) => {
        const key = task.assigneeId || 'unassigned'
        if (!byAssignee.has(key)) byAssignee.set(key, [])
        byAssignee.get(key)!.push(task)
      })
      byAssignee.forEach((tasks, key) => {
        const user = users.find((u) => u.id === key)
        groups.push({
          key,
          label: user?.name || 'Non assegnato',
          tasks,
        })
      })
    } else {
      const byProject = new Map<string, Task[]>()
      filteredTasks.forEach((task) => {
        const key = task.projectId
        if (!byProject.has(key)) byProject.set(key, [])
        byProject.get(key)!.push(task)
      })
      byProject.forEach((tasks, key) => {
        const project = projects.find((p) => p.id === key)
        groups.push({
          key,
          label: project ? `${project.code} - ${project.name}` : 'Progetto sconosciuto',
          tasks,
        })
      })
    }

    return groups.sort((a, b) => a.label.localeCompare(b.label))
  }, [filteredTasks, filterProject, users, projects])

  const today = startOfDay(new Date())
  const todayIndex = daysInMonth.findIndex((d) => isSameDay(d, today))

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, task: Task, type: 'move' | 'resize-start' | 'resize-end') => {
    e.preventDefault()
    e.stopPropagation()

    const startDate = task.startDate ? parseISO(task.startDate) : null
    const endDate = task.dueDate ? parseISO(task.dueDate) : null

    setDragState({
      taskId: task.id,
      type,
      startX: e.clientX,
      originalStartDate: startDate,
      originalEndDate: endDate,
      currentOffset: 0,
    })
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState) return

    const deltaX = e.clientX - dragState.startX
    const daysMoved = Math.round(deltaX / dayWidth)

    if (daysMoved !== dragState.currentOffset) {
      setDragState(prev => prev ? { ...prev, currentOffset: daysMoved } : null)
    }
  }, [dragState, dayWidth])

  const handleMouseUp = useCallback(() => {
    if (!dragState || dragState.currentOffset === 0) {
      setDragState(null)
      return
    }

    const task = tasks.find(t => t.id === dragState.taskId)
    if (!task) {
      setDragState(null)
      return
    }

    const offset = dragState.currentOffset
    let newStartDate = dragState.originalStartDate
    let newEndDate = dragState.originalEndDate

    if (dragState.type === 'move') {
      if (newStartDate) newStartDate = addDays(newStartDate, offset)
      if (newEndDate) newEndDate = addDays(newEndDate, offset)
    } else if (dragState.type === 'resize-start' && newStartDate) {
      newStartDate = addDays(newStartDate, offset)
      // Don't allow start after end
      if (newEndDate && newStartDate > newEndDate) {
        newStartDate = newEndDate
      }
    } else if (dragState.type === 'resize-end' && newEndDate) {
      newEndDate = addDays(newEndDate, offset)
      // Don't allow end before start
      if (newStartDate && newEndDate < newStartDate) {
        newEndDate = newStartDate
      }
    }

    updateMutation.mutate({
      id: task.id,
      data: {
        startDate: newStartDate?.toISOString(),
        dueDate: newEndDate?.toISOString(),
      },
    })

    setDragState(null)
  }, [dragState, tasks, updateMutation])

  // Get drag offset for a specific task
  const getDragOffset = (taskId: string): number => {
    if (!dragState || dragState.taskId !== taskId) return 0
    return dragState.currentOffset
  }

  return (
    <div
      className="space-y-4"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timeline</h1>
          <p className="text-gray-600 dark:text-gray-400">Trascina i task per modificare le date</p>
        </div>
      </div>

      {/* Filters and Navigation */}
      <div className="flex flex-wrap gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-lg font-semibold text-gray-900 dark:text-white min-w-[180px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: it })}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1.5 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50"
          >
            Oggi
          </button>
        </div>

        <div className="flex gap-4 ml-auto">
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
      </div>

      {/* Gantt Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header with days */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <div className="w-64 flex-shrink-0 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-r border-gray-200 dark:border-gray-700">
            <span className="font-medium text-gray-900 dark:text-white">
              {filterProject ? 'Risorse' : 'Progetti'}
            </span>
          </div>
          <div className="flex-1 overflow-x-auto" ref={gridRef}>
            <div className="flex min-w-max">
              {daysInMonth.map((day) => {
                const isToday = isSameDay(day, today)
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                return (
                  <div
                    key={day.toISOString()}
                    className={`flex-shrink-0 w-10 py-2 text-center border-r border-gray-100 dark:border-gray-700 ${
                      isWeekend ? 'bg-gray-50 dark:bg-gray-700/30' : ''
                    } ${isToday ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                  >
                    <div className={`text-xs ${isToday ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                      {format(day, 'EEE', { locale: it })}
                    </div>
                    <div className={`text-sm font-medium ${isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Task rows */}
        <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
          {groupedTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Nessun task con date da visualizzare
            </div>
          ) : (
            groupedTasks.map((group) => (
              <div key={group.key} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                {/* Group header */}
                <div className="flex bg-gray-50/50 dark:bg-gray-700/20">
                  <div className="w-64 flex-shrink-0 px-4 py-2 border-r border-gray-200 dark:border-gray-700">
                    <span className="font-medium text-gray-900 dark:text-white text-sm truncate block">
                      {group.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {group.tasks.length} task
                    </span>
                  </div>
                  <div className="flex-1 relative min-h-[40px]">
                    <div className="flex min-w-max h-full">
                      {daysInMonth.map((day) => {
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6
                        const isToday = isSameDay(day, today)
                        return (
                          <div
                            key={day.toISOString()}
                            className={`flex-shrink-0 w-10 border-r border-gray-100 dark:border-gray-700 ${
                              isWeekend ? 'bg-gray-50 dark:bg-gray-700/30' : ''
                            } ${isToday ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Tasks in group */}
                {group.tasks.map((task) => {
                  const offset = getDragOffset(task.id)
                  const position = getTaskPosition(task, offset)
                  const isDragging = dragState?.taskId === task.id

                  return (
                    <div key={task.id} className="flex hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <div className="w-64 flex-shrink-0 px-4 py-2 border-r border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${statusColors[task.status]}`} />
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate" title={task.title}>
                            {task.title}
                          </span>
                        </div>
                        {task.assignee && !filterProject && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-4">
                            {task.assignee.name}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 relative h-10">
                        {/* Grid background */}
                        <div className="absolute inset-0 flex min-w-max">
                          {daysInMonth.map((day) => {
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6
                            const isToday = isSameDay(day, today)
                            return (
                              <div
                                key={day.toISOString()}
                                className={`flex-shrink-0 w-10 border-r border-gray-100 dark:border-gray-700 ${
                                  isWeekend ? 'bg-gray-50 dark:bg-gray-700/30' : ''
                                } ${isToday ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                              />
                            )
                          })}
                        </div>

                        {/* Task bar */}
                        {position && (
                          <div
                            className={`absolute top-1.5 h-7 ${statusColors[task.status]} rounded ${
                              priorityBorder[task.priority]
                            } border-l-4 shadow-sm transition-opacity flex items-center overflow-hidden group ${
                              isDragging ? 'opacity-70 cursor-grabbing ring-2 ring-primary-400' : 'cursor-grab hover:opacity-90'
                            }`}
                            style={{
                              left: position.left,
                              width: position.width,
                              minWidth: '32px',
                            }}
                            onMouseDown={(e) => handleMouseDown(e, task, 'move')}
                            title={`${task.title}\n${task.startDate ? format(parseISO(task.startDate), 'dd/MM/yyyy') : ''} - ${task.dueDate ? format(parseISO(task.dueDate), 'dd/MM/yyyy') : ''}\n\nTrascinare per spostare`}
                          >
                            {/* Resize handle - start */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 z-10"
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                handleMouseDown(e, task, 'resize-start')
                              }}
                            />

                            <span className="text-xs text-white font-medium truncate drop-shadow px-2 select-none">
                              {task.title}
                            </span>

                            {/* Resize handle - end */}
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/20 z-10"
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                handleMouseDown(e, task, 'resize-end')
                              }}
                            />
                          </div>
                        )}

                        {/* Today indicator line */}
                        {todayIndex >= 0 && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 dark:bg-red-400 z-10 pointer-events-none"
                            style={{ left: `${((todayIndex + 0.5) / daysInMonth.length) * 100}%` }}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Stato</span>
          <div className="flex flex-wrap gap-3">
            {Object.entries(statusColors).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${color}`} />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {status === 'BACKLOG' ? 'Backlog' : status === 'TODO' ? 'Da fare' : status === 'IN_PROGRESS' ? 'In corso' : status === 'REVIEW' ? 'Revisione' : 'Completato'}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Priorità</span>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 border-l-4 border-l-gray-400 bg-gray-200 dark:bg-gray-600" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Bassa</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 border-l-4 border-l-blue-400 bg-gray-200 dark:bg-gray-600" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Media</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 border-l-4 border-l-orange-400 bg-gray-200 dark:bg-gray-600" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Alta</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 border-l-4 border-l-red-500 bg-gray-200 dark:bg-gray-600" />
              <span className="text-xs text-gray-600 dark:text-gray-400">Urgente</span>
            </div>
          </div>
        </div>
        <div className="ml-auto">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Suggerimento</span>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Trascina le barre per spostare i task. Usa i bordi per ridimensionare.
          </p>
        </div>
      </div>
    </div>
  )
}
