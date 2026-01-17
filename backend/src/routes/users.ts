import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['ADMIN', 'PM', 'OPERATOR']),
})

const updateUserSchema = createUserSchema.partial()

// Get all users
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    })
    res.json(users)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create user (admin only)
router.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = createUserSchema.parse(req.body)
      const hashedPassword = await bcrypt.hash(data.password, 10)

      const user = await prisma.user.create({
        data: { ...data, password: hashedPassword },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      res.status(201).json(user)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// Update user (admin only)
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = updateUserSchema.parse(req.body)
      const updateData: Record<string, unknown> = { ...data }

      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10)
      }

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      res.json(user)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors })
      }
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// Delete user (admin only)
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      await prisma.user.delete({ where: { id: req.params.id } })
      res.status(204).send()
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

export default router
