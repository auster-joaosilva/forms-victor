import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SessionsTable, sessionsToSave, type SessionRow } from './sessions-table'

const existing: SessionRow[] = [
  { key: 's1', id: 1, date: '2026-11-12', time: '19:30', format: 'in_person', title: 'Encontro 1', description: 'Abertura', location: 'Auditório', seats: '30', taken: 4 },
  { key: 's2', id: 2, date: '2026-11-19', time: '19:30', format: 'online', title: '', description: '', location: '', seats: '', taken: 0 },
]

function Harness() {
  const [rows, setRows] = useState(existing)
  return (
    <>
      <SessionsTable rows={rows} onChange={setRows} disabled={false} />
      <output data-testid="saved">{JSON.stringify(sessionsToSave(rows))}</output>
    </>
  )
}

describe('SessionsTable', () => {
  it('keeps a session that already has registrations and lets the empty one go', async () => {
    render(<Harness />)
    const [first, second] = screen.getAllByRole('row').slice(1)
    expect(within(first as HTMLElement).getByText('4 inscritos')).toBeInTheDocument()
    expect(within(first as HTMLElement).queryByRole('button', { name: 'Tirar' })).not.toBeInTheDocument()
    expect(within(second as HTMLElement).getByPlaceholderText('Encontro 2')).toBeInTheDocument()
    await userEvent.click(within(second as HTMLElement).getByRole('button', { name: 'Tirar' }))
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })

  it('saves the description, turns blank seats into no limit and drops rows without date or time', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Acrescentar encontro' }))
    const saved = JSON.parse(screen.getByTestId('saved').textContent ?? '[]')
    expect(saved).toEqual([
      { id: 1, date: '2026-11-12', time: '19:30', format: 'in_person', title: 'Encontro 1', description: 'Abertura', location: 'Auditório', seats: 30 },
      { id: 2, date: '2026-11-19', time: '19:30', format: 'online', title: '', description: null, location: null, seats: null },
    ])
  })
})
