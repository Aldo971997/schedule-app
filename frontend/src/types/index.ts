export type UserRole = 'ADMIN' | 'PM' | 'OPERATOR';

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  managerId: string;
  manager?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  project?: Project;
  assigneeId?: string;
  assignee?: User;
  estimatedHours?: number;
  actualHours?: number;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId: string;
  assigneeId?: string;
  estimatedHours?: number;
  startDate?: string;
  dueDate?: string;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  actualHours?: number;
  order?: number;
}

export interface CreateProjectInput {
  code: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
  managerId: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

// ==========================================
// WORKFORCE PLANNING TYPES
// ==========================================

export type ServiceJobStatus = 'UNSCHEDULED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ServiceJobPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Worker {
  id: string;
  userId: string;
  employeeCode: string;
  maxHoursPerWeek: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  availability?: WorkerAvailability[];
  scheduleEntries?: ScheduleEntry[];
}

export interface WorkerAvailability {
  id: string;
  workerId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // "08:00"
  endTime: string; // "17:00"
}

export interface Location {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  clientId?: string;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    name: string;
    code: string;
  };
  _count?: {
    serviceJobs: number;
  };
}

export interface ServiceJob {
  id: string;
  code: string;
  title: string;
  description?: string;
  clientId?: string;
  locationId?: string;
  estimatedDuration: number;
  status: ServiceJobStatus;
  scheduledDate?: string;
  priority: ServiceJobPriority;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    name: string;
    code: string;
  };
  location?: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  _count?: {
    scheduleEntries: number;
  };
  scheduleEntries?: ScheduleEntry[];
}

export interface ScheduleEntry {
  id: string;
  workerId: string;
  serviceJobId?: string;
  locationId?: string;
  date: string;
  startTime: string; // "09:00"
  endTime: string; // "12:00"
  routeOrder?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  worker?: Worker;
  serviceJob?: ServiceJob;
  location?: Location;
}

export interface WorkerSchedule {
  worker: Worker;
  entries: ScheduleEntry[];
}

// Input types
export interface CreateWorkerInput {
  userId: string;
  employeeCode: string;
  maxHoursPerWeek?: number;
  isActive?: boolean;
}

export interface UpdateWorkerInput {
  employeeCode?: string;
  maxHoursPerWeek?: number;
  isActive?: boolean;
}

export interface SetAvailabilityInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface CreateLocationInput {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  clientId?: string;
}

export interface CreateServiceJobInput {
  code: string;
  title: string;
  description?: string;
  clientId?: string;
  locationId?: string;
  estimatedDuration: number;
  status?: ServiceJobStatus;
  scheduledDate?: string;
  priority?: ServiceJobPriority;
}

export interface CreateScheduleEntryInput {
  workerId: string;
  serviceJobId?: string;
  locationId?: string;
  date: string;
  startTime: string;
  endTime: string;
  routeOrder?: number;
  notes?: string;
}

// Conflict Detection Types
export type ConflictType = 'TIME_OVERLAP' | 'UNAVAILABLE' | 'MAX_HOURS_EXCEEDED';

export interface ConflictDetail {
  type: ConflictType;
  message: string;
  severity: 'error' | 'warning';
  details?: {
    existingEntryId?: string;
    existingStart?: string;
    existingEnd?: string;
    availableStart?: string;
    availableEnd?: string;
    currentWeekHours?: number;
    maxHoursPerWeek?: number;
    newEntryHours?: number;
  };
}

export interface ConflictResult {
  hasConflict: boolean;
  hasWarning: boolean;
  conflicts: ConflictDetail[];
}

export interface CheckConflictsInput {
  workerId: string;
  date: string;
  startTime: string;
  endTime: string;
  excludeEntryId?: string;
}
