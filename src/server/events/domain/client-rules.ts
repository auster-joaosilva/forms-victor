import { isValidCnpj, isValidEmail, isValidName, isValidPhone, maskCnpj } from '../../shared/domain/validation'

export { maskCnpj }

// Lista fechada, como a da adesão, com "Contador" e "Outro": quem vai à palestra nem sempre é sócio.
export const JOB_TITLE_OPTIONS: readonly string[] = ['Sócio', 'Sócio Administrador', 'Administrador não Sócio', 'Diretor',
  'Empresário', 'Gerente', 'Administrativo', 'Financeiro', 'Contador', 'Consultor', 'Outro']

export type RegistrationField = 'sessao' | 'nome' | 'email' | 'telefone' | 'cnpj' | 'aceite'

// Ordem dos campos na página: a rolagem vai até o primeiro desta lista que tiver erro.
export const REGISTRATION_FIELD_ORDER: readonly RegistrationField[] = ['sessao', 'nome', 'email', 'telefone', 'cnpj', 'aceite']

export interface RegistrationFormState {
  sessaoId: number | null
  nome: string
  email: string
  telefone: string
  cnpj: string
  aceite: boolean
}

// A tela é mais exigente que o servidor (telefone obrigatório, dígito do CNPJ), como na main.
export function registrationClientErrors(state: RegistrationFormState): Partial<Record<RegistrationField, string>> {
  const errors: Partial<Record<RegistrationField, string>> = {}
  if (!state.sessaoId) errors.sessao = 'escolha o encontro'
  if (!isValidName(state.nome, 3)) errors.nome = 'informe o seu nome'
  if (!isValidEmail(state.email)) errors.email = 'e-mail inválido'
  if (!isValidPhone(state.telefone)) errors.telefone = 'telefone inválido'
  if (state.cnpj.trim() && !isValidCnpj(state.cnpj)) errors.cnpj = 'CNPJ inválido'
  if (!state.aceite) errors.aceite = 'é preciso concordar para se inscrever'
  return errors
}
