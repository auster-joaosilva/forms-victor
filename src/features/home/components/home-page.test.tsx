import { render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { HomeBootstrap } from '../types/home'
import { HomePage } from './home-page'

const base: HomeBootstrap = { events: { kind: 'none' }, adhesionWindow: 'open', publicUrl: 'https://hml-reforma.austercontabil.com.br' }

const door = (title: string) => screen.getByRole('heading', { level: 3, name: title }).closest('a') as HTMLAnchorElement

describe('HomePage', () => {
  it('shows the cover, the three steps and who makes it, with the literal texts of the old home page', () => {
    render(<HomePage bootstrap={base} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A Reforma Tributária na sua empresa')
    expect(screen.getByText(/Diagnóstico, formalização da opção e encontros presenciais\./)).toBeInTheDocument()
    expect(screen.getByText('4 a 10 min')).toBeInTheDocument()
    expect(screen.getByText('o termo de opção assinado')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Recepção da Auster, em Uberlândia' })).toHaveAttribute('src', '/imagens/recepcao.jpg')
    expect(screen.getByRole('heading', { name: 'Escolha o que a sua empresa precisa agora' })).toBeInTheDocument()
    expect(screen.getByText('Três passos, na ordem')).toBeInTheDocument()
    expect(screen.getByText('Formalize a opção')).toBeInTheDocument()
    expect(screen.getByText(/Questões de natureza jurídica exigem validação de advogado\./)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fale com a gente' })).toBeInTheDocument()
    expect(screen.getByText(/Auster Inteligência Contábil · CRC MG-007231\/O-8 · Uberlândia-MG/)).toBeInTheDocument()
  })

  it('sends every diagnosis button to /diagnosis, never to the home page itself', () => {
    render(<HomePage bootstrap={base} />)
    for (const link of screen.getAllByRole('link', { name: 'Fazer o diagnóstico' })) expect(link).toHaveAttribute('href', '/diagnosis')
    expect(door('Diagnóstico')).toHaveAttribute('href', '/diagnosis')
    expect(within(door('Diagnóstico')).getByText('Começar o diagnóstico →')).toBeInTheDocument()
  })

  it('opens the term door while the window is open and closes it after', () => {
    const { rerender } = render(<HomePage bootstrap={base} />)
    expect(door('Termo de opção')).toHaveAttribute('href', '/adhesion')
    expect(door('Termo de opção')).not.toHaveClass('fechada')
    expect(within(door('Termo de opção')).getByText('Assinar o termo →')).toBeInTheDocument()

    rerender(<HomePage bootstrap={{ ...base, adhesionWindow: 'closed' }} />)
    expect(door('Termo de opção')).toHaveClass('fechada')
    expect(
      within(door('Termo de opção')).getByText('A janela de opção está encerrada. Fale com a Auster para saber quando a próxima abre e o que fazer até lá.'),
    ).toBeInTheDocument()
    expect(within(door('Termo de opção')).getByText('Encerrado por ora')).toBeInTheDocument()
  })

  it('says there is no meeting when the agenda is empty', () => {
    render(<HomePage bootstrap={base} />)
    expect(door('Encontros')).toHaveAttribute('href', '/events')
    expect(door('Encontros')).toHaveClass('fechada')
    expect(within(door('Encontros')).getByText('Nenhum encontro marcado no momento. Quando a próxima data sair, ela aparece aqui primeiro.')).toBeInTheDocument()
    expect(within(door('Encontros')).getByText('Ver a agenda →')).toBeInTheDocument()
  })

  it('names the next meeting, with the date in full and how many are open', () => {
    const { rerender } = render(
      <HomePage bootstrap={{ ...base, events: { kind: 'event', title: 'Conexão Tributária', slug: 'conexao-tributaria', date: '2026-10-20', openCount: 2 } }} />,
    )
    expect(within(door('Encontros')).getByText('Conexão Tributária — 20 de outubro. Há 2 encontros abertos.')).toBeInTheDocument()
    expect(within(door('Encontros')).getByText('Quero me inscrever →')).toBeInTheDocument()
    expect(door('Encontros')).not.toHaveClass('fechada')

    rerender(<HomePage bootstrap={{ ...base, events: { kind: 'event', title: 'Café com a Auster', slug: 'cafe', date: null, openCount: 1 } }} />)
    expect(within(door('Encontros')).getByText('Café com a Auster. Inscrição gratuita.')).toBeInTheDocument()
  })

  it('opens the contact door by e-mail and never links to the back office', () => {
    const html = renderToString(<HomePage bootstrap={base} />)
    expect(html).toContain('mailto:contato@austercontabil.com.br')
    expect(html).not.toContain('/backoffice')
    render(<HomePage bootstrap={base} />)
    expect(door('Falar com a Auster')).toHaveAttribute('href', 'mailto:contato@austercontabil.com.br')
  })
})
