import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import SearchBar from './SearchBar'
import ThemeSelector from '../ui/ThemeSelector'

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'PM':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-50 transition-colors">
      <div className="h-full px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Schedule App</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <SearchBar />

          {/* Theme Selector */}
          <ThemeSelector />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-200">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="text-sm">
              <p className="font-medium text-gray-900 dark:text-white">{user?.name}</p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(user?.role || '')}`}
              >
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
