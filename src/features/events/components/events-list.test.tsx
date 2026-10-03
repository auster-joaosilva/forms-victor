import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { summary } from '../testing/fixtures'
import { EventsList } from './events-list'

describe('EventsList', () => {
  it('opens with the brand cover of the agenda', () => {
    render(<EventsList events={[]} />)
    expect(screen.getByText('Agenda da Auster')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Encontros sobre a Reforma Tributária')
    expect(screen.getByText('O que muda na sua empresa, explicado por quem cuida dela todos os dias. Inscrição gratuita.')).toBeInTheDocument()
    expect(document.getElementById('capa')).toHaveClass('capa', 'tema-marca')
  })

  it('shows one card per event with the day, the month and the year', () => {
    render(<EventsList events={[summary(), summary({ id: 8, slug: 'cafe', title: 'Café', firstDate: null, sessionCount: 3, registrations: 'closed', chamada: null })]} />)
    const first = screen.getByRole('link', { name: /Conexão Tributária/ })
    expect(first).toHaveAttribute('href', '/events/conexao-tributaria')
    expect(within(first).getByText('20')).toBeInTheDocument()
    expect(within(first).getByText('out 2026')).toBeInTheDocument()
    expect(within(first).getByText('O que muda no Simples, explicado em duas horas.')).toBeInTheDocument()
    expect(within(first).getByText('inscrição aberta →')).toBeInTheDocument()

    const second = screen.getByRole('link', { name: /Café/ })
    expect(within(second).getByText('data a definir')).toBeInTheDocument()
    expect(within(second).getByText('3 encontros · inscrições encerradas →')).toBeInTheDocument()
  })

  it('says nothing is scheduled when the list is empty', () => {
    render(<EventsList events={[]} />)
    expect(screen.getByText('Nenhum encontro marcado no momento.')).toBeInTheDocument()
    expect(screen.getByText(/Assim que a próxima data sair, ela aparece aqui\./)).toBeInTheDocument()
  })

  it('sends "Fazer o diagnóstico" to /diagnosis, not to the home page', () => {
    render(<EventsList events={[]} />)
    expect(screen.getByRole('heading', { name: 'Já sabe o que a reforma faz com a sua empresa?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fazer o diagnóstico' })).toHaveAttribute('href', '/diagnosis')
  })
})
