import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AdhesionReceipt } from '@/server/adhesion/domain/adhesion'
import type { AdhesionApi, AdhesionBootstrap } from '../types/adhesion'
import { AdhesionPage } from './adhesion-page'

const receipt: AdhesionReceipt = {
  protocol: 'ADS-20261001-AB2CD',
  acceptedAt: '2026-10-01T16:00:00.000Z',
  acceptedAtDisplay: '01/10/2026, 13:00:00',
  modalidade: 'padrao',
  empresa: {
    nomeEmpresa: 'Padaria Boa Massa Ltda',
    cnpj: '11.222.333/0001-81',
    representante: 'Maria Souza',
    cpf: '529.982.247-25',
    cargo: 'Sócio',
    email: 'maria@boamassa.com.br',
    telefone: '',
  },
  semManifestacao: null,
  querProposta: false,
  termVersion: 'V5',
  termHash: '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004',
  originIp: '203.0.113.9',
}

const bootstrap = (extra: Partial<AdhesionBootstrap> = {}): AdhesionBootstrap => ({
  window: { state: 'open', end: '2026-10-30' },
  prefill: {},
  invitationToken: null,
  receipt: null,
  ...extra,
})

const api = (): AdhesionApi => ({
  lookupCompany: vi.fn(async () => ({ companyName: null })),
  submit: vi.fn(async () => ({ ok: true as const, receipt })),
  startNew: vi.fn(async () => undefined),
})

describe('AdhesionPage', () => {
  it('com a janela aberta e sem recibo mostra o formulário', () => {
    render(<AdhesionPage bootstrap={bootstrap()} api={api()} print={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Identificação da empresa' })).toBeInTheDocument()
    expect(
      screen.getByText('Modalidade de recolhimento da CBS no Simples Nacional — 1º semestre de 2027'),
    ).toBeInTheDocument()
  })

  it('com a janela encerrada mostra o cartão e nenhum campo', () => {
    render(
      <AdhesionPage
        bootstrap={bootstrap({ window: { state: 'closed', end: '2026-10-30' } })}
        api={api()}
        print={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'A janela de opção encerrou' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('o recibo do cookie volta no F5, mesmo com a janela já encerrada', () => {
    render(
      <AdhesionPage
        bootstrap={bootstrap({ receipt, window: { state: 'closed', end: '2026-10-30' } })}
        api={api()}
        print={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Opção registrada' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'A janela de opção encerrou' })).not.toBeInTheDocument()
  })

  it('imprime com o nome do arquivo do antigo e a via da versão aceita', async () => {
    const user = userEvent.setup()
    const print = vi.fn()
    const { container } = render(
      <AdhesionPage bootstrap={bootstrap({ receipt })} api={api()} print={print} />,
    )
    await user.click(screen.getByRole('button', { name: 'Baixar o termo (PDF)' }))
    expect(print).toHaveBeenCalledWith('Termo-Opcao-SN-PADARIA-BOA-MASSA-LTDA')
    expect(container.querySelector('.ad-doc')?.textContent).toContain('versão do termo V5')
  })

  it('"Nova confirmação" apaga o cookie e volta ao formulário vazio', async () => {
    const user = userEvent.setup()
    const fake = api()
    render(
      <AdhesionPage
        bootstrap={bootstrap({ receipt, prefill: { nomeEmpresa: 'Boa Massa' } })}
        api={fake}
        print={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Nova confirmação' }))
    expect(fake.startNew).toHaveBeenCalledOnce()
    expect(await screen.findByLabelText('Razão social')).toHaveValue('')
  })
})
