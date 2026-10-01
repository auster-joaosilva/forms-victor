import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { CURRENT_TERM } from '@/server/adhesion/domain/term'
import { useAdhesionForm } from '../hooks/use-adhesion-form'
import type { AdhesionApi, AdhesionPrefill } from '../types/adhesion'
import { AdhesionForm } from './adhesion-form'

const receipt = {
  protocol: 'ADS-20261001-AB2CD',
  acceptedAt: '2026-10-01T16:00:00.000Z',
  acceptedAtDisplay: '01/10/2026, 13:00:00',
  modalidade: 'padrao' as const,
  empresa: {
    nomeEmpresa: 'Padaria Boa Massa Ltda',
    cnpj: '11.222.333/0001-81',
    representante: 'Maria Souza',
    cpf: '529.982.247-25',
    cargo: 'Sócio',
    email: 'maria@boamassa.com.br',
    telefone: '34999990000',
  },
  semManifestacao: null,
  querProposta: false,
  termVersion: 'V5',
  termHash: '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004',
  originIp: '203.0.113.9',
}

function fakeApi(overrides: Partial<AdhesionApi> = {}): AdhesionApi {
  return {
    lookupCompany: vi.fn(async () => ({ companyName: 'PADARIA BOA MASSA LTDA' })),
    submit: vi.fn(async () => ({ ok: true as const, receipt })),
    startNew: vi.fn(async () => undefined),
    ...overrides,
  }
}

function Harness({
  api,
  prefill = {},
  invitationToken = null,
}: {
  api: AdhesionApi
  prefill?: AdhesionPrefill
  invitationToken?: string | null
}) {
  const form = useAdhesionForm({ api, prefill, invitationToken, initialReceipt: null })
  return form.receipt ? (
    <p>recibo {form.receipt.protocol}</p>
  ) : (
    <AdhesionForm form={form} term={CURRENT_TERM} />
  )
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Razão social'), 'Padaria Boa Massa Ltda')
  await user.type(screen.getByLabelText('CNPJ'), '11.222.333/0001-81')
  await user.type(screen.getByLabelText('Nome do representante legal'), 'Maria Souza')
  await user.selectOptions(screen.getByLabelText('Cargo de quem confirma'), 'Sócio')
  await user.type(screen.getByLabelText('CPF do representante'), '529.982.247-25')
  await user.type(screen.getByLabelText('E-mail'), 'maria@boamassa.com.br')
  await user.type(screen.getByLabelText('Telefone'), '34999990000')
}

