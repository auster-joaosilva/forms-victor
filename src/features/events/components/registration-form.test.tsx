import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { EventView } from '@/server/events/domain/event'
import { sampleEvent, session } from '../testing/fixtures'
import type { EventsApi, RegistrationReceiptWire } from '../types/events'
import { EventPage } from './event-page'

const receipt: RegistrationReceiptWire = {
  protocol: 'INS-20261018-AB2CD',
  repeated: false,
  sessionLabel: '20/10/2026, 19:30 — Presencial: Encontro 1',
  name: 'Ana Souza',
  email: 'ana@boamassa.com.br',
}

function fakeApi(overrides: Partial<EventsApi> = {}): EventsApi {
  return {
    lookupCompany: vi.fn(async () => ({ companyName: 'PADARIA BOA MASSA LTDA' })),
    submit: vi.fn(async () => ({ ok: true as const, receipt })),
    ...overrides,
  }
}

const renderPage = (api: EventsApi, event: EventView = sampleEvent({ sessions: [session(), session({ id: 12, date: '2026-10-27', seats: 1, taken: 1 })] })) =>
  render(<EventPage bootstrap={{ event, today: '2026-10-18', publicUrl: '' }} api={api} />)

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Qual encontro'), '11')
  await user.type(screen.getByLabelText('Seu nome'), 'Ana Souza')
  await user.type(screen.getByLabelText('E-mail'), 'ana@boamassa.com.br')
  await user.type(screen.getByLabelText('Telefone (WhatsApp)'), '34999990000')
  await user.click(screen.getByRole('checkbox'))
}

