import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      name: 'Admin',
      role: 'ADMIN',
    },
  })

  // Create PM user
  const pmPassword = await bcrypt.hash('pm123', 10)
  const pm = await prisma.user.upsert({
    where: { email: 'pm@example.com' },
    update: {},
    create: {
      email: 'pm@example.com',
      password: pmPassword,
      name: 'Mario Rossi',
      role: 'PM',
    },
  })

  // Create Operator users
  const opPassword = await bcrypt.hash('op123', 10)
  const op1 = await prisma.user.upsert({
    where: { email: 'luigi@example.com' },
    update: {},
    create: {
      email: 'luigi@example.com',
      password: opPassword,
      name: 'Luigi Verdi',
      role: 'OPERATOR',
    },
  })

  const op2 = await prisma.user.upsert({
    where: { email: 'anna@example.com' },
    update: {},
    create: {
      email: 'anna@example.com',
      password: opPassword,
      name: 'Anna Bianchi',
      role: 'OPERATOR',
    },
  })

  // Create sample project
  const project = await prisma.project.upsert({
    where: { code: 'PRJ-001' },
    update: {},
    create: {
      code: 'PRJ-001',
      name: 'Progetto Alpha',
      description: 'Sviluppo nuova piattaforma',
      status: 'ACTIVE',
      managerId: pm.id,
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-06-30'),
    },
  })

  // Create sample tasks
  const tasks = [
    { title: 'Analisi requisiti', status: 'DONE', priority: 'HIGH', assigneeId: pm.id, order: 1 },
    { title: 'Design architettura', status: 'DONE', priority: 'HIGH', assigneeId: pm.id, order: 2 },
    { title: 'Setup ambiente sviluppo', status: 'DONE', priority: 'MEDIUM', assigneeId: op1.id, order: 3 },
    { title: 'Sviluppo API backend', status: 'IN_PROGRESS', priority: 'HIGH', assigneeId: op1.id, order: 1 },
    { title: 'Sviluppo frontend', status: 'IN_PROGRESS', priority: 'HIGH', assigneeId: op2.id, order: 2 },
    { title: 'Integrazione database', status: 'TODO', priority: 'MEDIUM', assigneeId: op1.id, order: 1 },
    { title: 'Test unitari', status: 'TODO', priority: 'MEDIUM', assigneeId: op2.id, order: 2 },
    { title: 'Code review', status: 'BACKLOG', priority: 'LOW', assigneeId: null, order: 1 },
    { title: 'Documentazione', status: 'BACKLOG', priority: 'LOW', assigneeId: null, order: 2 },
    { title: 'Deploy staging', status: 'BACKLOG', priority: 'MEDIUM', assigneeId: null, order: 3 },
  ]

  for (const task of tasks) {
    await prisma.task.create({
      data: {
        ...task,
        projectId: project.id,
        status: task.status as any,
        priority: task.priority as any,
      },
    })
  }

  console.log('Seed completed!')
  console.log('Users created:')
  console.log('  - admin@example.com / admin123 (Admin)')
  console.log('  - pm@example.com / pm123 (PM)')
  console.log('  - luigi@example.com / op123 (Operator)')
  console.log('  - anna@example.com / op123 (Operator)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
