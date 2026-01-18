import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'

// Lazy load all pages for better performance
const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const KanbanPage = lazy(() => import('./pages/KanbanPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const MyTasksPage = lazy(() => import('./pages/MyTasksPage'))
const TimelinePage = lazy(() => import('./pages/TimelinePage'))
const ClientsPage = lazy(() => import('./pages/ClientsPage'))
const WorkersPage = lazy(() => import('./pages/WorkersPage'))
const ServiceJobsPage = lazy(() => import('./pages/ServiceJobsPage'))
const ScheduleBuilderPage = lazy(() => import('./pages/ScheduleBuilderPage'))
const RoutePlannerPage = lazy(() => import('./pages/RoutePlannerPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="kanban" element={<KanbanPage />} />
          <Route path="kanban/:projectId" element={<KanbanPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
          <Route path="schedule" element={<ScheduleBuilderPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="workers" element={<WorkersPage />} />
          <Route path="service-jobs" element={<ServiceJobsPage />} />
          <Route path="route-planner" element={<RoutePlannerPage />} />
          <Route
            path="users"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  )
}
