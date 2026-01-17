import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workersApi, usersApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useToast } from '../components/ui/Toast'
import { EmptyState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { CardSkeleton } from '../components/ui/Skeleton'
import type { Worker, CreateWorkerInput, UpdateWorkerInput, SetAvailabilityInput, User } from '../types'

const DAYS_OF_WEEK = ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato']
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

export default function WorkersPage() {
  const { user } = useAuthStore()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [showAvailabilityModal, setShowAvailabilityModal] = useState<Worker | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Worker | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ['workers'],
    queryFn: workersApi.getAll,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
  })

  const createMutation = useMutation({
    mutationFn: workersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      setShowModal(false)
      showToast('Operatore creato con successo', 'success')
    },
    onError: () => {
      showToast('Errore nella creazione dell\'operatore', 'error')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkerInput }) =>
      workersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      setEditingWorker(null)
      showToast('Operatore aggiornato con successo', 'success')
    },
    onError: () => {
      showToast('Errore nell\'aggiornamento dell\'operatore', 'error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: workersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      setDeleteConfirm(null)
      showToast('Operatore eliminato', 'success')
    },
    onError: () => {
      showToast('Errore nell\'eliminazione dell\'operatore', 'error')
    },
  })

  const setAvailabilityMutation = useMutation({
    mutationFn: ({ id, availability }: { id: string; availability: SetAvailabilityInput[] }) =>
      workersApi.setAvailability(id, availability),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] })
      setShowAvailabilityModal(null)
      showToast('Disponibilita aggiornata', 'success')
    },
    onError: () => {
      showToast('Errore nell\'aggiornamento della disponibilita', 'error')
    },
  })

  const canManage = user?.role === 'ADMIN' || user?.role === 'PM'

  const availableUsers = users.filter(
    (u) => !workers.some((w) => w.userId === u.id)
  )

  // Filter workers
  const filteredWorkers = workers.filter((worker) => {
    const matchesSearch =
      worker.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter =
      filterActive === 'all' ||
      (filterActive === 'active' && worker.isActive) ||
      (filterActive === 'inactive' && !worker.isActive)

    return matchesSearch && matchesFilter
  })

  // Stats
  const stats = {
    total: workers.length,
    active: workers.filter((w) => w.isActive).length,
    inactive: workers.filter((w) => !w.isActive).length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Operatori</h1>
          <p className="text-gray-600 dark:text-gray-400">Gestisci il personale e la loro disponibilita</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 self-start sm:self-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuovo Operatore
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Totale</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Attivi</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.inactive}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Inattivi</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cerca per nome, codice o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterActive(filter)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterActive === filter
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {filter === 'all' ? 'Tutti' : filter === 'active' ? 'Attivi' : 'Inattivi'}
            </button>
          ))}
        </div>
      </div>

      {/* Workers Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <EmptyState
            icon={
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            title={searchQuery ? 'Nessun risultato' : 'Nessun operatore'}
            description={
              searchQuery
                ? 'Prova a modificare i criteri di ricerca'
                : 'Inizia aggiungendo il primo operatore al sistema'
            }
            action={
              canManage && !searchQuery
                ? { label: 'Aggiungi Operatore', onClick: () => setShowModal(true) }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkers.map((worker) => (
            <div
              key={worker.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg">
                    <span className="text-lg font-bold text-white">
                      {worker.user?.name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {worker.user?.name || 'Sconosciuto'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {worker.employeeCode}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    worker.isActive
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {worker.isActive ? 'Attivo' : 'Inattivo'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300 mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="truncate">{worker.user?.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{worker.maxHoursPerWeek}h / settimana</span>
                </div>
              </div>

              {/* Availability Pills */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Disponibilita settimanale
                </p>
                <div className="flex gap-1">
                  {DAYS_SHORT.map((day, index) => {
                    const hasAvail = worker.availability?.some((a) => a.dayOfWeek === index)
                    return (
                      <div
                        key={index}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${
                          hasAvail
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                        }`}
                        title={hasAvail ? `${DAYS_OF_WEEK[index]}: Disponibile` : `${DAYS_OF_WEEK[index]}: Non disponibile`}
                      >
                        {day.charAt(0)}
                      </div>
                    )
                  })}
                </div>
              </div>

              {canManage && (
                <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowAvailabilityModal(worker)}
                    className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Orari
                  </button>
                  <button
                    onClick={() => setEditingWorker(worker)}
                    className="flex-1 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Modifica
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(worker)}
                    className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <WorkerModal
          availableUsers={availableUsers}
          onClose={() => setShowModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit Modal */}
      {editingWorker && (
        <WorkerModal
          worker={editingWorker}
          availableUsers={availableUsers}
          onClose={() => setEditingWorker(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingWorker.id, data: data as UpdateWorkerInput })}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Availability Modal */}
      {showAvailabilityModal && (
        <AvailabilityModal
          worker={showAvailabilityModal}
          onClose={() => setShowAvailabilityModal(null)}
          onSubmit={(availability) =>
            setAvailabilityMutation.mutate({ id: showAvailabilityModal.id, availability })
          }
          isLoading={setAvailabilityMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Elimina Operatore"
        message={`Sei sicuro di voler eliminare ${deleteConfirm?.user?.name}? Questa azione non puo essere annullata.`}
        confirmLabel="Elimina"
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

function WorkerModal({
  worker,
  availableUsers,
  onClose,
  onSubmit,
  isLoading,
}: {
  worker?: Worker
  availableUsers: User[]
  onClose: () => void
  onSubmit: (data: CreateWorkerInput | UpdateWorkerInput) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    userId: worker?.userId || '',
    employeeCode: worker?.employeeCode || '',
    maxHoursPerWeek: worker?.maxHoursPerWeek || 40,
    isActive: worker?.isActive ?? true,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!worker && !formData.userId) newErrors.userId = 'Seleziona un utente'
    if (!formData.employeeCode.trim()) newErrors.employeeCode = 'Inserisci un codice'
    if (formData.maxHoursPerWeek < 1 || formData.maxHoursPerWeek > 168) {
      newErrors.maxHoursPerWeek = 'Le ore devono essere tra 1 e 168'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    if (worker) {
      onSubmit({
        employeeCode: formData.employeeCode,
        maxHoursPerWeek: formData.maxHoursPerWeek,
        isActive: formData.isActive,
      })
    } else {
      onSubmit(formData)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {worker ? 'Modifica Operatore' : 'Nuovo Operatore'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!worker && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Utente <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                className={`w-full px-3 py-2.5 border ${errors.userId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg`}
              >
                <option value="">Seleziona utente</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              {errors.userId && <p className="mt-1 text-sm text-red-500">{errors.userId}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Codice Dipendente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.employeeCode}
              onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value.toUpperCase() })}
              className={`w-full px-3 py-2.5 border ${errors.employeeCode ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-mono`}
              placeholder="EMP-001"
            />
            {errors.employeeCode && <p className="mt-1 text-sm text-red-500">{errors.employeeCode}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ore Max / Settimana
            </label>
            <input
              type="number"
              value={formData.maxHoursPerWeek}
              onChange={(e) => setFormData({ ...formData, maxHoursPerWeek: Number(e.target.value) })}
              className={`w-full px-3 py-2.5 border ${errors.maxHoursPerWeek ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg`}
              min={1}
              max={168}
            />
            {errors.maxHoursPerWeek && <p className="mt-1 text-sm text-red-500">{errors.maxHoursPerWeek}</p>}
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
              Operatore attivo e disponibile per la pianificazione
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isLoading ? 'Salvataggio...' : worker ? 'Salva Modifiche' : 'Crea Operatore'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AvailabilityModal({
  worker,
  onClose,
  onSubmit,
  isLoading,
}: {
  worker: Worker
  onClose: () => void
  onSubmit: (availability: SetAvailabilityInput[]) => void
  isLoading: boolean
}) {
  const [availability, setAvailability] = useState<SetAvailabilityInput[]>(() => {
    const initial: SetAvailabilityInput[] = []
    for (let i = 0; i < 7; i++) {
      const existing = worker.availability?.find((a) => a.dayOfWeek === i)
      if (existing) {
        initial.push({
          dayOfWeek: i,
          startTime: existing.startTime,
          endTime: existing.endTime,
        })
      }
    }
    return initial
  })

  const toggleDay = (dayOfWeek: number) => {
    const exists = availability.find((a) => a.dayOfWeek === dayOfWeek)
    if (exists) {
      setAvailability(availability.filter((a) => a.dayOfWeek !== dayOfWeek))
    } else {
      setAvailability([
        ...availability,
        { dayOfWeek, startTime: '08:00', endTime: '17:00' },
      ])
    }
  }

  const updateTime = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    setAvailability(
      availability.map((a) =>
        a.dayOfWeek === dayOfWeek ? { ...a, [field]: value } : a
      )
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(availability)
  }

  const setDefaultWeek = () => {
    setAvailability([
      { dayOfWeek: 1, startTime: '08:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '08:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '08:00', endTime: '17:00' },
      { dayOfWeek: 4, startTime: '08:00', endTime: '17:00' },
      { dayOfWeek: 5, startTime: '08:00', endTime: '17:00' },
    ])
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Disponibilita Settimanale
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{worker.user?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={setDefaultWeek}
          className="mb-4 text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Imposta settimana standard (Lun-Ven 8-17)
        </button>

        <form onSubmit={handleSubmit} className="space-y-3">
          {DAYS_OF_WEEK.map((day, index) => {
            const dayAvail = availability.find((a) => a.dayOfWeek === index)
            return (
              <div
                key={index}
                className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                  dayAvail
                    ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                    : 'bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                <label className="flex items-center gap-3 w-32 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!dayAvail}
                    onChange={() => toggleDay(index)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className={`text-sm font-medium ${dayAvail ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400'}`}>
                    {day}
                  </span>
                </label>
                {dayAvail && (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={dayAvail.startTime}
                      onChange={(e) => updateTime(index, 'startTime', e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="time"
                      value={dayAvail.endTime}
                      onChange={(e) => updateTime(index, 'endTime', e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isLoading ? 'Salvataggio...' : 'Salva Disponibilita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
