import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  projectId: z.string().uuid(),
  assigneeId: z.string().uuid().optional().nullable(),
  estimatedHours: z.number().optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
})

const updateTaskSchema = createTaskSchema.partial().extend({
  actualHours: z.number().optional(),
  order: z.number().optional(),
})

const reorderSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number(),
      status: z.string(),
    })
  ),
})

// Get all tasks
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, assigneeId } = req.query
    const where: Record<string, unknown> = {}

    if (projectId) where.projectId = projectId
    if (assigneeId) where.assigneeId = assigneeId

    // Operators only see their assigned tasks
    if (req.user!.role === 'OPERATOR') {
      where.assigneeId = req.user!.id
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: {
          select: { id: true, code: true, name: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ status: 'asc' }, { order: 'asc' }, { createdAt: 'desc' }],
    })
    res.json(tasks)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get task by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        project: {
          select: { id: true, code: true, name: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    res.json(task)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create task
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = createTaskSchema.parse(req.body)

    // Get max order for the status
    const maxOrder = await prisma.task.aggregate({
      where: { projectId: data.projectId, status: data.status || 'BACKLOG' },
      _max: { order: true },
    })

    const task = await prisma.task.create({
      data: {
        ...data,
        order: (maxOrder._max.order || 0) + 1,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: {
        project: {
          select: { id: true, code: true, name: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
      },
    })
    res.status(201).json(task)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update task
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = updateTaskSchema.parse(req.body)

    // Check if task is being completed
    const completedAt =
      data.status === 'DONE'
        ? new Date()
        : data.status !== undefined
          ? null
          : undefined

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...data,
        completedAt,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: {
        project: {
          select: { id: true, code: true, name: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
      },
    })
    res.json(task)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Reorder tasks (for drag and drop)
router.post('/reorder', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { tasks } = reorderSchema.parse(req.body)

    await prisma.$transaction(
      tasks.map((t) =>
        prisma.task.update({
          where: { id: t.id },
          data: { order: t.order, status: t.status as any },
        })
      )
    )

    res.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete task
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
