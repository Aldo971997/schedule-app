import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

router.use(authenticate)

interface SearchResult {
  type: 'task' | 'project' | 'user'
  id: string
  title: string
  subtitle?: string
  status?: string
  url: string
}

// Global search
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ results: [] })
    }

    const searchTerm = q.toLowerCase()

    // Search tasks
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { title: { contains: searchTerm } },
          { description: { contains: searchTerm } },
        ],
      },
      include: {
        project: true,
        assignee: true,
      },
      take: 10,
    })

    // Search projects
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm } },
          { code: { contains: searchTerm } },
          { description: { contains: searchTerm } },
        ],
      },
      include: {
        manager: true,
      },
      take: 5,
    })

    // Search users
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm } },
          { email: { contains: searchTerm } },
        ],
      },
      take: 5,
    })

    // Build results
    const results: SearchResult[] = []

    tasks.forEach((task) => {
      results.push({
        type: 'task',
        id: task.id,
        title: task.title,
        subtitle: task.project ? `${task.project.code} - ${task.assignee?.name || 'Non assegnato'}` : undefined,
        status: task.status,
        url: `/kanban?task=${task.id}`,
      })
    })

    projects.forEach((project) => {
      results.push({
        type: 'project',
        id: project.id,
        title: `${project.code} - ${project.name}`,
        subtitle: `PM: ${project.manager?.name || 'Non assegnato'}`,
        status: project.status,
        url: `/kanban/${project.id}`,
      })
    })

    users.forEach((user) => {
      results.push({
        type: 'user',
        id: user.id,
        title: user.name,
        subtitle: `${user.email} - ${user.role}`,
        url: `/users?user=${user.id}`,
      })
    })

    res.json({ results, total: results.length })
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ error: 'Errore durante la ricerca' })
  }
})

export default router
