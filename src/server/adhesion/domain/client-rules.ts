import { isValidCnpj, isValidEmail, isValidName, isValidPhone, maskCnpj } from '../../shared/domain/validation'
import type { AdhesionCompany, Modality, WithoutManifestationChoice } from './adhesion'

export { isValidCnpj, isValidEmail, isValidName, isValidPhone, maskCnpj }

// Lista fechada: é campo de documento, e "sócio", "Sócio-adm" e "SÓCIO ADM" digitados viram três cargos na planilha.
export const ROLE_OPTIONS: readonly string[] = ['Sócio', 'Sócio Administrador', 'Administrador não Sócio', 'Diretor',
  'Empresário', 'Gerente', 'Administrativo', 'Financeiro', 'Consultor']

export function isValidCpf(raw: string): boolean {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false
  const checkDigit = (upTo: number) => {
    let sum = 0
    for (let i = 0; i < upTo; i++) sum += Number(digits[i]) * (upTo + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10])
}

export function maskCpf(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

export type ClientField =
  | 'nomeEmpresa' | 'cnpj' | 'representante' | 'cpf' | 'cargo' | 'email' | 'telefone' | 'modalidade' | 'semManifestacao' | 'declara'

// Ordem dos campos na página (CAMPOS_DE_ERRO): a rolagem vai até o primeiro desta lista que tiver erro.
export const CLIENT_FIELD_ORDER: readonly ClientField[] = ['cnpj', 'nomeEmpresa', 'representante', 'cargo', 'cpf', 'email',
  'telefone', 'modalidade', 'semManifestacao', 'declara']

export function clientErrors(state: {
  empresa: AdhesionCompany
  modalidade: Modality | null
  semManifestacao: WithoutManifestationChoice | null
  declara: boolean
}): Partial<Record<ClientField, string>> {
  const { empresa } = state
  const errors: Partial<Record<ClientField, string>> = {}
  if (!isValidName(empresa.nomeEmpresa, 3)) errors.nomeEmpresa = 'informe a razão social'
  if (!isValidCnpj(empresa.cnpj)) errors.cnpj = 'CNPJ incompleto ou inválido'
  if (!isValidName(empresa.representante, 3)) errors.representante = 'informe o nome de quem confirma'
  if (!isValidCpf(empresa.cpf)) errors.cpf = 'CPF incompleto ou inválido'
  if (!empresa.cargo.trim()) errors.cargo = 'informe o cargo'
  if (!isValidEmail(empresa.email)) errors.email = 'e-mail inválido'
  if (!isValidPhone(empresa.telefone)) errors.telefone = 'telefone inválido'
  if (!state.modalidade) errors.modalidade = 'escolha uma das duas modalidades'
  if (state.modalidade === 'hibrido' && !state.semManifestacao) {
    errors.semManifestacao = 'escolha o que acontece se não houver manifestação até 20/11'
  }
  if (!state.declara) errors.declara = 'é preciso marcar a declaração para confirmar'
  return errors
}
