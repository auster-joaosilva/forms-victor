import { brasiliaDateParts } from '../../shared/domain/dates'
import type { AdhesionCompany, AdhesionStatus, Modality, WithoutManifestationChoice } from './adhesion'
import { LEGACY_STATUS, MODALITY_LONG, WITHOUT_MANIFESTATION_CSV } from './labels'

export interface CsvAdhesion {
  protocol: string
  acceptedAt: Date
  status: AdhesionStatus
  modalidade: Modality
  semManifestacao: WithoutManifestationChoice | null
  empresa: AdhesionCompany
  querProposta: boolean
  responseId: number | null
  invitationToken: string | null
  termVersion: string
  termHash: string
  originIp: string | null
  originSource: string | null
  forwardedChain: string | null
  userAgent: string | null
  handledBy: string | null
  handledAt: Date | null
  internalNote: string | null
}

// Cabeçalhos de `planilhaDeAdesoes` da origin/main, inclusive o "ate 20/11" (spec, seção 9).
export const ADHESION_CSV_HEADER: readonly string[] = ['protocolo', 'aceito em', 'situacao', 'modalidade',
  'sem manifestacao ate 20/11', 'empresa', 'CNPJ', 'representante', 'CPF',
  'cargo', 'e-mail', 'telefone', 'quer proposta', 'diagnostico vinculado',
  'convite', 'versao do termo', 'resumo do termo', 'origem do acesso',
  'origem apurada por', 'cadeia de proxies', 'navegador',
  'tratado por', 'tratado em', 'nota interna']

export function adhesionCsvRows(rows: CsvAdhesion[]): string[][] {
  const body = rows.map((row) => [
    row.protocol,
    // ISO UTC, como no antigo: é registro de prova, não leitura de calendário.
    row.acceptedAt.toISOString(),
    LEGACY_STATUS[row.status],
    MODALITY_LONG[row.modalidade],
    row.semManifestacao ? WITHOUT_MANIFESTATION_CSV[row.semManifestacao] : '',
    row.empresa.nomeEmpresa,
    row.empresa.cnpj,
    row.empresa.representante,
    row.empresa.cpf,
    row.empresa.cargo,
    row.empresa.email,
    row.empresa.telefone,
    row.querProposta ? 'sim' : 'nao',
    row.responseId ? `resposta ${row.responseId}` : '',
    row.invitationToken ?? '',
    row.termVersion,
    row.termHash,
    row.originIp ?? '',
    row.originSource ?? '',
    row.forwardedChain ?? '',
    row.userAgent ?? '',
    row.handledBy ?? '',
    row.handledAt ? row.handledAt.toISOString() : '',
    row.internalNote ?? '',
  ])
  return [[...ADHESION_CSV_HEADER], ...body]
}

export function adhesionCsvFileName(today: Date): string {
  const { year, month, day } = brasiliaDateParts(today)
  return `adesoes-simples-${year}-${month}-${day}.csv`
}
