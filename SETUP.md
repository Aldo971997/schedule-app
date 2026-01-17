# Schedule App - Guida all'avvio

## Prerequisiti

- Node.js 18+
- Docker Desktop (per PostgreSQL)
- npm o pnpm

## Avvio rapido

### 1. Avvia il database PostgreSQL

```bash
cd C:\Users\Aldo.Condelli\Desktop\schedule-app
docker-compose up -d
```

### 2. Setup Backend

```bash
cd backend

# Installa dipendenze
npm install

# Genera client Prisma
npm run db:generate

# Crea tabelle nel database
npm run db:push

# Popola con dati demo
npm run db:seed

# Avvia server (porta 3000)
npm run dev
```

### 3. Setup Frontend

```bash
cd frontend

# Installa dipendenze
npm install

# Avvia dev server (porta 5173)
npm run dev
```

### 4. Accedi all'applicazione

Apri http://localhost:5173 nel browser.

## Account Demo

| Ruolo | Email | Password |
|-------|-------|----------|
| Admin | admin@example.com | admin123 |
| PM | pm@example.com | pm123 |
| Operativo | luigi@example.com | op123 |
| Operativo | anna@example.com | op123 |

## Struttura Progetto

```
schedule-app/
├── frontend/          # React + Vite + TypeScript + Tailwind
├── backend/           # Express + Prisma + PostgreSQL
├── docker-compose.yml # PostgreSQL container
└── SETUP.md          # Questo file
```

## Funzionalita MVP

- Login con 3 ruoli (Admin, PM, Operativo)
- Dashboard con statistiche
- Gestione progetti/commesse
- Kanban Board con drag & drop
- Filtri per progetto e persona
- Vista "I miei task"
- Gestione utenti (solo Admin)

## Comandi utili

```bash
# Backend
npm run dev          # Avvia in development
npm run db:migrate   # Crea migration
npm run db:seed      # Popola dati demo

# Frontend
npm run dev          # Avvia dev server
npm run build        # Build produzione
npm run preview      # Preview build

# Docker
docker-compose up -d    # Avvia PostgreSQL
docker-compose down     # Ferma PostgreSQL
docker-compose logs -f  # Vedi log
```
