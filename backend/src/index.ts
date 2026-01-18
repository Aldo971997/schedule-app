import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import projectRoutes from './routes/projects.js'
import taskRoutes from './routes/tasks.js'
import exportRoutes from './routes/export.js'
import searchRoutes from './routes/search.js'
import clientRoutes from './routes/clients.js'
import workerRoutes from './routes/workers.js'
import locationRoutes from './routes/locations.js'
import serviceJobRoutes from './routes/serviceJobs.js'
import schedulingRoutes from './routes/scheduling.js'
import { initializeSocket } from './services/socket.js'

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || 3000

// CORS configuration
const allowedOrigins = [
  'https://frontend-production-d2d2.up.railway.app',
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(null, true) // Allow all for now
  },
  credentials: true
}))
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/clients', clientRoutes)
app.use('/api/workers', workerRoutes)
app.use('/api/locations', locationRoutes)
app.use('/api/service-jobs', serviceJobRoutes)
app.use('/api/scheduling', schedulingRoutes)

// Health check
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' })
})

// Initialize Socket.IO
initializeSocket(httpServer)

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
