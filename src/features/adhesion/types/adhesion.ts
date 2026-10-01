import type {
  AdhesionCompany,
  AdhesionReceipt,
  Modality,
  WithoutManifestationChoice,
} from '@/server/adhesion/domain/adhesion'
import type { AdhesionWindow } from '@/server/adhesion/domain/window'

type Pair = readonly [string, string]

/** A forma comum de TERM_V4 e TERM_V5: os dois objetos `as const` cabem nela. */
export interface TermText {
  versao: string
  titulo: string
  subtitulo: string
  orientacao: string
  prazos: { titulo: string; fonte: string; itens: readonly Pair[] }
  criterios: readonly Pair[]
  servicos: { abertura: string; itens: readonly Pair[]; pergunta: string }
  modalidades: readonly { valor: string; titulo: string; texto: string; partes: readonly Pair[] }[]
  semManifestacao: { enunciado: string; opcoes: readonly Pair[] }
  ciencia: readonly string[]
  declaracao: string
  rodape: string
}

export type AdhesionPrefill = Partial<Pick<AdhesionCompany, 'nomeEmpresa' | 'cnpj' | 'email'>>

export interface AdhesionBootstrap {
  window: AdhesionWindow
  prefill: AdhesionPrefill
  invitationToken: string | null
  receipt: AdhesionReceipt | null
}

export interface AdhesionSubmitInput {
  vinculo: string | null
  versaoTermo: string
  empresa: AdhesionCompany
  modalidade: Modality
  semManifestacao: WithoutManifestationChoice | null
  querProposta: boolean
  declara: boolean
}

export type SubmitAdhesionWire = { ok: true; receipt: AdhesionReceipt } | { ok: false; error: string }

export interface AdhesionApi {
  lookupCompany(input: { cnpj: string }): Promise<{ companyName: string | null }>
  submit(input: AdhesionSubmitInput): Promise<SubmitAdhesionWire>
  startNew(): Promise<void>
}
