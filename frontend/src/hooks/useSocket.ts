import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import {
  initializeSocket,
  disconnectSocket,
  onScheduleUpdate,
  onConflictEvent,
  type ScheduleUpdatePayload,
  type ConflictEventPayload,
} from '../services/socket'

interface ToastMessage {
  title: string
  description: string
  type: 'success' | 'error' | 'warning' | 'info'
}

export function useSocket(showToast?: (message: ToastMessage) => void) {
  const queryClient = useQueryClient()
  const { token, user } = useAuthStore()

  const handleScheduleUpdate = useCallback(
    (payload: ScheduleUpdatePayload) => {
      // Don't show toast for own actions
      if (payload.userId === user?.id) {
        return
      }

      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['scheduleEntries'] })
      queryClient.invalidateQueries({ queryKey: ['unscheduledJobs'] })

      // Show toast notification
      if (showToast) {
        const actionMessages = {
          created: 'ha creato',
          updated: 'ha aggiornato',
          deleted: 'ha eliminato',
        }

        showToast({
          title: 'Aggiornamento Programmazione',
          description: `${payload.userName} ${actionMessages[payload.type]} una programmazione`,
          type: 'info',
        })
      }
    },
    [queryClient, user?.id, showToast]
  )

  const handleConflictEvent = useCallback(
    (payload: ConflictEventPayload) => {
      if (showToast) {
        showToast({
          title: 'Conflitto Rilevato',
          description: payload.conflict.message,
          type: 'warning',
        })
      }
    },
    [showToast]
  )

  useEffect(() => {
    if (!token) {
      return
    }

    // Initialize socket connection
    initializeSocket()

    // Set up event listeners
    const unsubscribeUpdate = onScheduleUpdate(handleScheduleUpdate)
    const unsubscribeConflict = onConflictEvent(handleConflictEvent)

    // Cleanup on unmount
    return () => {
      unsubscribeUpdate()
      unsubscribeConflict()
      disconnectSocket()
    }
  }, [token, handleScheduleUpdate, handleConflictEvent])
}
