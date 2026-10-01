import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ResponseDetail as Detail } from '../api/responses'
import { ResponseDetail } from './response-detail'

const detail: Detail = {
  id: 7, protocol: 'DS-260915-AB12', invitationToken: null, viaInvitation: false, companyName: 'Padaria Boa', cnpj: '11.222.333/0001-81',
  requester: 'Ana', email: 'ana@padaria.com', phone: '(34) 99999-9999', receivedAt: '2026-09-15T12:00:00.000Z',
  updatedAt: '2026-09-21T12:00:00.000Z', formVersion: 'sintetico',
  position: 'Simples híbrido', outcome: 'B', certainty: 'aberta', urgency: 'ALTA', confidence: 'MÉDIA',
  engine: { outcome: 'B', position: 'Simples híbrido', certainty: 'aberta', urgency: 'ALTA', confidence: 'MÉDIA', gaps: ['margemLiquida'], triggers: [], openPoints: ['conferir a margem'] },
  requesterInQsa: false,
  answers: { blocks: [{ number: 1, title: 'Identificação', rows: [{ key: 'regimeAtual', prompt: 'Regime tributário atual', value: { kind: 'text', text: 'Simples Nacional' } }] }], outsideForm: [{ key: 'campoAntigo', value: { kind: 'text', text: 'x' } }], total: 2 },
  status: 'in_review', internalNote: 'nota', handledBy: 'maria', handledAt: '2026-09-20T12:00:00.000Z', changedAfterHandling: true,
}

describe('ResponseDetail', () => {
  it('shows the QSA alert, the client change warning, the last handling and the answers by block', () => {
    render(<ResponseDetail detail={detail} pending={false} onHandle={() => undefined} onClose={() => undefined} />)
    expect(screen.getByText(/Quem respondeu não consta do quadro de sócios/)).toBeInTheDocument()
    expect(screen.getByText(/Alterada pelo cliente em .*, depois do último tratamento\./)).toBeInTheDocument()
    expect(screen.getByText(/Último tratamento: maria em/)).toBeInTheDocument()
    expect(screen.getByText('Simples Nacional')).toBeInTheDocument()
    expect(screen.getByText('fora do formulário atual')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir plano de ação (PDF)' })).toHaveAttribute('href', '/backoffice/responses/7/report')
  })

  it('changes the status with the note, or saves only the note', async () => {
    const onHandle = vi.fn()
    render(<ResponseDetail detail={detail} pending={false} onHandle={onHandle} onClose={() => undefined} />)
    await userEvent.clear(screen.getByRole('textbox'))
    await userEvent.type(screen.getByRole('textbox'), 'ok')
    await userEvent.click(screen.getByRole('button', { name: 'Validada' }))
    await userEvent.click(screen.getByRole('button', { name: 'Só salvar a nota' }))
    expect(onHandle.mock.calls).toEqual([['validated', 'ok'], [null, 'ok']])
  })
})
