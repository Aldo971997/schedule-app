import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

const createScheduleEntrySchema = z.object({
  workerId: z.string().uuid(),
  serviceJobId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  date: z.string(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  routeOrder: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
})

const updateScheduleEntrySchema = createScheduleEntrySchema.partial()

const bulkCreateSchema = z.array(createScheduleEntrySchema)

// Get schedule entries with filters
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workerId, date, startDate, endDate } = req.query

    const where: Record<string, unknown> = {}

    if (workerId) {
      where.workerId = workerId
    }

    if (date) {
      const dateObj = new Date(date as string)
      where.date = {
        gte: new Date(dateObj.setHours(0, 0, 0, 0)),
        lt: new Date(dateObj.setHours(23, 59, 59, 999)),
      }
    } else if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      }
    }

    const entries = await prisma.scheduleEntry.findMany({
      where,
      include: {
        worker: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        serviceJob: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            location: true,
          },
        },
        location: true,
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
        { routeOrder: 'asc' },
      ],
    })

    res.json(entries)
  } catch (error) {
    console.error('Error fetching schedule entries:', error)
    res.status(500).json({ error: 'Errore nel recupero delle programmazioni' })
  }
})

// Get schedule for a specific date (all workers)
router.get('/by-date/:date', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const dateObj = new Date(req.params.date)
    const startOfDay = new Date(dateObj)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(dateObj)
    endOfDay.setHours(23, 59, 59, 999)

    const entries = await prisma.scheduleEntry.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        worker: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        serviceJob: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        location: true,
      },
      orderBy: [
        { workerId: 'asc' },
        { startTime: 'asc' },
        { routeOrder: 'asc' },
      ],
    })

    // Group by worker
    const grouped = entries.reduce((acc, entry) => {
      const workerId = entry.workerId
      if (!acc[workerId]) {
        acc[workerId] = {
          worker: entry.worker,
          entries: [],
        }
      }
      acc[workerId].entries.push(entry)
      return acc
    }, {} as Record<string, { worker: typeof entries[0]['worker']; entries: typeof entries }>)

    res.json(Object.values(grouped))
  } catch (error) {
    console.error('Error fetching schedule by date:', error)
    res.status(500).json({ error: 'Errore nel recupero della programmazione giornaliera' })
  }
})

// Get worker's route for a specific date
router.get('/route/:workerId/:date', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workerId, date } = req.params
    const dateObj = new Date(date)
    const startOfDay = new Date(dateObj)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(dateObj)
    endOfDay.setHours(23, 59, 59, 999)

    const entries = await prisma.scheduleEntry.findMany({
      where: {
        workerId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        serviceJob: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        location: true,
      },
      orderBy: [
        { routeOrder: 'asc' },
        { startTime: 'asc' },
      ],
    })

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    })

    res.json({
      worker,
      date,
      entries,
    })
  } catch (error) {
    console.error('Error fetching route:', error)
    res.status(500).json({ error: 'Errore nel recupero del percorso' })
  }
})

// Create schedule entry
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = createScheduleEntrySchema.parse(req.body)

      // Check for time conflicts
      const dateObj = new Date(data.date)
      const startOfDay = new Date(dateObj)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(dateObj)
      endOfDay.setHours(23, 59, 59, 999)

      const existingEntries = await prisma.scheduleEntry.findMany({
        where: {
          workerId: data.workerId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      })

      // Check for time overlap
      const newStart = data.startTime
      const newEnd = data.endTime

      const hasConflict = existingEntries.some((entry) => {
        const existingStart = entry.startTime
        const existingEnd = entry.endTime
        return (
          (newStart >= existingStart && newStart < existingEnd) ||
          (newEnd > existingStart && newEnd <= existingEnd) ||
          (newStart <= existingStart && newEnd >= existingEnd)
        )
      })

      if (hasConflict) {
        return res.status(400).json({ error: 'Conflitto di orario con una programmazione esistente' })
      }

      const entry = await prisma.scheduleEntry.create({
        data: {
          ...data,
          date: dateObj,
        },
        include: {
          worker: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          serviceJob: true,
          location: true,
        },
      })

      // If scheduling a service job, update its status
      if (data.serviceJobId) {
        await prisma.serviceJob.update({
          where: { id: data.serviceJobId },
          data: {
            status: 'SCHEDULED',
            scheduledDate: dateObj,
          },
        })
      }

      res.status(201).json(entry)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      console.error('Error creating schedule entry:', error)
      res.status(500).json({ error: 'Errore nella creazione della programmazione' })
    }
  }
)

// Bulk create schedule entries
router.post(
  '/bulk',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const entriesData = bulkCreateSchema.parse(req.body)

      const entries = await prisma.$transaction(
        entriesData.map((data) =>
          prisma.scheduleEntry.create({
            data: {
              ...data,
              date: new Date(data.date),
            },
          })
        )
      )

      res.status(201).json(entries)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      console.error('Error bulk creating entries:', error)
      res.status(500).json({ error: 'Errore nella creazione delle programmazioni' })
    }
  }
)

// Update schedule entry
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = updateScheduleEntrySchema.parse(req.body)

      const entry = await prisma.scheduleEntry.update({
        where: { id: req.params.id },
        data: {
          ...data,
          date: data.date ? new Date(data.date) : undefined,
        },
        include: {
          worker: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          serviceJob: true,
          location: true,
        },
      })

      res.json(entry)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      console.error('Error updating schedule entry:', error)
      res.status(500).json({ error: 'Errore nell\'aggiornamento della programmazione' })
    }
  }
)

// Reorder route entries
router.post(
  '/reorder/:workerId/:date',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { workerId, date } = req.params
      const { entryIds } = req.body as { entryIds: string[] }

      if (!Array.isArray(entryIds)) {
        return res.status(400).json({ error: 'entryIds deve essere un array' })
      }

      await prisma.$transaction(
        entryIds.map((id, index) =>
          prisma.scheduleEntry.update({
            where: { id },
            data: { routeOrder: index },
          })
        )
      )

      const dateObj = new Date(date)
      const startOfDay = new Date(dateObj)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(dateObj)
      endOfDay.setHours(23, 59, 59, 999)

      const entries = await prisma.scheduleEntry.findMany({
        where: {
          workerId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: {
          serviceJob: true,
          location: true,
        },
        orderBy: { routeOrder: 'asc' },
      })

      res.json(entries)
    } catch (error) {
      console.error('Error reordering entries:', error)
      res.status(500).json({ error: 'Errore nel riordinamento del percorso' })
    }
  }
)

// Delete schedule entry
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const entry = await prisma.scheduleEntry.findUnique({
        where: { id: req.params.id },
      })

      if (!entry) {
        return res.status(404).json({ error: 'Programmazione non trovata' })
      }

      await prisma.scheduleEntry.delete({ where: { id: req.params.id } })

      // If this was the only entry for a service job, set it back to unscheduled
      if (entry.serviceJobId) {
        const remainingEntries = await prisma.scheduleEntry.count({
          where: { serviceJobId: entry.serviceJobId },
        })

        if (remainingEntries === 0) {
          await prisma.serviceJob.update({
            where: { id: entry.serviceJobId },
            data: {
              status: 'UNSCHEDULED',
              scheduledDate: null,
            },
          })
        }
      }

      res.status(204).send()
    } catch (error) {
      console.error('Error deleting schedule entry:', error)
      res.status(500).json({ error: 'Errore nell\'eliminazione della programmazione' })
    }
  }
)

export default router
