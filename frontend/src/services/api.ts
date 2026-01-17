import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import type {
  AuthResponse,
  LoginCredentials,
  User,
  Project,
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  CreateProjectInput,
  CreateUserInput,
  Worker,
  WorkerAvailability,
  Location,
  ServiceJob,
  ScheduleEntry,
  WorkerSchedule,
  CreateWorkerInput,
  UpdateWorkerInput,
  SetAvailabilityInput,
  CreateLocationInput,
  CreateServiceJobInput,
  CreateScheduleEntryInput,
} from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/login', credentials)
    return data
  },
  me: async (): Promise<User> => {
    const { data } = await api.get('/auth/me')
    return data
  },
}

// Users
export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const { data } = await api.get('/users')
    return data
  },
  create: async (input: CreateUserInput): Promise<User> => {
    const { data } = await api.post('/users', input)
    return data
  },
  update: async (id: string, input: Partial<CreateUserInput>): Promise<User> => {
    const { data } = await api.patch(`/users/${id}`, input)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`)
  },
}

// Projects
export const projectsApi = {
  getAll: async (): Promise<Project[]> => {
    const { data } = await api.get('/projects')
    return data
  },
  getById: async (id: string): Promise<Project> => {
    const { data } = await api.get(`/projects/${id}`)
    return data
  },
  create: async (input: CreateProjectInput): Promise<Project> => {
    const { data } = await api.post('/projects', input)
    return data
  },
  update: async (id: string, input: Partial<CreateProjectInput>): Promise<Project> => {
    const { data } = await api.patch(`/projects/${id}`, input)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`)
  },
}

// Tasks
export const tasksApi = {
  getAll: async (params?: { projectId?: string; assigneeId?: string }): Promise<Task[]> => {
    const { data } = await api.get('/tasks', { params })
    return data
  },
  getById: async (id: string): Promise<Task> => {
    const { data } = await api.get(`/tasks/${id}`)
    return data
  },
  create: async (input: CreateTaskInput): Promise<Task> => {
    const { data } = await api.post('/tasks', input)
    return data
  },
  update: async (id: string, input: UpdateTaskInput): Promise<Task> => {
    const { data } = await api.patch(`/tasks/${id}`, input)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/tasks/${id}`)
  },
  reorder: async (tasks: { id: string; order: number; status: string }[]): Promise<void> => {
    await api.post('/tasks/reorder', { tasks })
  },
}

// Export
export const exportApi = {
  tasksExcel: async (projectId?: string): Promise<Blob> => {
    const params = projectId ? { projectId } : {}
    const { data } = await api.get('/export/tasks/excel', {
      params,
      responseType: 'blob',
    })
    return data
  },
  projectPdf: async (projectId: string): Promise<Blob> => {
    const { data } = await api.get(`/export/project/${projectId}/pdf`, {
      responseType: 'blob',
    })
    return data
  },
}

// Search
export interface SearchResult {
  type: 'task' | 'project' | 'user'
  id: string
  title: string
  subtitle?: string
  status?: string
  url: string
}

export const searchApi = {
  search: async (query: string): Promise<{ results: SearchResult[]; total: number }> => {
    const { data } = await api.get('/search', { params: { q: query } })
    return data
  },
}

// Clients
export interface Client {
  id: string
  code: string
  name: string
  email?: string
  phone?: string
  address?: string
  notes?: string
  createdAt: string
  updatedAt: string
  _count?: { projects: number }
}

export interface CreateClientInput {
  code: string
  name: string
  email?: string
  phone?: string
  address?: string
  notes?: string
}

export const clientsApi = {
  getAll: async (): Promise<Client[]> => {
    const { data } = await api.get('/clients')
    return data
  },
  getById: async (id: string): Promise<Client> => {
    const { data } = await api.get(`/clients/${id}`)
    return data
  },
  create: async (input: CreateClientInput): Promise<Client> => {
    const { data } = await api.post('/clients', input)
    return data
  },
  update: async (id: string, input: Partial<CreateClientInput>): Promise<Client> => {
    const { data } = await api.patch(`/clients/${id}`, input)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/clients/${id}`)
  },
}

