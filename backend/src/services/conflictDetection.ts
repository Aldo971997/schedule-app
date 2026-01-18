import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export type ConflictType = 'TIME_OVERLAP' | 'UNAVAILABLE' | 'MAX_HOURS_EXCEEDED'

export interface ConflictDetail {
  type: ConflictType
  message: string
  severity: 'error' | 'warning'
  details?: {
    existingEntryId?: string
    existingStart?: string
    existingEnd?: string
    availableStart?: string
    availableEnd?: string
    currentWeekHours?: number
    maxHoursPerWeek?: number
    newEntryHours?: number
  }
}

export interface ConflictResult {
  hasConflict: boolean
  hasWarning: boolean
  conflicts: ConflictDetail[]
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function calculateHours(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  return (endMinutes - startMinutes) / 60
}

function getWeekBounds(date: Date): { startOfWeek: Date; endOfWeek: Date } {
  const d = new Date(date)
  const dayOfWeek = d.getDay()
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Monday as start

  const startOfWeek = new Date(d)
  startOfWeek.setDate(diff)
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  return { startOfWeek, endOfWeek }
}

export async function checkScheduleConflicts(
  workerId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeEntryId?: string
): Promise<ConflictResult> {
  const conflicts: ConflictDetail[] = []
  const dateObj = new Date(date)

  // 1. Check for time overlaps with existing entries
  const startOfDay = new Date(dateObj)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(dateObj)
  endOfDay.setHours(23, 59, 59, 999)

  const existingEntries = await prisma.scheduleEntry.findMany({
    where: {
      workerId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
      ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
    },
  })

  const newStart = timeToMinutes(startTime)
  const newEnd = timeToMinutes(endTime)

  for (const entry of existingEntries) {
    const existingStart = timeToMinutes(entry.startTime)
    const existingEnd = timeToMinutes(entry.endTime)

    const hasOverlap =
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)

    if (hasOverlap) {
      conflicts.push({
        type: 'TIME_OVERLAP',
        message: `Sovrapposizione con programmazione esistente (${entry.startTime}-${entry.endTime})`,
        severity: 'error',
        details: {
          existingEntryId: entry.id,
          existingStart: entry.startTime,
          existingEnd: entry.endTime,
        },
      })
    }
  }

  // 2. Check worker availability for the day
  const dayOfWeek = dateObj.getDay() // 0-6 (Sunday-Saturday)

  const availability = await prisma.workerAvailability.findUnique({
    where: {
      workerId_dayOfWeek: {
        workerId,
        dayOfWeek,
      },
    },
  })

  if (availability) {
    const availStart = timeToMinutes(availability.startTime)
    const availEnd = timeToMinutes(availability.endTime)

    if (newStart < availStart || newEnd > availEnd) {
      conflicts.push({
        type: 'UNAVAILABLE',
        message: `Orario fuori dalla disponibilita del lavoratore (${availability.startTime}-${availability.endTime})`,
        severity: 'error',
        details: {
          availableStart: availability.startTime,
          availableEnd: availability.endTime,
        },
      })
    }
  } else {
    // No availability defined for this day - worker might not work this day
    const dayNames = ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato']
    conflicts.push({
      type: 'UNAVAILABLE',
      message: `Nessuna disponibilita definita per ${dayNames[dayOfWeek]}`,
      severity: 'warning',
    })
  }

  // 3. Check max hours per week
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: { maxHoursPerWeek: true },
  })

  if (worker) {
    const { startOfWeek, endOfWeek } = getWeekBounds(dateObj)

    const weekEntries = await prisma.scheduleEntry.findMany({
      where: {
        workerId,
        date: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
        ...(excludeEntryId ? { id: { not: excludeEntryId } } : {}),
      },
    })

    let totalWeekHours = 0
    for (const entry of weekEntries) {
      totalWeekHours += calculateHours(entry.startTime, entry.endTime)
    }

    const newEntryHours = calculateHours(startTime, endTime)
    const projectedHours = totalWeekHours + newEntryHours

    if (projectedHours > worker.maxHoursPerWeek) {
      conflicts.push({
        type: 'MAX_HOURS_EXCEEDED',
        message: `Superate le ore settimanali massime (${projectedHours.toFixed(1)}/${worker.maxHoursPerWeek}h)`,
        severity: 'warning',
        details: {
          currentWeekHours: totalWeekHours,
          maxHoursPerWeek: worker.maxHoursPerWeek,
          newEntryHours,
        },
      })
    }
  }

  const hasConflict = conflicts.some(c => c.severity === 'error')
  const hasWarning = conflicts.some(c => c.severity === 'warning')

  return {
    hasConflict,
    hasWarning,
    conflicts,
  }
}

export async function checkBulkScheduleConflicts(
  entries: Array<{
    workerId: string
    date: string
    startTime: string
    endTime: string
  }>
): Promise<{ index: number; result: ConflictResult }[]> {
  const results: { index: number; result: ConflictResult }[] = []

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const result = await checkScheduleConflicts(
      entry.workerId,
      entry.date,
      entry.startTime,
      entry.endTime
    )

    if (result.hasConflict || result.hasWarning) {
      results.push({ index: i, result })
    }
  }

  return results
}
