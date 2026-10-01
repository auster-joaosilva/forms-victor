import { isoDateToBr } from '../../shared/domain/dates'
import type { AdhesionCompany, NormalizedSubmission, WithoutManifestationChoice } from './adhesion'
import { WITHOUT_MANIFESTATION_CHOICES, isModality } from './adhesion'
import type { AdhesionWindow } from './window'

export type SubmissionCheck = { ok: true; value: NormalizedSubmission } | { ok: false; error: string }

export const cnpjDigitsOf = (cnpj: string): string => String(cnpj || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase()

const REQUIRED: [keyof AdhesionCompany, string][] = [
  ['nomeEmpresa', 'razão social'], ['cnpj', 'CNPJ'], ['representante', 'nome do representante'],
  ['cpf', 'CPF'], ['cargo', 'cargo'], ['email', 'e-mail'],
]

const text = (value: unknown): string => String(value || '').trim()
const refuse = (error: string): SubmissionCheck => ({ ok: false, error })

// Mesma ordem e mesmas mensagens de `conferirAdesao` da origin/main. O servidor confere menos que a tela, de propósito (A3).
export function checkSubmission(body: unknown, ctx: { window: AdhesionWindow; currentVersion: string }): SubmissionCheck {
  if (!body || typeof body !== 'object') return refuse('corpo inválido')
  // A página pode estar aberta desde antes do prazo: a porta fecha aqui, não só na tela.
  if (ctx.window.state === 'closed') {
    return refuse(`a janela de opção encerrou em ${isoDateToBr(ctx.window.end)}; fale com a equipe da Auster`)
  }
  const input = body as Record<string, unknown>
  if (input.declara !== true) return refuse('sem a declaração final marcada')
  const modalidade = input.modalidade
  if (!isModality(modalidade)) return refuse('modalidade inválida')
  const choice = input.semManifestacao
  if (modalidade === 'hibrido' && !WITHOUT_MANIFESTATION_CHOICES.includes(choice as WithoutManifestationChoice)) {
    return refuse('falta escolher o que acontece sem manifestação até 10/12')
  }
  // Versão diferente é página aberta antes de o texto mudar: gravar seria adesão a um texto que a pessoa não viu.
  if (input.versaoTermo !== ctx.currentVersion) return refuse('o termo foi atualizado; recarregue a página e confirme de novo')
  const company = (input.empresa && typeof input.empresa === 'object' ? input.empresa : {}) as Record<string, unknown>
  for (const [field, label] of REQUIRED) {
    if (!text(company[field])) return refuse(`falta ${label}`)
  }
  if (cnpjDigitsOf(String(company.cnpj)).length !== 14) return refuse('CNPJ incompleto')
  if (String(company.cpf).replace(/\D/g, '').length !== 11) return refuse('CPF incompleto')

  const vinculo = typeof input.vinculo === 'string' && input.vinculo.trim() ? input.vinculo.trim() : null
  return {
    ok: true,
    value: {
      empresa: {
        nomeEmpresa: text(company.nomeEmpresa),
        cnpj: text(company.cnpj),
        representante: text(company.representante),
        cpf: text(company.cpf),
        cargo: text(company.cargo),
        email: text(company.email),
        telefone: text(company.telefone),
      },
      modalidade,
      semManifestacao: modalidade === 'hibrido' ? (choice as WithoutManifestationChoice) : null,
      querProposta: input.querProposta === true,
      vinculo,
    },
  }
}
