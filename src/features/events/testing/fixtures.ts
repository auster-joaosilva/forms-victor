import type { EventSessionView, EventSummary, EventView } from '@/server/events/domain/event'

export const session = (over: Partial<EventSessionView> = {}): EventSessionView => ({
  id: 11,
  order: 0,
  date: '2026-10-20',
  time: '19:30',
  format: 'in_person',
  title: 'Encontro 1',
  description: 'Panorama do IBS e da CBS.',
  location: 'Auditório da Auster',
  seats: 30,
  taken: 28,
  ...over,
})

export const sampleEvent = (over: Partial<EventView> = {}): EventView => ({
  id: 7,
  slug: 'conexao-tributaria',
  title: 'Conexão Tributária',
  status: 'published',
  registrations: 'open',
  content: {
    chamada: 'O que muda no Simples, explicado em duas horas.',
    local: 'Auditório da Auster — Uberlândia/MG',
    intro: 'Um encontro para sair com a conta feita.',
    destaques: [
      { titulo: 'IBS e CBS', texto: 'Como entram na guia única.' },
      { titulo: 'Simples Híbrido', texto: 'Quando vale recolher por fora.' },
    ],
    temas: ['Opção pelo regime regular', 'Crédito para o cliente'],
    avisos: ['Leve documento com foto.'],
    aposEncerrar: '',
    tema: 'marca',
    rotulo: 'Encontro gratuito · Uberlândia-MG',
    capa: null,
    palestrante: { nome: 'Victor Medeiros', cargo: 'Consultor tributário', bio: 'Acompanha a Reforma desde a tramitação.', foto: null },
  },
  sessions: [session()],
  ...over,
})

export const summary = (over: Partial<EventSummary> = {}): EventSummary => ({
  id: 7,
  slug: 'conexao-tributaria',
  title: 'Conexão Tributária',
  status: 'published',
  registrations: 'open',
  firstDate: '2026-10-20',
  sessionCount: 1,
  registered: 3,
  chamada: 'O que muda no Simples, explicado em duas horas.',
  ...over,
})
