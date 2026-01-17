import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { Icon, LatLngBounds } from 'leaflet'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import { schedulingApi, workersApi } from '../services/api'
import type { Worker, ScheduleEntry } from '../types'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icons in Leaflet with Vite
const defaultIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

export default function RoutePlannerPage() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Queries
  const { data: workers = [] } = useQuery({
    queryKey: ['workers'],
    queryFn: workersApi.getAll,
  })

  const activeWorkers = workers.filter((w) => w.isActive)

  // Auto-select first worker if none selected
  useEffect(() => {
    if (!selectedWorkerId && activeWorkers.length > 0) {
      setSelectedWorkerId(activeWorkers[0].id)
    }
  }, [activeWorkers, selectedWorkerId])

  const { data: routeData, isLoading } = useQuery({
    queryKey: ['route', selectedWorkerId, selectedDate],
    queryFn: () => schedulingApi.getRoute(selectedWorkerId, selectedDate),
    enabled: !!selectedWorkerId && !!selectedDate,
  })

  const reorderMutation = useMutation({
    mutationFn: ({ entryIds }: { entryIds: string[] }) =>
      schedulingApi.reorderRoute(selectedWorkerId, selectedDate, entryIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route', selectedWorkerId, selectedDate] })
    },
  })

  // Extract entries and calculate route
  const entries = routeData?.entries || []
  const worker = routeData?.worker

  // Get locations with coordinates
  const locationsWithCoords = useMemo(() => {
    return entries
      .filter((e) => {
        const loc = e.location || e.serviceJob?.location
        return loc && loc.latitude && loc.longitude
      })
      .map((e, index) => {
        const loc = e.location || e.serviceJob?.location
        return {
          entry: e,
          location: loc!,
          position: [loc!.latitude, loc!.longitude] as [number, number],
          order: index + 1,
        }
      })
  }, [entries])

  // Route line coordinates
  const routeCoords = locationsWithCoords.map((l) => l.position)

  // Handle drag end for reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = entries.findIndex((e) => e.id === active.id)
    const newIndex = entries.findIndex((e) => e.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    // Reorder entries
    const newEntries = [...entries]
    const [removed] = newEntries.splice(oldIndex, 1)
    newEntries.splice(newIndex, 0, removed)

    reorderMutation.mutate({ entryIds: newEntries.map((e) => e.id) })
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6">
      {/* Map */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Percorsi Giornalieri</h1>
          <div className="flex items-center gap-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
            />
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
            >
              <option value="">Seleziona operatore</option>
              {activeWorkers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.user?.name} ({w.employeeCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Map Container */}
        <div className="h-[calc(100%-70px)]">
          {!selectedWorkerId ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Seleziona un operatore per visualizzare il percorso
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Caricamento...
            </div>
          ) : locationsWithCoords.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              Nessuna tappa con coordinate trovata per questa data
            </div>
          ) : (
            <MapContainer
              center={locationsWithCoords[0]?.position || [45.4642, 9.19]}
              zoom={12}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Route polyline */}
              {routeCoords.length > 1 && (
                <Polyline
                  positions={routeCoords}
                  color="#3B82F6"
                  weight={4}
                  opacity={0.7}
                  dashArray="10, 10"
                />
              )}

              {/* Markers */}
              {locationsWithCoords.map((item, index) => (
                <Marker
                  key={item.entry.id}
                  position={item.position}
                  icon={defaultIcon}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <div className="font-bold text-lg mb-1">
                        Tappa {item.order}
                      </div>
                      <div className="text-sm font-medium">
                        {item.entry.serviceJob?.title || item.location.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {item.location.address}
                      </div>
                      <div className="text-sm mt-2">
                        <strong>Orario:</strong> {item.entry.startTime} - {item.entry.endTime}
                      </div>
                      {item.entry.serviceJob?.client && (
                        <div className="text-xs text-gray-500 mt-1">
                          Cliente: {item.entry.serviceJob.client.name}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Auto-fit bounds */}
              <MapBoundsUpdater locations={locationsWithCoords} />
            </MapContainer>
          )}
        </div>
      </div>

      {/* Sidebar - Route Steps */}
      <div className="w-96 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Tappe del Percorso
          </h2>
          {worker && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                  {worker.user?.name?.charAt(0) || '?'}
                </span>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {worker.user?.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {format(parseISO(selectedDate), 'EEEE d MMMM yyyy', { locale: it })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {entries.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              Nessuna tappa programmata
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={entries.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {entries.map((entry, index) => (
                    <SortableRouteStep
                      key={entry.id}
                      entry={entry}
                      order={index + 1}
                      color={colors[index % colors.length]}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Summary */}
        {entries.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Tappe totali:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {entries.length}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Ore totali:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {calculateTotalHours(entries)}h
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SortableRouteStep({
  entry,
  order,
  color,
}: {
  entry: ScheduleEntry
  order: number
  color: string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const location = entry.location || entry.serviceJob?.location

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-grab active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      {/* Order Number */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {order}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 dark:text-white truncate">
          {entry.serviceJob?.title || location?.name || 'Programmato'}
        </div>
        {location && (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {location.address}
          </div>
        )}
        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
          {entry.startTime} - {entry.endTime}
        </div>
        {entry.serviceJob?.client && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {entry.serviceJob.client.name}
          </div>
        )}
      </div>

      {/* Drag Handle Indicator */}
      <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
        </svg>
      </div>
    </div>
  )
}

function MapBoundsUpdater({ locations }: { locations: { position: [number, number] }[] }) {
  const map = useMap()

  useEffect(() => {
    if (locations.length > 0) {
      const bounds = new LatLngBounds(locations.map((l) => l.position))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [locations, map])

  return null
}

function calculateTotalHours(entries: ScheduleEntry[]): number {
  return entries.reduce((total, entry) => {
    const [startH, startM] = entry.startTime.split(':').map(Number)
    const [endH, endM] = entry.endTime.split(':').map(Number)
    const hours = (endH * 60 + endM - startH * 60 - startM) / 60
    return total + hours
  }, 0)
}
