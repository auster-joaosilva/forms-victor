import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AdhesionReceipt } from '@/server/adhesion/domain/adhesion'
import { ReceiptView } from './receipt'

const receipt = (extra: Partial<AdhesionReceipt> = {}): AdhesionReceipt => ({
  protocol: 'ADS-20261001-AB2CD',
  acceptedAt: '2026-10-01T16:00:00.000Z',
  acceptedAtDisplay: '01/10/2026, 13:00:00',
  modalidade: 'hibrido',
  empresa: {
    nomeEmpresa: 'Padaria Boa Massa Ltda',
    cnpj: '11.222.333/0001-81',
    representante: 'Maria Souza',
    cpf: '529.982.247-25',
    cargo: 'Sócio',
    email: 'maria@boamassa.com.br',
    telefone: '',
  },
  semManifestacao: 'manter',
  querProposta: false,
  termVersion: 'V5',
  termHash: '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004',
  originIp: null,
  ...extra,
})

describe('ReceiptView', () => {
  it('mostra protocolo, modalidade, data de Brasília e a linha do híbrido', () => {
    render(<ReceiptView receipt={receipt()} onPrint={() => undefined} onStartNew={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Opção registrada' })).toBeInTheDocument()
    expect(screen.getByText('ADS-20261001-AB2CD')).toBeInTheDocument()
    expect(screen.getByText('Simples Nacional Híbrido (CBS fora do DAS)')).toBeInTheDocument()
    expect(screen.getByText('01/10/2026, 13:00:00')).toBeInTheDocument()
    expect(
      screen.getByText(
        'A Auster fará a opção no Portal do Simples Nacional até 30/10/2026 e confirmará por e-mail.',
      ),
    ).toBeInTheDocument()
  })

  it('no padrão diz que não há nada a protocolar', () => {
    render(
      <ReceiptView
        receipt={receipt({ modalidade: 'padrao', semManifestacao: null })}
        onPrint={() => undefined}
        onStartNew={() => undefined}
      />,
    )
    expect(screen.getByText('Simples Nacional Puro (Padrão)')).toBeInTheDocument()
    expect(
      screen.getByText('Nada a protocolar: a empresa permanece com a CBS dentro do DAS.'),
    ).toBeInTheDocument()
  })

  it('baixa o PDF, começa nova confirmação e volta ao diagnóstico', async () => {
    const user = userEvent.setup()
    const onPrint = vi.fn()
    const onStartNew = vi.fn()
    render(<ReceiptView receipt={receipt()} onPrint={onPrint} onStartNew={onStartNew} />)
    expect(screen.getByRole('heading', { name: 'Guarde a sua via' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Baixar o termo (PDF)' }))
    await user.click(screen.getByRole('button', { name: 'Nova confirmação' }))
    expect(onPrint).toHaveBeenCalledOnce()
    expect(onStartNew).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Voltar ao diagnóstico' })).toHaveAttribute('href', '/diagnosis')
  })

  it('o botão do PDF só responde depois da hidratação', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToString(
      <ReceiptView receipt={receipt()} onPrint={() => undefined} onStartNew={() => undefined} />,
    )
    expect([...host.querySelectorAll('button')].every((button) => button.disabled)).toBe(true)
  })
})
