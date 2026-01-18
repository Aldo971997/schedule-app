import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'

let socket: Socket | null = null

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

export function initializeSocket(): Socket {
  if (socket?.connected) {
    return socket
  }

  const token = useAuthStore.getState().token
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'

  socket = io(baseUrl, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socket.on('connect', () => {
    console.log('Socket.IO connected:', socket?.id)
  })

  socket.on('disconnect', (reason) => {
    console.log('Socket.IO disconnected:', reason)
  })

  socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error.message)
  })

  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function onScheduleUpdate(callback: (payload: ScheduleUpdatePayload) => void): () => void {
  if (!socket) {
    console.warn('Socket not initialized')
    return () => {}
  }

  socket.on('schedule:update', callback)
  return () => {
    socket?.off('schedule:update', callback)
  }
}

export function onConflictEvent(callback: (payload: ConflictEventPayload) => void): () => void {
  if (!socket) {
    console.warn('Socket not initialized')
    return () => {}
  }

  socket.on('schedule:conflict', callback)
  return () => {
    socket?.off('schedule:conflict', callback)
  }
}
