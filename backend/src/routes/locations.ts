import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

const createLocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  clientId: z.string().uuid().optional().nullable(),
})

const updateLocationSchema = createLocationSchema.partial()

// Get all locations
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.query

    const where = clientId ? { clientId: clientId as string } : {}

    const locations = await prisma.location.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            serviceJobs: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    res.json(locations)
  } catch (error) {
    console.error('Error fetching locations:', error)
    res.status(500).json({ error: 'Errore nel recupero delle sedi' })
  }
})

// Get single location
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const location = await prisma.location.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        serviceJobs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!location) {
      return res.status(404).json({ error: 'Sede non trovata' })
    }

    res.json(location)
  } catch (error) {
    console.error('Error fetching location:', error)
    res.status(500).json({ error: 'Errore nel recupero della sede' })
  }
})

// Create location (admin/PM only)
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = createLocationSchema.parse(req.body)

      const location = await prisma.location.create({
        data,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      })

      res.status(201).json(location)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      console.error('Error creating location:', error)
      res.status(500).json({ error: 'Errore nella creazione della sede' })
    }
  }
)

// Update location (admin/PM only)
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = updateLocationSchema.parse(req.body)

      const location = await prisma.location.update({
        where: { id: req.params.id },
        data,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      })

      res.json(location)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      console.error('Error updating location:', error)
      res.status(500).json({ error: 'Errore nell\'aggiornamento della sede' })
    }
  }
)

// Delete location (admin only)
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.location.delete({ where: { id: req.params.id } })
      res.status(204).send()
    } catch (error) {
      console.error('Error deleting location:', error)
      res.status(500).json({ error: 'Errore nell\'eliminazione della sede' })
    }
  }
)

export default router
