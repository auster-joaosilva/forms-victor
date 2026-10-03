import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { sampleEvent, session } from '../testing/fixtures'
import { EventCover } from './event-cover'

const cover = () => document.getElementById('capa') as HTMLElement
const noop = { onRegister: vi.fn(), onProgram: vi.fn() }

describe('EventCover', () => {
  it.each(['marca', 'solido', 'aurora', 'onda'] as const)('paints the %s theme', (tema) => {
    render(<EventCover event={sampleEvent({ content: { ...sampleEvent().content, tema } })} today="2026-10-18" {...noop} />)
    expect(cover()).toHaveClass('capa', `tema-${tema}`)
  })

  it('draws the waves only on the onda theme', () => {
    const { rerender } = render(<EventCover event={sampleEvent({ content: { ...sampleEvent().content, tema: 'onda' } })} today="2026-10-18" {...noop} />)
    expect(cover().querySelector('svg.ondas')).not.toBeNull()
    rerender(<EventCover event={sampleEvent()} today="2026-10-18" {...noop} />)
    expect(cover().querySelector('svg.ondas')).toBeNull()
  })

  it('falls back to the brand theme when the photo theme has no photo, and shows the photo when there is one', () => {
    const { rerender } = render(<EventCover event={sampleEvent({ content: { ...sampleEvent().content, tema: 'foto', capa: null } })} today="2026-10-18" {...noop} />)
    expect(cover()).toHaveClass('tema-marca')
    rerender(
      <EventCover
        event={sampleEvent({ content: { ...sampleEvent().content, tema: 'foto', capa: { fileId: '0b8f9a2c-1d2e-4f50-9a6b-7c8d9e0f1a2b' } } })}
        today="2026-10-18"
        {...noop}
      />,
    )
    expect(cover()).toHaveClass('tema-foto')
    expect(cover().querySelector('figure.retrato-capa img')).toHaveAttribute('src', '/files/0b8f9a2c-1d2e-4f50-9a6b-7c8d9e0f1a2b')
  })

  it('treats an empty theme as the brand theme', () => {
    render(<EventCover event={sampleEvent({ content: { chamada: 'x' } })} today="2026-10-18" {...noop} />)
    expect(cover()).toHaveClass('tema-marca')
  })

  it('shows the label, the title, the call, one chip per session and the place', () => {
    render(
      <EventCover event={sampleEvent({ sessions: [session(), session({ id: 12, date: '2026-10-27', format: 'online', title: '' })] })} today="2026-10-18" {...noop} />,
    )
    expect(screen.getByText('Encontro gratuito · Uberlândia-MG')).toHaveClass('rotulo')
    expect(screen.getByRole('heading', { level: 1, name: 'Conexão Tributária' })).toBeInTheDocument()
    expect(screen.getByText('20/10/2026 — 19:30')).toBeInTheDocument()
    expect(screen.getByText('Presencial: Encontro 1')).toBeInTheDocument()
    expect(screen.getByText('27/10/2026 — 19:30')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Auditório da Auster — Uberlândia/MG')).toHaveClass('onde')
  })

  it.each([
    ['2026-10-20', 'É hoje.'],
    ['2026-10-19', 'É amanhã.'],
  ])('counts down from %s', (today, text) => {
    render(<EventCover event={sampleEvent()} today={today} {...noop} />)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('counts the days left and hides the countdown after the date', () => {
    const { rerender } = render(<EventCover event={sampleEvent()} today="2026-10-11" {...noop} />)
    expect(document.querySelector('.contagem')).toHaveTextContent('faltam 9 dias')
    rerender(<EventCover event={sampleEvent()} today="2026-10-21" {...noop} />)
    expect(document.querySelector('.contagem')).toBeNull()
  })

  it('offers the two buttons while registration is open and says it is closed otherwise', async () => {
    const onRegister = vi.fn()
    const onProgram = vi.fn()
    const { rerender } = render(<EventCover event={sampleEvent()} today="2026-10-18" onRegister={onRegister} onProgram={onProgram} />)
    await userEvent.click(screen.getByRole('button', { name: 'Quero me inscrever' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ver a programação' }))
    expect(onRegister).toHaveBeenCalledOnce()
    expect(onProgram).toHaveBeenCalledOnce()

    rerender(<EventCover event={sampleEvent({ registrations: 'closed' })} today="2026-10-18" onRegister={onRegister} onProgram={onProgram} />)
    expect(screen.getByText('As inscrições estão encerradas.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quero me inscrever' })).toBeNull()
    expect(document.querySelector('.contagem')).toBeNull()

    rerender(<EventCover event={sampleEvent({ status: 'draft' })} today="2026-10-18" onRegister={onRegister} onProgram={onProgram} />)
    expect(screen.getByText('As inscrições estão encerradas.')).toBeInTheDocument()
  })
})
