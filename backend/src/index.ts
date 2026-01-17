import express from 'express'
import cors from 'cors'
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

const app = express()
const PORT = process.env.PORT || 3000

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
