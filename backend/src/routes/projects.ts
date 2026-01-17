import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

const createProjectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  managerId: z.string().uuid(),
})

const updateProjectSchema = createProjectSchema.partial()

// Get all projects
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const where: Record<string, unknown> = {}

    // PMs see only their projects, operators see projects they're assigned to
    if (req.user!.role === 'PM') {
      where.managerId = req.user!.id
    } else if (req.user!.role === 'OPERATOR') {
      where.tasks = { some: { assigneeId: req.user!.id } }
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    res.json(projects)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get project by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    res.json(project)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create project (admin and PM only)
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = createProjectSchema.parse(req.body)

      // PMs can only create projects for themselves
      if (req.user!.role === 'PM' && data.managerId !== req.user!.id) {
        return res.status(403).json({ error: 'PMs can only manage their own projects' })
      }

      const project = await prisma.project.create({
        data: {
          ...data,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        },
        include: {
          manager: {
            select: { id: true, name: true, email: true },
          },
        },
      })
      res.status(201).json(project)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// Update project
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'PM'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = updateProjectSchema.parse(req.body)

      // Check PM authorization
      if (req.user!.role === 'PM') {
        const existing = await prisma.project.findUnique({
          where: { id: req.params.id },
        })
        if (existing?.managerId !== req.user!.id) {
          return res.status(403).json({ error: 'Not authorized' })
        }
      }

      const project = await prisma.project.update({
        where: { id: req.params.id },
        data: {
          ...data,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        },
        include: {
          manager: {
            select: { id: true, name: true, email: true },
          },
        },
      })
      res.json(project)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// Delete project (admin only)
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.project.delete({ where: { id: req.params.id } })
      res.status(204).send()
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

export default router
