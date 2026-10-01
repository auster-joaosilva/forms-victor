// `padrao`/`hibrido` e `cancelar`/`manter` são valor de domínio: vêm da tela e do termo e vão para o payload.
export type Modality = 'padrao' | 'hibrido'
export type WithoutManifestationChoice = 'cancelar' | 'manter'

export const MODALITIES: readonly Modality[] = ['padrao', 'hibrido']
export const WITHOUT_MANIFESTATION_CHOICES: readonly WithoutManifestationChoice[] = ['cancelar', 'manter']
export const ADHESION_STATUSES = ['received', 'filed', 'cancelled'] as const
export type AdhesionStatus = (typeof ADHESION_STATUSES)[number]

export const isModality = (value: unknown): value is Modality => MODALITIES.includes(value as Modality)
export const isAdhesionStatus = (value: unknown): value is AdhesionStatus => ADHESION_STATUSES.includes(value as AdhesionStatus)

export const MODALITY_TO_DB: Record<Modality, 'standard' | 'hybrid'> = { padrao: 'standard', hibrido: 'hybrid' }
export const MODALITY_FROM_DB: Record<'standard' | 'hybrid', Modality> = { standard: 'padrao', hybrid: 'hibrido' }
export const WITHOUT_MANIFESTATION_TO_DB: Record<WithoutManifestationChoice, 'cancel' | 'keep'> = { cancelar: 'cancel', manter: 'keep' }
export const WITHOUT_MANIFESTATION_FROM_DB: Record<'cancel' | 'keep', WithoutManifestationChoice> = { cancel: 'cancelar', keep: 'manter' }

export interface AdhesionCompany {
  nomeEmpresa: string
  cnpj: string
  representante: string
  cpf: string
  cargo: string
  email: string
  telefone: string
}

export interface AdhesionSubmissionBody {
  vinculo: string | null
  versaoTermo: string
  empresa: AdhesionCompany
  modalidade: string
  semManifestacao: string | null
  querProposta: boolean
  declara: boolean
}

export interface NormalizedSubmission {
  empresa: AdhesionCompany
  modalidade: Modality
  semManifestacao: WithoutManifestationChoice | null
  querProposta: boolean
  vinculo: string | null
}

export interface AdhesionRecord {
  id: number
  protocol: string
  acceptedAt: Date
  empresa: AdhesionCompany
  modalidade: Modality
  semManifestacao: WithoutManifestationChoice | null
  querProposta: boolean
  termVersion: string
  termHash: string
  originIp: string | null
}

export interface AdhesionReceipt {
  protocol: string
  acceptedAt: string
  acceptedAtDisplay: string
  modalidade: Modality
  empresa: AdhesionCompany
  semManifestacao: WithoutManifestationChoice | null
  querProposta: boolean
  termVersion: string
  termHash: string
  originIp: string | null
}