// ==========================================
// WORKFORCE PLANNING APIs
// ==========================================

// Workers
export const workersApi = {
  getAll: async (): Promise<Worker[]> => {
    const { data } = await api.get('/workers')
    return data
  },
  getById: async (id: string): Promise<Worker> => {
    const { data } = await api.get(`/workers/${id}`)
    return data
  },
  getAvailable: async (date: string): Promise<Worker[]> => {
    const { data } = await api.get(`/workers/available/${date}`)
    return data
  },
  create: async (input: CreateWorkerInput): Promise<Worker> => {
    const { data } = await api.post('/workers', input)
    return data
  },
  update: async (id: string, input: UpdateWorkerInput): Promise<Worker> => {
    const { data } = await api.patch(`/workers/${id}`, input)
    return data
  },
  setAvailability: async (id: string, availability: SetAvailabilityInput[]): Promise<WorkerAvailability[]> => {
    const { data } = await api.put(`/workers/${id}/availability`, availability)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/workers/${id}`)
  },
}

// Locations
export const locationsApi = {
  getAll: async (params?: { clientId?: string }): Promise<Location[]> => {
    const { data } = await api.get('/locations', { params })
    return data
  },
  getById: async (id: string): Promise<Location> => {
    const { data } = await api.get(`/locations/${id}`)
    return data
  },
  create: async (input: CreateLocationInput): Promise<Location> => {
    const { data } = await api.post('/locations', input)
    return data
  },
  update: async (id: string, input: Partial<CreateLocationInput>): Promise<Location> => {
    const { data } = await api.patch(`/locations/${id}`, input)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/locations/${id}`)
  },
}

// Service Jobs
export const serviceJobsApi = {
  getAll: async (params?: { status?: string; clientId?: string; locationId?: string }): Promise<ServiceJob[]> => {
    const { data } = await api.get('/service-jobs', { params })
    return data
  },
  getUnscheduled: async (): Promise<ServiceJob[]> => {
    const { data } = await api.get('/service-jobs/unscheduled')
    return data
  },
  getById: async (id: string): Promise<ServiceJob> => {
    const { data } = await api.get(`/service-jobs/${id}`)
    return data
  },
  create: async (input: CreateServiceJobInput): Promise<ServiceJob> => {
    const { data } = await api.post('/service-jobs', input)
    return data
  },
  update: async (id: string, input: Partial<CreateServiceJobInput>): Promise<ServiceJob> => {
    const { data } = await api.patch(`/service-jobs/${id}`, input)
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/service-jobs/${id}`)
  },
}

// Scheduling
export const schedulingApi = {
  getEntries: async (params?: { workerId?: string; date?: string; startDate?: string; endDate?: string }): Promise<ScheduleEntry[]> => {
    const { data } = await api.get('/scheduling', { params })
    return data
  },
  getByDate: async (date: string): Promise<WorkerSchedule[]> => {
    const { data } = await api.get(`/scheduling/by-date/${date}`)
    return data
  },
  getRoute: async (workerId: string, date: string): Promise<{ worker: Worker; date: string; entries: ScheduleEntry[] }> => {
    const { data } = await api.get(`/scheduling/route/${workerId}/${date}`)
    return data
  },
  create: async (input: CreateScheduleEntryInput): Promise<ScheduleEntry> => {
    const { data } = await api.post('/scheduling', input)
    return data
  },
  bulkCreate: async (entries: CreateScheduleEntryInput[]): Promise<ScheduleEntry[]> => {
    const { data } = await api.post('/scheduling/bulk', entries)
    return data
  },
  update: async (id: string, input: Partial<CreateScheduleEntryInput>): Promise<ScheduleEntry> => {
    const { data } = await api.patch(`/scheduling/${id}`, input)
    return data
  },
  reorderRoute: async (workerId: string, date: string, entryIds: string[]): Promise<ScheduleEntry[]> => {
    const { data } = await api.post(`/scheduling/reorder/${workerId}/${date}`, { entryIds })
    return data
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/scheduling/${id}`)
  },
}

export default api
