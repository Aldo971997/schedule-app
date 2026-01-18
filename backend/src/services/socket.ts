import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

let io: Server | null = null

export interface ScheduleUpdatePayload {
  type: 'created' | 'updated' | 'deleted'
  entry: {
    id: string
    workerId: string
    date: string
    startTime: string
    endTime: string
    serviceJobId?: string
    locationId?: string
  }
  userId: string
  userName: string
  timestamp: string
}

export interface ConflictEventPayload {
  type: 'conflict_detected'
  conflict: {
    workerId: string
    date: string
    message: string
  }
  entry: {
    id?: string
    workerId: string
    date: string
    startTime: string
    endTime: string
  }
  userId: string
}

export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) {
      return next(new Error('Authentication required'))
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as {
        userId: string
        email: string
        role: string
      }
      socket.data.user = decoded
      next()
    } catch (err) {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.data.user?.email} (${socket.id})`)

    // Join user to their personal room for targeted messages
    socket.join(`user:${socket.data.user?.userId}`)

    // Join scheduling room for broadcast updates
    socket.join('scheduling')

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.data.user?.email} (${socket.id})`)
    })
  })

  console.log('Socket.IO initialized')
  return io
}

export function getIO(): Server | null {
  return io
}

export function emitScheduleUpdate(payload: ScheduleUpdatePayload): void {
  if (!io) {
    console.warn('Socket.IO not initialized, cannot emit schedule update')
    return
  }

  io.to('scheduling').emit('schedule:update', payload)
}

export function emitConflictEvent(payload: ConflictEventPayload): void {
  if (!io) {
    console.warn('Socket.IO not initialized, cannot emit conflict event')
    return
  }

  // Emit to the specific user who triggered the conflict
  io.to(`user:${payload.userId}`).emit('schedule:conflict', payload)
}
