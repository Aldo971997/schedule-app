import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

const createWorkerSchema = z.object({
  userId: z.string().uuid(),
  employeeCode: z.string().min(1),
  maxHoursPerWeek: z.number().positive().optional().default(40),
  isActive: z.boolean().optional().default(true),
})

const updateWorkerSchema = createWorkerSchema.partial().omit({ userId: true })

const availabilitySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
})

const setAvailabilitySchema = z.array(availabilitySchema)

// Get all workers
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const workers = await prisma.worker.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        availability: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
      orderBy: { employeeCode: 'asc' },
    })
    res.json(workers)
  } catch (error) {
    console.error('Error fetching workers:', error)
    res.status(500).json({ error: 'Errore nel recupero degli operatori' })
  }
})

// Get single worker
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        availability: {
          orderBy: { dayOfWeek: 'asc' },
        },
        scheduleEntries: {
          include: {
            serviceJob: true,
            location: true,
          },
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
    })

    if (!worker) {
      return res.status(404).json({ error: 'Operatore non trovato' })
    }

    res.json(worker)
  } catch (error) {
    console.error('Error fetching worker:', error)
    res.status(500).json({ error: 'Errore nel recupero dell\'operatore' })
  }
})

// Create worker (admin/PM only)
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = createWorkerSchema.parse(req.body)

      // Check if user exists
      const user = await prisma.user.findUnique({ where: { id: data.userId } })
      if (!user) {
        return res.status(400).json({ error: 'Utente non trovato' })
      }

      // Check if worker already exists for this user
      const existingWorker = await prisma.worker.findUnique({ where: { userId: data.userId } })
      if (existingWorker) {
        return res.status(400).json({ error: 'Questo utente è già registrato come operatore' })
      }

      const worker = await prisma.worker.create({
        data,
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

      res.status(201).json(worker)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      console.error('Error creating worker:', error)
      res.status(500).json({ error: 'Errore nella creazione dell\'operatore' })
    }
  }
)

// Update worker (admin/PM only)
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = updateWorkerSchema.parse(req.body)

      const worker = await prisma.worker.update({
        where: { id: req.params.id },
        data,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          availability: {
            orderBy: { dayOfWeek: 'asc' },
          },
        },
      })

      res.json(worker)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      console.error('Error updating worker:', error)
      res.status(500).json({ error: 'Errore nell\'aggiornamento dell\'operatore' })
    }
  }
)

// Set worker availability (replace all)
router.put(
  '/:id/availability',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const availabilityData = setAvailabilitySchema.parse(req.body)
      const workerId = req.params.id

      // Check worker exists
      const worker = await prisma.worker.findUnique({ where: { id: workerId } })
      if (!worker) {
        return res.status(404).json({ error: 'Operatore non trovato' })
      }

      // Delete existing availability and create new ones in a transaction
      await prisma.$transaction([
        prisma.workerAvailability.deleteMany({ where: { workerId } }),
        ...availabilityData.map((avail) =>
          prisma.workerAvailability.create({
            data: {
              workerId,
              ...avail,
            },
          })
        ),
      ])

      // Fetch updated availability
      const availability = await prisma.workerAvailability.findMany({
        where: { workerId },
        orderBy: { dayOfWeek: 'asc' },
      })

      res.json(availability)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      console.error('Error setting availability:', error)
      res.status(500).json({ error: 'Errore nell\'impostazione della disponibilità' })
    }
  }
)

// Delete worker (admin only)
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.worker.delete({ where: { id: req.params.id } })
      res.status(204).send()
    } catch (error) {
      console.error('Error deleting worker:', error)
      res.status(500).json({ error: 'Errore nell\'eliminazione dell\'operatore' })
    }
  }
)

// Get available workers for a specific date
router.get(
  '/available/:date',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const date = new Date(req.params.date)
      const dayOfWeek = date.getDay()

      const workers = await prisma.worker.findMany({
        where: {
          isActive: true,
          availability: {
            some: {
              dayOfWeek,
            },
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          availability: {
            where: { dayOfWeek },
          },
          scheduleEntries: {
            where: {
              date: {
                gte: new Date(date.setHours(0, 0, 0, 0)),
                lt: new Date(date.setHours(23, 59, 59, 999)),
              },
            },
          },
        },
      })

      res.json(workers)
    } catch (error) {
      console.error('Error fetching available workers:', error)
      res.status(500).json({ error: 'Errore nel recupero degli operatori disponibili' })
    }
  }
)

export default router
