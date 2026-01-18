import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  parseISO,
} from 'date-fns'
import { it } from 'date-fns/locale'
import { schedulingApi, workersApi } from '../services/api'
import type { ScheduleEntry } from '../types'

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

// Generate consistent colors for workers
const WORKER_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-red-500',
  'bg-yellow-500',
  'bg-cyan-500',
]

function getWorkerColor(index: number): string {
  return WORKER_COLORS[index % WORKER_COLORS.length]
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [colorBy, setColorBy] = useState<'worker' | 'priority'>('worker')

  // Get first and last day visible in the calendar grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  // Fetch schedule entries for the visible range
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['scheduleEntries', format(calendarStart, 'yyyy-MM-dd'), format(calendarEnd, 'yyyy-MM-dd')],
    queryFn: () =>
      schedulingApi.getEntries({
        startDate: format(calendarStart, 'yyyy-MM-dd'),
        endDate: format(calendarEnd, 'yyyy-MM-dd'),
      }),
  })

  // Fetch workers for color mapping
  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: workersApi.getAll,
  })

  // Create worker color map
  const workerColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    workers.forEach((worker, index) => {
      map[worker.id] = getWorkerColor(index)
    })
    return map
  }, [workers])

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {}
    entries.forEach((entry) => {
      const dateKey = format(parseISO(entry.date), 'yyyy-MM-dd')
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(entry)
    })
    return map
  }, [entries])

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days: Date[] = []
    let day = calendarStart
    while (day <= calendarEnd) {
      days.push(day)
      day = addDays(day, 1)
    }
    return days
  }, [calendarStart, calendarEnd])

  // Navigation
  const goToPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const goToToday = () => {
    setCurrentMonth(new Date())
    setSelectedDate(new Date())
  }

  // Get entries for selected date
  const selectedDateEntries = selectedDate
    ? entriesByDate[format(selectedDate, 'yyyy-MM-dd')] || []
    : []

  // Priority color map
  const priorityColorMap: Record<string, string> = {
    LOW: 'bg-gray-400',
    MEDIUM: 'bg-blue-500',
    HIGH: 'bg-orange-500',
    URGENT: 'bg-red-500',
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6">
      {/* Main Calendar */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Calendario</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Colora per:</span>
              <button
                onClick={() => setColorBy('worker')}
                className={`px-3 py-1 text-sm rounded ${
                  colorBy === 'worker'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Operatore
              </button>
              <button
                onClick={() => setColorBy('priority')}
                className={`px-3 py-1 text-sm rounded ${
                  colorBy === 'priority'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Priorita
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300"
            >
              &lt;
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
            >
              Oggi
            </button>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300"
            >
              &gt;
            </button>
            <span className="ml-4 text-lg font-semibold text-gray-900 dark:text-white">
              {format(currentMonth, 'MMMM yyyy', { locale: it })}
            </span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-gray-500 dark:text-gray-400">Caricamento...</span>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Weekday Headers */}
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="p-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400"
                >
                  {day}
                </div>
              ))}

              {/* Calendar Days */}
              {calendarDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd')
                const dayEntries = entriesByDate[dateKey] || []
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isToday = isSameDay(day, new Date())
                const isSelected = selectedDate && isSameDay(day, selectedDate)

                return (
                  <div
                    key={dateKey}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[100px] p-2 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    <div
                      className={`text-sm font-medium mb-1 ${
                        isToday
                          ? 'w-7 h-7 flex items-center justify-center bg-primary-600 text-white rounded-full'
                          : isCurrentMonth
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEntries.slice(0, 3).map((entry) => {
                        const bgColor =
                          colorBy === 'worker'
                            ? workerColorMap[entry.workerId] || 'bg-gray-400'
                            : priorityColorMap[entry.serviceJob?.priority || 'MEDIUM'] || 'bg-blue-500'

                        return (
                          <div
                            key={entry.id}
                            className={`${bgColor} text-white text-xs px-1.5 py-0.5 rounded truncate`}
                            title={`${entry.startTime}-${entry.endTime}: ${
                              entry.serviceJob?.title || entry.notes || 'Programmato'
                            }`}
                          >
                            {entry.startTime} {entry.serviceJob?.title || entry.notes || ''}
                          </div>
                        )
                      })}
                      {dayEntries.length > 3 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          +{dayEntries.length - 3} altri
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar - Day Details */}
      <div className="w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {selectedDate
              ? format(selectedDate, 'EEEE d MMMM', { locale: it })
              : 'Seleziona un giorno'}
          </h2>
          {selectedDate && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {selectedDateEntries.length} programmazioni
            </p>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {selectedDate ? (
            selectedDateEntries.length > 0 ? (
              selectedDateEntries
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((entry) => (
                  <DayDetailEntry
                    key={entry.id}
                    entry={entry}
                    workerColor={workerColorMap[entry.workerId]}
                    colorBy={colorBy}
                    priorityColorMap={priorityColorMap}
                  />
                ))
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                Nessuna programmazione per questo giorno
              </div>
            )
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              Clicca su un giorno per vedere i dettagli
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Legenda {colorBy === 'worker' ? 'Operatori' : 'Priorita'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {colorBy === 'worker'
              ? workers.map((worker, index) => (
                  <div key={worker.id} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded ${getWorkerColor(index)}`}></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {worker.user?.name?.split(' ')[0] || worker.employeeCode}
                    </span>
                  </div>
                ))
              : Object.entries(priorityColorMap).map(([priority, color]) => (
                  <div key={priority} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded ${color}`}></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {priority === 'LOW'
                        ? 'Bassa'
                        : priority === 'MEDIUM'
                        ? 'Media'
                        : priority === 'HIGH'
                        ? 'Alta'
                        : 'Urgente'}
                    </span>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DayDetailEntry({
  entry,
  workerColor,
  colorBy,
  priorityColorMap,
}: {
  entry: ScheduleEntry
  workerColor: string
  colorBy: 'worker' | 'priority'
  priorityColorMap: Record<string, string>
}) {
  const accentColor =
    colorBy === 'worker'
      ? workerColor
      : priorityColorMap[entry.serviceJob?.priority || 'MEDIUM'] || 'bg-blue-500'

  return (
    <div
      className={`p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 ${accentColor.replace(
        'bg-',
        'border-'
      )}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {entry.startTime} - {entry.endTime}
        </span>
        {entry.serviceJob?.priority && (
          <span
            className={`text-xs px-2 py-0.5 rounded text-white ${
              priorityColorMap[entry.serviceJob.priority]
            }`}
          >
            {entry.serviceJob.priority === 'LOW'
              ? 'Bassa'
              : entry.serviceJob.priority === 'MEDIUM'
              ? 'Media'
              : entry.serviceJob.priority === 'HIGH'
              ? 'Alta'
              : 'Urgente'}
          </span>
        )}
      </div>
      <div className="text-sm text-gray-900 dark:text-white font-medium truncate">
        {entry.serviceJob?.title || entry.notes || 'Programmato'}
      </div>
      {entry.worker?.user?.name && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${workerColor}`}></div>
          {entry.worker.user.name}
        </div>
      )}
      {entry.serviceJob?.client?.name && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Cliente: {entry.serviceJob.client.name}
        </div>
      )}
      {entry.location?.name && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Luogo: {entry.location.name}
        </div>
      )}
    </div>
  )
}
