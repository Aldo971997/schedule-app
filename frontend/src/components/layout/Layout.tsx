import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import { useSocket } from '../../hooks/useSocket'
import { useToast } from '../ui/Toast'

export default function Layout() {
  const { showToast } = useToast()

  // Initialize socket connection with toast notifications
  useSocket((message) => {
    showToast(`${message.title}: ${message.description}`, message.type)
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 ml-64 mt-16">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
