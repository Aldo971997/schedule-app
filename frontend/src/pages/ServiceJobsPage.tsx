import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { serviceJobsApi, locationsApi, clientsApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import type { ServiceJob, CreateServiceJobInput, ServiceJobStatus, ServiceJobPriority, Location } from '../types'
import type { Client } from '../services/api'

const STATUS_LABELS: Record<ServiceJobStatus, string> = {
  UNSCHEDULED: 'Non programmato',
  SCHEDULED: 'Programmato',
  IN_PROGRESS: 'In corso',
  COMPLETED: 'Completato',
  CANCELLED: 'Annullato',
}

const STATUS_COLORS: Record<ServiceJobStatus, string> = {
  UNSCHEDULED: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  SCHEDULED: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  IN_PROGRESS: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
  COMPLETED: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  CANCELLED: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
}

const PRIORITY_LABELS: Record<ServiceJobPriority, string> = {
  LOW: 'Bassa',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

const PRIORITY_COLORS: Record<ServiceJobPriority, string> = {
  LOW: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  MEDIUM: 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400',
  HIGH: 'bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400',
  URGENT: 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400',
}

export default function ServiceJobsPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingJob, setEditingJob] = useState<ServiceJob | null>(null)
  const [statusFilter, setStatusFilter] = useState<ServiceJobStatus | ''>('')

  const { data: serviceJobs = [], isLoading } = useQuery({
    queryKey: ['serviceJobs', statusFilter],
    queryFn: () => serviceJobsApi.getAll(statusFilter ? { status: statusFilter } : undefined),
  })

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsApi.getAll(),
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: clientsApi.getAll,
  })

  const createMutation = useMutation({
    mutationFn: serviceJobsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceJobs'] })
      setShowModal(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateServiceJobInput> }) =>
      serviceJobsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceJobs'] })
      setEditingJob(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: serviceJobsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceJobs'] })
    },
  })

  const canManage = user?.role === 'ADMIN' || user?.role === 'PM'

  if (isLoading) {
    return <div className="text-center py-8 text-gray-900 dark:text-white">Caricamento...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lavori</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestisci i lavori da programmare</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Nuovo Lavoro
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ServiceJobStatus | '')}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
        >
          <option value="">Tutti gli stati</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Jobs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Codice
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Titolo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Cliente / Sede
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Durata
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Priorita
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Stato
              </th>
              {canManage && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Azioni
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {serviceJobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {job.code}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{job.title}</div>
                  {job.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-xs">
                      {job.description}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  {job.client && (
                    <div className="text-sm text-gray-900 dark:text-white">{job.client.name}</div>
                  )}
                  {job.location && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {job.location.name}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {job.estimatedDuration}h
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${PRIORITY_COLORS[job.priority]}`}
                  >
                    {PRIORITY_LABELS[job.priority]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[job.status]}`}
                  >
                    {STATUS_LABELS[job.status]}
                  </span>
                </td>
                {canManage && (
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => setEditingJob(job)}
                      className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 text-sm mr-3"
                    >
                      Modifica
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Sei sicuro di voler eliminare questo lavoro?')) {
                          deleteMutation.mutate(job.id)
                        }
                      }}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
                    >
                      Elimina
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {serviceJobs.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Nessun lavoro trovato
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <ServiceJobModal
          clients={clients}
          locations={locations}
          onClose={() => setShowModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit Modal */}
      {editingJob && (
        <ServiceJobModal
          job={editingJob}
          clients={clients}
          locations={locations}
          onClose={() => setEditingJob(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingJob.id, data })}
          isLoading={updateMutation.isPending}
        />
      )}
    </div>
  )
}

function ServiceJobModal({
  job,
  clients,
  locations,
  onClose,
  onSubmit,
  isLoading,
}: {
  job?: ServiceJob
  clients: Client[]
  locations: Location[]
  onClose: () => void
  onSubmit: (data: CreateServiceJobInput) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState<CreateServiceJobInput>({
    code: job?.code || '',
    title: job?.title || '',
    description: job?.description || '',
    clientId: job?.clientId || '',
    locationId: job?.locationId || '',
    estimatedDuration: job?.estimatedDuration || 1,
    status: job?.status || 'UNSCHEDULED',
    priority: job?.priority || 'MEDIUM',
  })

  // Filter locations by client if selected
  const filteredLocations = formData.clientId
    ? locations.filter((l) => l.clientId === formData.clientId || !l.clientId)
    : locations

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      clientId: formData.clientId || undefined,
      locationId: formData.locationId || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          {job ? 'Modifica Lavoro' : 'Nuovo Lavoro'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Codice *
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
              placeholder="JOB-001"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Titolo *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
              placeholder="Descrizione lavoro"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrizione
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
              rows={2}
              placeholder="Dettagli aggiuntivi..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cliente
            </label>
            <select
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value, locationId: '' })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
            >
              <option value="">Nessun cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sede
            </label>
            <select
              value={formData.locationId}
              onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
            >
              <option value="">Nessuna sede</option>
              {filteredLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} - {l.address}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Durata (ore) *
              </label>
              <input
                type="number"
                value={formData.estimatedDuration}
                onChange={(e) => setFormData({ ...formData, estimatedDuration: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
                min={0.5}
                step={0.5}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priorita
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as ServiceJobPriority })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {job && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Stato
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ServiceJobStatus })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
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
              {isLoading ? 'Salvataggio...' : job ? 'Salva' : 'Crea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