describe('AdhesionForm', () => {
  it('fica travado até a hidratação, para um clique cedo não se perder', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToString(<Harness api={fakeApi()} />)
    expect(host.querySelector('fieldset')?.hasAttribute('disabled')).toBe(true)
  })

  it('mostra a faixa de prazo e o texto do termo corrente', () => {
    render(<Harness api={fakeApi()} />)
    expect(screen.getByText('até 30/10/2026')).toBeInTheDocument()
    expect(screen.getByText(CURRENT_TERM.orientacao)).toBeInTheDocument()
    expect(screen.getByText(CURRENT_TERM.declaracao)).toBeInTheDocument()
  })

  it('abre a sub-escolha só no híbrido e a limpa ao trocar de modalidade', async () => {
    const user = userEvent.setup()
    render(<Harness api={fakeApi()} />)
    expect(screen.queryByText(CURRENT_TERM.semManifestacao.enunciado)).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /^Opção 2/ }))
    expect(screen.getByText(CURRENT_TERM.semManifestacao.enunciado)).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /autoriza a Auster a cancelar a opção/ }))
    await user.click(screen.getByRole('radio', { name: /^Opção 1/ }))
    expect(screen.queryByText(CURRENT_TERM.semManifestacao.enunciado)).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /^Opção 2/ }))
    expect(screen.getByRole('radio', { name: /autoriza a Auster a cancelar a opção/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /a opção pelo Simples Híbrido será mantida/ })).not.toBeChecked()
  })

  it('mascara o CNPJ ao sair do campo e preenche a razão social vazia pela consulta', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    render(<Harness api={api} />)
    await user.type(screen.getByLabelText('CNPJ'), '11222333000181')
    await user.tab()
    expect(screen.getByLabelText('CNPJ')).toHaveValue('11.222.333/0001-81')
    expect(api.lookupCompany).toHaveBeenCalledWith({ cnpj: '11.222.333/0001-81' })
    expect(await screen.findByDisplayValue('PADARIA BOA MASSA LTDA')).toBeInTheDocument()
  })

  it('não troca a razão social já digitada e avisa quando a consulta falha, sem bloquear', async () => {
    const user = userEvent.setup()
    render(<Harness api={fakeApi({ lookupCompany: vi.fn(async () => ({ companyName: null })) })} />)
    await user.type(screen.getByLabelText('Razão social'), 'Boa Massa')
    await user.type(screen.getByLabelText('CNPJ'), '11222333000181')
    await user.tab()
    expect(
      await screen.findByText('não consegui consultar o cadastro agora — confira a razão social à mão.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Razão social')).toHaveValue('Boa Massa')
  })

  it('não consulta CNPJ inválido e mostra a dica enquanto nada foi consultado', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    render(<Harness api={api} />)
    expect(
      screen.getByText('digite o CNPJ e saia do campo: a razão social vem da Receita'),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('CNPJ'), '11222333000182')
    await user.tab()
    expect(api.lookupCompany).not.toHaveBeenCalled()
  })

  it('mascara o CPF ao sair do campo', async () => {
    const user = userEvent.setup()
    render(<Harness api={fakeApi()} />)
    await user.type(screen.getByLabelText('CPF do representante'), '52998224725')
    await user.tab()
    expect(screen.getByLabelText('CPF do representante')).toHaveValue('529.982.247-25')
  })

  it('com campo faltando, diz "Faltam campos acima." e as mensagens do antigo, sem enviar', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    render(<Harness api={api} />)
    await user.click(screen.getByRole('button', { name: 'Confirmar a opção' }))
    expect(screen.getByText('Faltam campos acima.')).toBeInTheDocument()
    for (const message of [
      'informe a razão social',
      'CNPJ incompleto ou inválido',
      'informe o nome de quem confirma',
      'CPF incompleto ou inválido',
      'informe o cargo',
      'e-mail inválido',
      'telefone inválido',
      'escolha uma das duas modalidades',
      'é preciso marcar a declaração para confirmar',
    ]) {
      expect(screen.getByText(message)).toBeInTheDocument()
    }
    expect(api.submit).not.toHaveBeenCalled()
  })

  it('envia com a versão corrente e o convite, e mostra o recibo', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    render(<Harness api={api} invitationToken="CONVITE001" />)
    await fillValid(user)
    await user.click(screen.getByRole('radio', { name: /^Opção 1/ }))
    await user.click(screen.getByRole('checkbox', { name: /Li o termo acima/ }))
    await user.click(screen.getByRole('button', { name: 'Confirmar a opção' }))
    expect(api.submit).toHaveBeenCalledWith({
      vinculo: 'CONVITE001',
      versaoTermo: 'V5',
      empresa: {
        nomeEmpresa: 'Padaria Boa Massa Ltda',
        cnpj: '11.222.333/0001-81',
        representante: 'Maria Souza',
        cpf: '529.982.247-25',
        cargo: 'Sócio',
        email: 'maria@boamassa.com.br',
        telefone: '34999990000',
      },
      modalidade: 'padrao',
      semManifestacao: null,
      querProposta: false,
      declara: true,
    })
    expect(await screen.findByText('recibo ADS-20261001-AB2CD')).toBeInTheDocument()
  })

  it('mostra a recusa do servidor no formato do antigo, como a de página aberta antes da V5', async () => {
    const user = userEvent.setup()
    const api = fakeApi({
      submit: vi.fn(async () => ({
        ok: false as const,
        error: 'o termo foi atualizado; recarregue a página e confirme de novo',
      })),
    })
    render(<Harness api={api} />)
    await fillValid(user)
    await user.click(screen.getByRole('radio', { name: /^Opção 1/ }))
    await user.click(screen.getByRole('checkbox', { name: /Li o termo acima/ }))
    await user.click(screen.getByRole('button', { name: 'Confirmar a opção' }))
    expect(
      await screen.findByText(
        'Não consegui registrar: o termo foi atualizado; recarregue a página e confirme de novo. Tente de novo.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar a opção' })).toBeEnabled()
  })

  it('mostra a queda de rede como erro de envio', async () => {
    const user = userEvent.setup()
    render(
      <Harness api={fakeApi({ submit: vi.fn(async () => Promise.reject(new Error('Failed to fetch'))) })} />,
    )
    await fillValid(user)
    await user.click(screen.getByRole('radio', { name: /^Opção 1/ }))
    await user.click(screen.getByRole('checkbox', { name: /Li o termo acima/ }))
    await user.click(screen.getByRole('button', { name: 'Confirmar a opção' }))
    expect(
      await screen.findByText('Não consegui registrar: Failed to fetch. Tente de novo.'),
    ).toBeInTheDocument()
  })

  it('começa com o pré-preenchimento do convite', () => {
    render(<Harness api={fakeApi()} prefill={{ nomeEmpresa: 'Boa Massa', email: 'maria@boamassa.com.br' }} />)
    expect(screen.getByLabelText('Razão social')).toHaveValue('Boa Massa')
    expect(screen.getByLabelText('E-mail')).toHaveValue('maria@boamassa.com.br')
    expect(screen.getByLabelText('CNPJ')).toHaveValue('')
  })
})
