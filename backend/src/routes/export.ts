import { Router, Response } from 'express'
import * as XLSX from 'xlsx'
import PDFDocument from 'pdfkit'
import { PrismaClient } from '@prisma/client'
import { authenticate, AuthRequest } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()

router.use(authenticate)

// Export tasks to Excel
router.get('/tasks/excel', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query

    const tasks = await prisma.task.findMany({
      where: projectId ? { projectId: projectId as string } : {},
      include: {
        project: true,
        assignee: true,
      },
      orderBy: [{ project: { code: 'asc' } }, { status: 'asc' }, { order: 'asc' }],
    })

    // Transform data for Excel
    const excelData = tasks.map((task) => ({
      Progetto: task.project ? `${task.project.code} - ${task.project.name}` : '',
      Titolo: task.title,
      Descrizione: task.description || '',
      Stato: getStatusLabel(task.status),
      Priorita: getPriorityLabel(task.priority),
      Assegnato: task.assignee?.name || 'Non assegnato',
      'Data Inizio': task.startDate ? formatDate(task.startDate) : '',
      Scadenza: task.dueDate ? formatDate(task.dueDate) : '',
      'Ore Stimate': task.estimatedHours || '',
      'Ore Effettive': task.actualHours || '',
      Creato: formatDate(task.createdAt),
    }))

    // Create workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Progetto
      { wch: 40 }, // Titolo
      { wch: 50 }, // Descrizione
      { wch: 15 }, // Stato
      { wch: 12 }, // Priorita
      { wch: 20 }, // Assegnato
      { wch: 12 }, // Data Inizio
      { wch: 12 }, // Scadenza
      { wch: 12 }, // Ore Stimate
      { wch: 12 }, // Ore Effettive
      { wch: 12 }, // Creato
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Tasks')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Send response
    const filename = projectId ? `tasks_${projectId}.xlsx` : 'tasks_all.xlsx'
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (error) {
    console.error('Export Excel error:', error)
    res.status(500).json({ error: 'Errore durante export Excel' })
  }
})

// Export project report to PDF
router.get('/project/:projectId/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        manager: true,
        tasks: {
          include: { assignee: true },
          orderBy: [{ status: 'asc' }, { priority: 'desc' }, { order: 'asc' }],
        },
      },
    })

    if (!project) {
      return res.status(404).json({ error: 'Progetto non trovato' })
    }

    // Create PDF
    const doc = new PDFDocument({ margin: 50 })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="report_${project.code}.pdf"`)

    doc.pipe(res)

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text(`Report Progetto: ${project.code}`, { align: 'center' })
    doc.moveDown()

    // Project info
    doc.fontSize(12).font('Helvetica-Bold').text('Informazioni Progetto')
    doc.font('Helvetica')
    doc.text(`Nome: ${project.name}`)
    doc.text(`Codice: ${project.code}`)
    doc.text(`Stato: ${getProjectStatusLabel(project.status)}`)
    doc.text(`Project Manager: ${project.manager?.name || 'Non assegnato'}`)
    if (project.startDate) doc.text(`Data Inizio: ${formatDate(project.startDate)}`)
    if (project.endDate) doc.text(`Data Fine: ${formatDate(project.endDate)}`)
    if (project.description) {
      doc.moveDown(0.5)
      doc.text(`Descrizione: ${project.description}`)
    }
    doc.moveDown()

    // Summary
    const tasksByStatus = {
      BACKLOG: project.tasks.filter((t) => t.status === 'BACKLOG').length,
      TODO: project.tasks.filter((t) => t.status === 'TODO').length,
      IN_PROGRESS: project.tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      REVIEW: project.tasks.filter((t) => t.status === 'REVIEW').length,
      DONE: project.tasks.filter((t) => t.status === 'DONE').length,
    }

    const totalEstimated = project.tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
    const totalActual = project.tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0)

    doc.fontSize(12).font('Helvetica-Bold').text('Riepilogo Task')
    doc.font('Helvetica')
    doc.text(`Totale Task: ${project.tasks.length}`)
    doc.text(`Backlog: ${tasksByStatus.BACKLOG}`)
    doc.text(`Da fare: ${tasksByStatus.TODO}`)
    doc.text(`In corso: ${tasksByStatus.IN_PROGRESS}`)
    doc.text(`In revisione: ${tasksByStatus.REVIEW}`)
    doc.text(`Completati: ${tasksByStatus.DONE}`)
    doc.moveDown(0.5)
    doc.text(`Ore Stimate Totali: ${totalEstimated}h`)
    doc.text(`Ore Effettive Totali: ${totalActual}h`)
    doc.moveDown()

    // Task list
    doc.fontSize(12).font('Helvetica-Bold').text('Lista Task')
    doc.moveDown(0.5)

    project.tasks.forEach((task, index) => {
      // Check if we need a new page
      if (doc.y > 700) {
        doc.addPage()
      }

      doc.fontSize(10).font('Helvetica-Bold').text(`${index + 1}. ${task.title}`)
      doc.font('Helvetica').fontSize(9)
      doc.text(`   Stato: ${getStatusLabel(task.status)} | Priorita: ${getPriorityLabel(task.priority)}`)
      doc.text(`   Assegnato a: ${task.assignee?.name || 'Non assegnato'}`)
      if (task.dueDate) doc.text(`   Scadenza: ${formatDate(task.dueDate)}`)
      if (task.estimatedHours) doc.text(`   Ore stimate: ${task.estimatedHours}h`)
      doc.moveDown(0.3)
    })

    // Footer
    doc.moveDown()
    doc.fontSize(8).font('Helvetica').text(`Report generato il ${formatDate(new Date())}`, { align: 'right' })

    doc.end()
  } catch (error) {
    console.error('Export PDF error:', error)
    res.status(500).json({ error: 'Errore durante export PDF' })
  }
})

// Helper functions
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    BACKLOG: 'Backlog',
    TODO: 'Da fare',
    IN_PROGRESS: 'In corso',
    REVIEW: 'In revisione',
    DONE: 'Completato',
  }
  return labels[status] || status
}

function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    LOW: 'Bassa',
    MEDIUM: 'Media',
    HIGH: 'Alta',
    URGENT: 'Urgente',
  }
  return labels[priority] || priority
}

function getProjectStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PLANNING: 'In pianificazione',
    ACTIVE: 'Attivo',
    ON_HOLD: 'In pausa',
    COMPLETED: 'Completato',
    CANCELLED: 'Cancellato',
  }
  return labels[status] || status
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default router
