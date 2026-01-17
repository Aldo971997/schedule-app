import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import KanbanPage from './pages/KanbanPage'
import UsersPage from './pages/UsersPage'
import MyTasksPage from './pages/MyTasksPage'
import TimelinePage from './pages/TimelinePage'
import ClientsPage from './pages/ClientsPage'
import WorkersPage from './pages/WorkersPage'
import ServiceJobsPage from './pages/ServiceJobsPage'
import ScheduleBuilderPage from './pages/ScheduleBuilderPage'
import RoutePlannerPage from './pages/RoutePlannerPage'

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
  )
}
