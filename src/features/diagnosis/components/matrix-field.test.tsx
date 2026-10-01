import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CUSTOMER_TYPES, PERCENT_BANDS, QUESTIONS } from '@/server/diagnosis/domain/questions'
import { MatrixField } from './matrix-field'

const question = QUESTIONS.find((q) => q.type === 'matrix')
if (!question) throw new Error('sem matriz no formulário')

describe('MatrixField (U-01)', () => {
  it('names every row and every cell for screen readers and for the phone list', () => {
    const { container } = render(<MatrixField question={question} answers={{}} onChange={() => undefined} />)
    const cells = CUSTOMER_TYPES.length * PERCENT_BANDS.length
    expect(screen.getAllByRole('rowheader')).toHaveLength(CUSTOMER_TYPES.length)
    expect(screen.getAllByRole('radio')).toHaveLength(cells)
    expect(container.querySelectorAll('td .dx-matrix-band')).toHaveLength(cells)
    expect(screen.getByRole('radio', { name: 'Órgão público: não sei' })).toBeInTheDocument()
    expect(screen.getAllByText('não sei', { selector: '.dx-matrix-band' })).toHaveLength(CUSTOMER_TYPES.length)
  })

  it('reports the row and band that were clicked and shows the sum', async () => {
    const onChange = vi.fn()
    render(<MatrixField question={question} answers={{ receitaPorCliente: { pessoa_fisica: 'acima_80', simples_mei: 'ate_20' } }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Exterior: até 20%' }))
    expect(onChange).toHaveBeenCalledWith('exterior', 'ate_20')
    expect(screen.getByText('Soma aproximada: 100%')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Pessoa física / consumidor final: acima de 80%' })).toBeChecked()
  })
})
