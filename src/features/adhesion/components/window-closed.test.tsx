import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WindowClosed } from './window-closed'

describe('WindowClosed', () => {
  it('explica que a janela encerrou, com a data, o contato e nenhum campo', () => {
    render(<WindowClosed end="2026-10-30" />)
    expect(screen.getByRole('heading', { name: 'A janela de opção encerrou' })).toBeInTheDocument()
    expect(screen.getByText('30/10/2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'contato@austercontabil.com.br' })).toHaveAttribute(
      'href',
      'mailto:contato@austercontabil.com.br',
    )
    expect(screen.getByText(/nada muda: a Auster já tem o registro/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
