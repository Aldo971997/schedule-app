import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

const createServiceJobSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  estimatedDuration: z.number().positive(),
  status: z.enum(['UNSCHEDULED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional().default('UNSCHEDULED'),
  scheduledDate: z.string().datetime().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
})

const updateServiceJobSchema = createServiceJobSchema.partial()

// Get all service jobs
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status, clientId, locationId } = req.query

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (clientId) where.clientId = clientId
    if (locationId) where.locationId = locationId

    const serviceJobs = await prisma.serviceJob.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
        _count: {
          select: {
            scheduleEntries: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    res.json(serviceJobs)
  } catch (error) {
    console.error('Error fetching service jobs:', error)
    res.status(500).json({ error: 'Errore nel recupero dei lavori' })
  }
})

// Get unscheduled service jobs
router.get('/unscheduled', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const serviceJobs = await prisma.serviceJob.findMany({
      where: {
        status: 'UNSCHEDULED',
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    })

    res.json(serviceJobs)
  } catch (error) {
    console.error('Error fetching unscheduled jobs:', error)
    res.status(500).json({ error: 'Errore nel recupero dei lavori non programmati' })
  }
})

// Get single service job
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const serviceJob = await prisma.serviceJob.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
        scheduleEntries: {
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
          },
          orderBy: { date: 'desc' },
        },
      },
    })

    if (!serviceJob) {
      return res.status(404).json({ error: 'Lavoro non trovato' })
    }

    res.json(serviceJob)
  } catch (error) {
    console.error('Error fetching service job:', error)
    res.status(500).json({ error: 'Errore nel recupero del lavoro' })
  }
})

// Create service job (admin/PM only)
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = createServiceJobSchema.parse(req.body)

      const serviceJob = await prisma.serviceJob.create({
        data: {
          ...data,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
      })

      res.status(201).json(serviceJob)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      console.error('Error creating service job:', error)
      res.status(500).json({ error: 'Errore nella creazione del lavoro' })
    }
  }
)

// Update service job (admin/PM only)
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = updateServiceJobSchema.parse(req.body)

      const serviceJob = await prisma.serviceJob.update({
        where: { id: req.params.id },
        data: {
          ...data,
          scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
      })

      res.json(serviceJob)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      console.error('Error updating service job:', error)
      res.status(500).json({ error: 'Errore nell\'aggiornamento del lavoro' })
    }
  }
)

// Delete service job (admin only)
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.serviceJob.delete({ where: { id: req.params.id } })
      res.status(204).send()
    } catch (error) {
      console.error('Error deleting service job:', error)
      res.status(500).json({ error: 'Errore nell\'eliminazione del lavoro' })
    }
  }
)

export default router
