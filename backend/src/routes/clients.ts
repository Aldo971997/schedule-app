import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

const createClientSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

const updateClientSchema = createClientSchema.partial()

// Get all clients
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        _count: {
          select: { projects: true },
        },
      },
      orderBy: { name: 'asc' },
    })
    res.json(clients)
  } catch (error) {
    console.error('Get clients error:', error)
    res.status(500).json({ error: 'Errore nel recupero clienti' })
  }
})

// Get single client
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        projects: {
          include: {
            manager: true,
            _count: { select: { tasks: true } },
          },
        },
      },
    })

    if (!client) {
      return res.status(404).json({ error: 'Cliente non trovato' })
    }

    res.json(client)
  } catch (error) {
    console.error('Get client error:', error)
    res.status(500).json({ error: 'Errore nel recupero cliente' })
  }
})

// Create client
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createClientSchema.parse(req.body)

    const client = await prisma.client.create({
      data,
    })

    res.status(201).json(client)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Create client error:', error)
    res.status(500).json({ error: 'Errore nella creazione cliente' })
  }
})

// Update client
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = updateClientSchema.parse(req.body)

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data,
    })

    res.json(client)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Update client error:', error)
    res.status(500).json({ error: 'Errore nell\'aggiornamento cliente' })
  }
})

// Delete client
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Check if client has projects
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { projects: true } } },
    })

    if (!client) {
      return res.status(404).json({ error: 'Cliente non trovato' })
    }

    if (client._count.projects > 0) {
      return res.status(400).json({
        error: 'Impossibile eliminare: il cliente ha progetti associati'
      })
    }

    await prisma.client.delete({
      where: { id: req.params.id },
    })

    res.status(204).send()
  } catch (error) {
    console.error('Delete client error:', error)
    res.status(500).json({ error: 'Errore nell\'eliminazione cliente' })
  }
})

export default router
