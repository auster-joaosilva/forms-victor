import { describe, expect, it } from 'vitest'
import type { EventView } from './event'
import { checkRegistration, cnpjDigitsOf } from './registration'

const event = (overrides: Partial<EventView> = {}): EventView => ({
  id: 3, slug: 'conexao-tributaria', title: 'Conexão Tributária', status: 'published', registrations: 'open', content: {},
  sessions: [{ id: 7, order: 0, date: '2026-10-21', time: '19:30', format: 'in_person', title: 'Encontro 1', description: null,
    location: null, seats: 40, taken: 3 }],
  ...overrides,
})

const body = (overrides: Record<string, unknown> = {}) => ({
  evento: 'conexao-tributaria', sessaoId: 7, nome: 'Maria Souza', email: 'maria@exemplo.com.br', telefone: '(34) 99999-0000',
  empresa: 'Padaria Exemplo', cnpj: '11.222.333/0001-81', cargo: 'Sócio', aceite: true, ...overrides,
})

const refusal = (error: string) => ({ ok: false, status: 422, error })

describe('checkRegistration (conferirInscricao da main, na mesma ordem)', () => {
  it('aceita e normaliza', () => {
    expect(checkRegistration(body(), event())).toEqual({
      ok: true,
      value: {
        eventId: 3, sessionId: 7, name: 'Maria Souza', email: 'maria@exemplo.com.br', phone: '(34) 99999-0000',
        company: 'Padaria Exemplo', cnpj: '11.222.333/0001-81', cnpjDigits: '11222333000181', jobTitle: 'Sócio',
      },
    })
  })

  it('1. corpo que não é objeto', () => {
    expect(checkRegistration(null, event())).toEqual(refusal('corpo inválido'))
    expect(checkRegistration('x', event())).toEqual(refusal('corpo inválido'))
  })

  it('2. sem o aceite vem antes de procurar o evento', () => {
    expect(checkRegistration(body({ aceite: 'true' }), null)).toEqual(refusal('sem o aceite de privacidade'))
  })

  it('3. evento inexistente', () => {
    expect(checkRegistration(body(), null)).toEqual(refusal('evento não encontrado'))
  })

  it('4. evento não publicado (rascunho ou encerrado)', () => {
    expect(checkRegistration(body(), event({ status: 'draft' }))).toEqual(refusal('evento não está publicado'))
    expect(checkRegistration(body(), event({ status: 'closed' }))).toEqual(refusal('evento não está publicado'))
  })

  it('5. inscrições encerradas', () => {
    expect(checkRegistration(body(), event({ registrations: 'closed' }))).toEqual(refusal('as inscrições estão encerradas'))
  })

  it('6. sessão de outro evento ou ausente', () => {
    expect(checkRegistration(body({ sessaoId: 99 }), event())).toEqual(refusal('escolha um dos encontros'))
    expect(checkRegistration(body({ sessaoId: undefined }), event())).toEqual(refusal('escolha um dos encontros'))
  })

  it('aceita sessaoId em texto, como o Number() da main', () => {
    expect(checkRegistration(body({ sessaoId: '7' }), event())).toMatchObject({ ok: true, value: { sessionId: 7 } })
  })

  it('7. falta nome, depois falta e-mail', () => {
    expect(checkRegistration(body({ nome: '  ', email: '' }), event())).toEqual(refusal('falta o seu nome'))
    expect(checkRegistration(body({ email: '   ' }), event())).toEqual(refusal('falta o e-mail'))
  })

  it('8. e-mail fora do formato', () => {
    expect(checkRegistration(body({ email: 'maria@exemplo' }), event())).toEqual(refusal('e-mail inválido'))
  })

  it('9. CNPJ incompleto quando informado; sem dígito verificador, como a main', () => {
    expect(checkRegistration(body({ cnpj: '11.222.333/0001' }), event())).toEqual(refusal('CNPJ incompleto'))
    expect(checkRegistration(body({ cnpj: '11.222.333/0001-00' }), event())).toMatchObject({ ok: true })
    expect(checkRegistration(body({ cnpj: '' }), event())).toMatchObject({ ok: true, value: { cnpj: null, cnpjDigits: null } })
  })

  it('telefone é opcional no servidor, como a main', () => {
    expect(checkRegistration(body({ telefone: '' }), event())).toMatchObject({ ok: true, value: { phone: null } })
  })

  it('corta os campos nos limites da main', () => {
    const result = checkRegistration(body({
      nome: 'n'.repeat(200), email: `${'e'.repeat(200)}@x.com`, telefone: '9'.repeat(60), empresa: 'c'.repeat(300), cargo: 'k'.repeat(90),
    }), event())
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) return
    expect(result.value.name).toHaveLength(120)
    expect(result.value.email).toHaveLength(160)
    expect(result.value.phone).toHaveLength(40)
    expect(result.value.company).toHaveLength(160)
    expect(result.value.jobTitle).toHaveLength(60)
  })

  it('campos não texto não quebram a conferência', () => {
    expect(checkRegistration(body({ nome: { a: 1 }, email: ['x'] }), event())).toMatchObject({ ok: false })
  })

  it('cnpjDigitsOf mantém letras e caixa alta, como o soDigitos da main', () => {
    expect(cnpjDigitsOf('12.abc.345/01de-35')).toBe('12ABC34501DE35')
  })
})
