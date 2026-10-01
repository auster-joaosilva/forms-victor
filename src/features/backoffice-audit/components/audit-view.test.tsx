import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuditView } from './audit-view'

describe('AuditView', () => {
  it('labels actions in Portuguese and keeps unknown ones as they are', () => {
    render(<AuditView entries={[
      { id: 2, occurredAt: '2026-09-20T12:00:00.000Z', actorUsername: 'maria', action: 'response_handled', reference: '7', detail: '{"from":"new","to":"validated"}' },
      { id: 1, occurredAt: '2026-09-19T12:00:00.000Z', actorUsername: null, action: 'acao_antiga', reference: null, detail: '' },
    ]} />)
    expect(screen.getByText('resposta tratada')).toBeInTheDocument()
    expect(screen.getByText('acao_antiga')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('says when nothing was recorded', () => {
    render(<AuditView entries={[]} />)
    expect(screen.getByText(/Nada registrado ainda\./)).toBeInTheDocument()
  })
})
