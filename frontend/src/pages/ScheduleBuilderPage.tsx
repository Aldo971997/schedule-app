import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { format, addDays, startOfWeek, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { schedulingApi, serviceJobsApi, workersApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import type { ServiceJob, Worker, ScheduleEntry, CreateScheduleEntryInput } from '../types'

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7) // 7:00 - 18:00

export default function ScheduleBuilderPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
  const [activeJob, setActiveJob] = useState<ServiceJob | null>(null)
  const [showEntryModal, setShowEntryModal] = useState<{
    workerId: string
    date: string
    startTime: string
  } | null>(null)

  const canManage = user?.role === 'ADMIN' || user?.role === 'PM'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'day') {
      return [currentDate]
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      return Array.from({ length: 7 }, (_, i) => addDays(start, i))
    }
  }, [currentDate, viewMode])

  const startDate = format(dateRange[0], 'yyyy-MM-dd')
  const endDate = format(dateRange[dateRange.length - 1], 'yyyy-MM-dd')

  // Queries
  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: workersApi.getAll,
  })

  const { data: scheduleEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['scheduleEntries', startDate, endDate],
    queryFn: () => schedulingApi.getEntries({ startDate, endDate }),
  })

  const { data: unscheduledJobs = [] } = useQuery({
    queryKey: ['unscheduledJobs'],
    queryFn: serviceJobsApi.getUnscheduled,
  })

  // Mutations
  const createEntryMutation = useMutation({
    mutationFn: schedulingApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleEntries'] })
      queryClient.invalidateQueries({ queryKey: ['unscheduledJobs'] })
      setShowEntryModal(null)
    },
  })

  const deleteEntryMutation = useMutation({
    mutationFn: schedulingApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleEntries'] })
      queryClient.invalidateQueries({ queryKey: ['unscheduledJobs'] })
    },
  })

  // Filter active workers
  const activeWorkers = workers.filter((w) => w.isActive)

  // Group entries by worker and date
  const entriesByWorkerAndDate = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {}
    scheduleEntries.forEach((entry) => {
      const key = `${entry.workerId}-${format(parseISO(entry.date), 'yyyy-MM-dd')}`
      if (!map[key]) map[key] = []
      map[key].push(entry)
    })
    return map
  }, [scheduleEntries])

  // Drag and Drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const job = unscheduledJobs.find((j) => j.id === event.active.id)
    if (job) setActiveJob(job)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveJob(null)
    if (!event.over || !canManage) return

    const jobId = event.active.id as string
    const [workerId, dateStr, hour] = (event.over.id as string).split('|')

    if (!workerId || !dateStr || !hour) return

    const job = unscheduledJobs.find((j) => j.id === jobId)
    if (!job) return

    const startTime = `${hour.padStart(2, '0')}:00`
    const endHour = Math.min(parseInt(hour) + Math.ceil(job.estimatedDuration), 18)
    const endTime = `${endHour.toString().padStart(2, '0')}:00`

    createEntryMutation.mutate({
      workerId,
      serviceJobId: jobId,
      locationId: job.locationId || undefined,
      date: dateStr,
      startTime,
      endTime,
    })
  }

  const handleCellClick = (workerId: string, date: Date, hour: number) => {
    if (!canManage) return
    setShowEntryModal({
      workerId,
      date: format(date, 'yyyy-MM-dd'),
      startTime: `${hour.toString().padStart(2, '0')}:00`,
    })
  }

  // Navigation
  const goToPrev = () => {
    setCurrentDate((d) => addDays(d, viewMode === 'day' ? -1 : -7))
  }

  const goToNext = () => {
    setCurrentDate((d) => addDays(d, viewMode === 'day' ? 1 : 7))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-[calc(100vh-120px)] gap-6">
        {/* Main Calendar */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Pianificazione</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('day')}
                  className={`px-3 py-1 text-sm rounded ${
                    viewMode === 'day'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Giorno
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-3 py-1 text-sm rounded ${
                    viewMode === 'week'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Settimana
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrev}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                &lt;
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Oggi
              </button>
              <button
                onClick={goToNext}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                &gt;
              </button>
              <span className="ml-2 text-gray-700 dark:text-gray-300">
                {viewMode === 'day'
                  ? format(currentDate, 'EEEE d MMMM yyyy', { locale: it })
                  : `${format(dateRange[0], 'd MMM', { locale: it })} - ${format(
                      dateRange[dateRange.length - 1],
                      'd MMM yyyy',
                      { locale: it }
                    )}`}
              </span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-auto">
            {entriesLoading ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-gray-500 dark:text-gray-400">Caricamento...</span>
              </div>
            ) : (
              <div className="min-w-[800px]">
                {/* Time Headers */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-gray-50 dark:bg-gray-700/50 z-10">
                  <div className="w-40 flex-shrink-0 p-2 border-r border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Operatore
                    </span>
                  </div>
                  {viewMode === 'day' ? (
                    HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="flex-1 min-w-[60px] p-2 text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                      >
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {hour}:00
                        </span>
                      </div>
                    ))
                  ) : (
                    dateRange.map((date) => (
                      <div
                        key={date.toISOString()}
                        className="flex-1 min-w-[120px] p-2 text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                      >
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {format(date, 'EEE d', { locale: it })}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Worker Rows */}
                {activeWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className="flex border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                  >
                    {/* Worker Name */}
                    <div className="w-40 flex-shrink-0 p-3 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                          <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                            {worker.user?.name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {worker.user?.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {worker.employeeCode}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Time Slots / Day Cells */}
                    {viewMode === 'day' ? (
                      HOURS.map((hour) => {
                        const dateStr = format(currentDate, 'yyyy-MM-dd')
                        const key = `${worker.id}-${dateStr}`
                        const cellEntries = entriesByWorkerAndDate[key]?.filter((e) => {
                          const entryHour = parseInt(e.startTime.split(':')[0])
                          return entryHour === hour
                        })

                        return (
                          <ScheduleCell
                            key={`${worker.id}|${dateStr}|${hour}`}
                            id={`${worker.id}|${dateStr}|${hour}`}
                            entries={cellEntries}
                            onClick={() => handleCellClick(worker.id, currentDate, hour)}
                            onDeleteEntry={(id) => deleteEntryMutation.mutate(id)}
                            canManage={canManage}
                          />
                        )
                      })
                    ) : (
                      dateRange.map((date) => {
                        const dateStr = format(date, 'yyyy-MM-dd')
                        const key = `${worker.id}-${dateStr}`
                        const dayEntries = entriesByWorkerAndDate[key] || []

                        return (
                          <WeekDayCell
                            key={`${worker.id}|${dateStr}`}
                            id={`${worker.id}|${dateStr}|9`}
                            entries={dayEntries}
                            onClick={() => handleCellClick(worker.id, date, 9)}
                            onDeleteEntry={(id) => deleteEntryMutation.mutate(id)}
                            canManage={canManage}
                          />
                        )
                      })
                    )}
                  </div>
                ))}

                {activeWorkers.length === 0 && (
                  <div className="flex items-center justify-center p-8 text-gray-500 dark:text-gray-400">
                    Nessun operatore attivo trovato
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Unscheduled Jobs */}
        <div className="w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">Lavori da Assegnare</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Trascina sul calendario
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {unscheduledJobs.map((job) => (
              <DraggableJob key={job.id} job={job} />
            ))}
            {unscheduledJobs.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                Tutti i lavori sono programmati
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeJob && <JobCard job={activeJob} isDragging />}
      </DragOverlay>

      {/* Entry Modal */}
      {showEntryModal && (
        <EntryModal
          workerId={showEntryModal.workerId}
          date={showEntryModal.date}
          startTime={showEntryModal.startTime}
          workers={activeWorkers}
          unscheduledJobs={unscheduledJobs}
          onClose={() => setShowEntryModal(null)}
          onSubmit={(data) => createEntryMutation.mutate(data)}
          isLoading={createEntryMutation.isPending}
        />
      )}
    </DndContext>
  )
}

function DraggableJob({ job }: { job: ServiceJob }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <JobCard job={job} />
    </div>
  )
}

function JobCard({ job, isDragging }: { job: ServiceJob; isDragging?: boolean }) {
  const priorityColors = {
    LOW: 'border-l-gray-400',
    MEDIUM: 'border-l-blue-500',
    HIGH: 'border-l-orange-500',
    URGENT: 'border-l-red-500',
  }

  return (
    <div
      className={`p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 border-l-4 ${
        priorityColors[job.priority]
      } cursor-grab ${isDragging ? 'shadow-lg' : 'hover:shadow-md'} transition-shadow`}
    >
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{job.code}</div>
      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{job.title}</div>
      {job.client && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{job.client.name}</div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-600 dark:text-gray-300">{job.estimatedDuration}h</span>
        {job.location && (
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[100px]">
            {job.location.name}
          </span>
        )}
      </div>
    </div>
  )
}

function ScheduleCell({
  id,
  entries,
  onClick,
  onDeleteEntry,
  canManage,
}: {
  id: string
  entries?: ScheduleEntry[]
  onClick: () => void
  onDeleteEntry: (id: string) => void
  canManage: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`flex-1 min-w-[60px] min-h-[60px] p-1 border-r border-gray-200 dark:border-gray-700 last:border-r-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
        isOver ? 'bg-primary-50 dark:bg-primary-900/30' : ''
      }`}
    >
      {entries?.map((entry) => (
        <div
          key={entry.id}
          className="text-xs p-1 mb-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded truncate group relative"
        >
          {entry.serviceJob?.title || entry.notes || 'Programmato'}
          {canManage && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Eliminare questa programmazione?')) {
                  onDeleteEntry(entry.id)
                }
              }}
              className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
            >
              x
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function WeekDayCell({
  id,
  entries,
  onClick,
  onDeleteEntry,
  canManage,
}: {
  id: string
  entries: ScheduleEntry[]
  onClick: () => void
  onDeleteEntry: (id: string) => void
  canManage: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`flex-1 min-w-[120px] min-h-[80px] p-1 border-r border-gray-200 dark:border-gray-700 last:border-r-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
        isOver ? 'bg-primary-50 dark:bg-primary-900/30' : ''
      }`}
    >
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="text-xs p-1 mb-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded truncate group relative"
        >
          <div className="font-medium">{entry.startTime} - {entry.endTime}</div>
          <div className="truncate">{entry.serviceJob?.title || entry.notes || 'Programmato'}</div>
          {canManage && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Eliminare questa programmazione?')) {
                  onDeleteEntry(entry.id)
                }
              }}
              className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
            >
              x
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function EntryModal({
  workerId,
  date,
  startTime,
  workers,
  unscheduledJobs,
  onClose,
  onSubmit,
  isLoading,
}: {
  workerId: string
  date: string
  startTime: string
  workers: Worker[]
  unscheduledJobs: ServiceJob[]
  onClose: () => void
  onSubmit: (data: CreateScheduleEntryInput) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState<CreateScheduleEntryInput>({
    workerId,
    serviceJobId: '',
    date,
    startTime,
    endTime: `${(parseInt(startTime.split(':')[0]) + 1).toString().padStart(2, '0')}:00`,
    notes: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      serviceJobId: formData.serviceJobId || undefined,
    })
  }

  const worker = workers.find((w) => w.id === workerId)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Nuova Programmazione
        </h2>
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <strong>Operatore:</strong> {worker?.user?.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <strong>Data:</strong> {format(parseISO(date), 'EEEE d MMMM yyyy', { locale: it })}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Lavoro
            </label>
            <select
              value={formData.serviceJobId}
              onChange={(e) => setFormData({ ...formData, serviceJobId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
            >
              <option value="">-- Senza lavoro associato --</option>
              {unscheduledJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.code} - {job.title} ({job.estimatedDuration}h)
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Inizio
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fine
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Note
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
              rows={2}
              placeholder="Note aggiuntive..."
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {isLoading ? 'Salvataggio...' : 'Crea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