describe('registration form', () => {
  it('keeps the fields disabled until the page hydrates', () => {
    const html = renderToString(<EventPage bootstrap={{ event: sampleEvent(), today: '2026-10-18', publicUrl: '' }} api={fakeApi()} />)
    expect(html).toMatch(/<fieldset[^>]*disabled/)
  })

  it('offers only the sessions with a seat left, labelled like the old page, and the old job list', () => {
    renderPage(fakeApi())
    const options = [...(screen.getByLabelText('Qual encontro') as HTMLSelectElement).options].map((option) => option.textContent)
    expect(options).toEqual(['Selecione…', '20/10/2026 19:30 — Presencial: Encontro 1 (últimas 2 vagas)'])
    const jobs = [...(screen.getByLabelText('Seu cargo') as HTMLSelectElement).options].map((option) => option.textContent)
    expect(jobs).toEqual(['Selecione…', 'Sócio', 'Sócio Administrador', 'Administrador não Sócio', 'Diretor', 'Empresário', 'Gerente', 'Administrativo', 'Financeiro', 'Contador', 'Consultor', 'Outro'])
    expect(screen.getByText(/Concordo que a Auster use meus dados para organizar este evento e falar comigo sobre ele\. Guardamos por 24 meses; para sair ou pedir exclusão, escreva para contato@austercontabil\.com\.br\./)).toBeInTheDocument()
    expect(screen.getByLabelText('Seu nome')).toHaveAttribute('maxlength', '200')
  })

  it('lists every missing field with the old messages and says "Faltam campos acima."', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    renderPage(api)
    await user.type(screen.getByLabelText(/CNPJ da empresa/), '11222333000100')
    await user.click(screen.getByRole('button', { name: 'Confirmar inscrição' }))
    expect(screen.getByText('escolha o encontro')).toBeInTheDocument()
    expect(screen.getByText('informe o seu nome')).toBeInTheDocument()
    expect(screen.getByText('e-mail inválido')).toBeInTheDocument()
    expect(screen.getByText('telefone inválido')).toBeInTheDocument()
    expect(screen.getByText('CNPJ inválido')).toBeInTheDocument()
    expect(screen.getByText('é preciso concordar para se inscrever')).toBeInTheDocument()
    expect(screen.getByText('Faltam campos acima.')).toBeInTheDocument()
    expect(api.submit).not.toHaveBeenCalled()
  })

  it('masks the CNPJ on blur and fills the company only when it is empty', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    renderPage(api)
    expect(screen.getByText('digite o CNPJ e saia do campo: a razão social vem da Receita')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/CNPJ da empresa/), '11222333000181')
    await user.tab()
    expect(screen.getByLabelText(/CNPJ da empresa/)).toHaveValue('11.222.333/0001-81')
    expect(api.lookupCompany).toHaveBeenCalledWith({ cnpj: '11.222.333/0001-81' })
    expect(await screen.findByDisplayValue('PADARIA BOA MASSA LTDA')).toBeInTheDocument()
  })

  it('keeps what the person typed in the company field', async () => {
    const user = userEvent.setup()
    renderPage(fakeApi())
    await user.type(screen.getByLabelText('Empresa'), 'Boa Massa')
    await user.type(screen.getByLabelText(/CNPJ da empresa/), '11222333000181')
    await user.tab()
    await screen.findByText('digite o CNPJ e saia do campo: a razão social vem da Receita')
    expect(screen.getByLabelText('Empresa')).toHaveValue('Boa Massa')
  })

  it('says the lookup failed and never blocks', async () => {
    const user = userEvent.setup()
    renderPage(fakeApi({ lookupCompany: vi.fn(async () => ({ companyName: null })) }))
    await user.type(screen.getByLabelText(/CNPJ da empresa/), '11222333000181')
    await user.tab()
    expect(await screen.findByText('não consegui consultar o cadastro agora — escreva a empresa à mão.')).toBeInTheDocument()
  })

  it('sends the exact body and shows the receipt in place of the page', async () => {
    const user = userEvent.setup()
    const api = fakeApi()
    renderPage(api)
    await fillValid(user)
    await user.selectOptions(screen.getByLabelText('Seu cargo'), 'Contador')
    await user.click(screen.getByRole('button', { name: 'Confirmar inscrição' }))
    expect(api.submit).toHaveBeenCalledWith({
      evento: 'conexao-tributaria',
      sessaoId: 11,
      nome: 'Ana Souza',
      email: 'ana@boamassa.com.br',
      telefone: '34999990000',
      empresa: '',
      cnpj: '',
      cargo: 'Contador',
      aceite: true,
    })
    expect(await screen.findByRole('heading', { name: 'Inscrição confirmada' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Garanta a sua vaga' })).toBeNull()
    expect(document.querySelectorAll('#barra nav a')).toHaveLength(0)
  })

  it('shows the server refusal with the old prefix', async () => {
    const user = userEvent.setup()
    renderPage(fakeApi({ submit: vi.fn(async () => ({ ok: false as const, error: 'sessão sem vaga' })) }))
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Confirmar inscrição' }))
    expect(await screen.findByText('Não foi possível inscrever: sessão sem vaga')).toBeInTheDocument()
  })

  it('tells a network failure apart from anything else, and never shows the raw error', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage(fakeApi({ submit: vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))) }))
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Confirmar inscrição' }))
    expect(await screen.findByText('Não foi possível falar com o servidor. Confira a conexão e tente de novo.')).toBeInTheDocument()
    unmount()

    renderPage(fakeApi({ submit: vi.fn(async () => Promise.reject(new Error('[{"code":"too_big"}]'))) }))
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Confirmar inscrição' }))
    expect(await screen.findByText('Não foi possível inscrever: não foi possível inscrever')).toBeInTheDocument()
    expect(screen.queryByText(/too_big/)).toBeNull()
  })

  it('sends once on a double click and shows "Inscrevendo…" meanwhile', async () => {
    const user = userEvent.setup()
    let release: () => void = () => undefined
    const submit = vi.fn(() => new Promise<{ ok: true; receipt: RegistrationReceiptWire }>((resolve) => (release = () => resolve({ ok: true, receipt }))))
    renderPage(fakeApi({ submit }))
    await fillValid(user)
    const button = screen.getByRole('button', { name: 'Confirmar inscrição' })
    await act(async () => {
      button.click()
      button.click()
    })
    expect(submit).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Inscrevendo…' })).toBeDisabled()
    await act(async () => release())
    expect(await screen.findByRole('heading', { name: 'Inscrição confirmada' })).toBeInTheDocument()
  })
})
