import { describe, expect, it } from 'vitest'
import { JOB_TITLE_OPTIONS, REGISTRATION_FIELD_ORDER, registrationClientErrors, type RegistrationFormState } from './client-rules'

const state = (overrides: Partial<RegistrationFormState> = {}): RegistrationFormState => ({
  sessaoId: 7, nome: 'Maria Souza', email: 'maria@exemplo.com.br', telefone: '(34) 99999-0000', cnpj: '', aceite: true, ...overrides,
})

describe('registrationClientErrors (conferir() da main)', () => {
  it('formulário completo não tem erro', () => {
    expect(registrationClientErrors(state())).toEqual({})
  })

  it('usa as mensagens literais da main', () => {
    expect(registrationClientErrors(state({ sessaoId: null, nome: 'Ma', email: 'x', telefone: '123', cnpj: '11.222.333/0001-00', aceite: false })))
      .toEqual({
        sessao: 'escolha o encontro',
        nome: 'informe o seu nome',
        email: 'e-mail inválido',
        telefone: 'telefone inválido',
        cnpj: 'CNPJ inválido',
        aceite: 'é preciso concordar para se inscrever',
      })
  })

  it('CNPJ vazio é opcional; preenchido precisa do dígito certo', () => {
    expect(registrationClientErrors(state({ cnpj: '   ' }))).toEqual({})
    expect(registrationClientErrors(state({ cnpj: '11.222.333/0001-81' }))).toEqual({})
  })

  it('telefone é obrigatório na tela, como a main', () => {
    expect(registrationClientErrors(state({ telefone: '' }))).toEqual({ telefone: 'telefone inválido' })
  })

  it('ordem de rolagem e cargos da main', () => {
    expect(REGISTRATION_FIELD_ORDER).toEqual(['sessao', 'nome', 'email', 'telefone', 'cnpj', 'aceite'])
    expect(JOB_TITLE_OPTIONS).toEqual(['Sócio', 'Sócio Administrador', 'Administrador não Sócio', 'Diretor',
      'Empresário', 'Gerente', 'Administrativo', 'Financeiro', 'Contador', 'Consultor', 'Outro'])
  })
})
