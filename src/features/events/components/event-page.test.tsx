import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EventView } from '@/server/events/domain/event'
import { sampleEvent, session } from '../testing/fixtures'
import type { EventsApi } from '../types/events'
import { EventPage } from './event-page'

const api: EventsApi = { lookupCompany: vi.fn(async () => ({ companyName: null })), submit: vi.fn() }
const renderPage = (event: EventView, today = '2026-10-18') => render(<EventPage bootstrap={{ event, today, publicUrl: '' }} api={api} />)
const anchors = () => [...document.querySelectorAll('#barra nav a')].map((anchor) => anchor.textContent)

describe('EventPage sections', () => {
  it('shows every section the event has, in the old order, with the literal kickers and titles', () => {
    renderPage(sampleEvent())
    const titles = [...document.querySelectorAll('main section h2')].map((heading) => heading.textContent)
    expect(titles).toEqual(['O que você vai ver', 'Temas abordados', 'Um encontro', 'Victor Medeiros', 'Na casa da Auster', 'Para participar', 'Garanta a sua vaga'])
    expect(screen.getByText('o encontro')).toHaveClass('olho')
    expect(screen.getByText('Um encontro para sair com a conta feita.')).toBeInTheDocument()
    expect(screen.getByText('IBS e CBS')).toBeInTheDocument()
    expect(within(document.getElementById('temas') as HTMLElement).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('A inscrição é por encontro: escolha o que couber na sua agenda.')).toBeInTheDocument()
  })

  it('builds the bar anchors from the sections that exist', () => {
    renderPage(sampleEvent())
    expect(anchors()).toEqual(['O encontro', 'Temas', 'Programação', 'Quem apresenta', 'Onde acontece', 'Como participar'])
    expect(within(document.getElementById('barra') as HTMLElement).getByRole('button', { name: 'Inscrever-se' })).toBeInTheDocument()
  })

  it('drops the sections without content, and their anchors', () => {
    renderPage(sampleEvent({ content: { chamada: 'x' }, sessions: [session({ format: 'online' })] }))
    expect(document.getElementById('sobre')).toBeNull()
    expect(document.getElementById('temas')).toBeNull()
    expect(document.getElementById('quem')).toBeNull()
    expect(document.getElementById('onde')).toBeNull()
    expect(anchors()).toEqual(['Programação', 'Como participar'])
  })

  it('lists each session with its date, weekday, time, format and seats badge', () => {
    renderPage(sampleEvent({ sessions: [session(), session({ id: 12, date: '2026-10-27', format: 'online', seats: null, title: 'Encontro 2', description: null, location: null })] }))
    const program = document.getElementById('programa') as HTMLElement
    expect(within(program).getByRole('heading', { name: '2 encontros' })).toBeInTheDocument()
    expect(within(program).getByText('20/10/2026')).toBeInTheDocument()
    expect(within(program).getAllByText(/terça-feira/)).toHaveLength(2)
    expect(within(program).getByText('Panorama do IBS e da CBS.')).toBeInTheDocument()
    expect(within(program).getByText('Últimas 2 vagas')).toHaveClass('selo', 'restam')
    expect(within(program).getByText('Online')).toHaveClass('selo', 'online')
  })

  it('shows "Onde acontece" only with a place and an in-person session', () => {
    renderPage(sampleEvent())
    const where = document.getElementById('onde') as HTMLElement
    expect(within(where).getByRole('img', { name: 'Fachada da Auster, em Uberlândia' })).toHaveAttribute('src', '/imagens/fachada-larga.jpg')
    expect(within(where).getByText(/Os encontros presenciais são na nossa casa, em Uberlândia\./)).toBeInTheDocument()
    expect(within(where).getByText('Auditório da Auster — Uberlândia/MG')).toHaveClass('endereco')
    expect(within(where).getByText(/Chegue com alguns minutos de folga/)).toBeInTheDocument()
  })

  it('fills "Para participar" with the days, the times, the place and the warnings', () => {
    renderPage(sampleEvent())
    const info = document.getElementById('participar') as HTMLElement
    expect(within(info).getByText('Quando')).toBeInTheDocument()
    expect(within(info).getByText('20/10/2026 às 19:30 — Presencial')).toBeInTheDocument()
    expect(within(info).getByText('Importante')).toBeInTheDocument()
    expect(within(info).getByText('Leve documento com foto.')).toBeInTheDocument()
  })

  it('shows the speaker photo from the stored file', () => {
    renderPage(sampleEvent({ content: { ...sampleEvent().content, palestrante: { nome: 'Ana', foto: { fileId: '0b8f9a2c-1d2e-4f50-9a6b-7c8d9e0f1a2b' } } } }))
    expect(screen.getByRole('img', { name: 'Ana' })).toHaveAttribute('src', '/files/0b8f9a2c-1d2e-4f50-9a6b-7c8d9e0f1a2b')
  })
})

describe('EventPage registration states', () => {
  it('says registration is closed, with the text the team wrote or the default', () => {
    const { unmount } = renderPage(sampleEvent({ registrations: 'closed', content: { aposEncerrar: 'Volte em março.' } }))
    expect(screen.getByRole('heading', { name: 'As inscrições estão encerradas' })).toBeInTheDocument()
    expect(screen.getByText('Volte em março.')).toHaveClass('encerrado')
    unmount()
    renderPage(sampleEvent({ status: 'closed', content: {} }))
    expect(screen.getByText('Se quiser ser avisado do próximo encontro, fale com a Auster.')).toBeInTheDocument()
  })

  it('says every seat is taken when no session has one left', () => {
    renderPage(sampleEvent({ sessions: [session({ seats: 2, taken: 2 })] }))
    expect(screen.getByRole('heading', { name: 'Todas as vagas foram preenchidas' })).toBeInTheDocument()
    expect(screen.getByText('Fale com a Auster para entrar na lista de espera.')).toBeInTheDocument()
  })

  it('opens the registration band while there is a seat', () => {
    renderPage(sampleEvent())
    const band = document.getElementById('inscricao') as HTMLElement
    expect(band).toHaveClass('faixa')
    expect(within(band).getByText('Gratuita. A equipe da Auster confirma a sua vaga por e-mail e manda as instruções antes do encontro.')).toBeInTheDocument()
  })
})
