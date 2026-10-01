import { formatBrasiliaDateTime } from '../../shared/domain/dates'
import type { AdhesionReceipt, AdhesionRecord } from './adhesion'
import { type Term, termFor } from './term'

export type TermCopy =
  | { ok: true; term: Term; adhesion: AdhesionReceipt }
  | { ok: false; reason: 'unknown_version' | 'not_found'; message: string }

export const UNKNOWN_VERSION_MESSAGE = (version: string): string =>
  `Esta adesão foi aceita na versão ${version} do termo, cujo texto não está mais no sistema. A via não pode ser tirada sem ele.`

export const NOT_FOUND_MESSAGE = 'Adesão não encontrada.'

export function toReceipt(record: AdhesionRecord): AdhesionReceipt {
  return {
    protocol: record.protocol,
    acceptedAt: record.acceptedAt.toISOString(),
    acceptedAtDisplay: formatBrasiliaDateTime(record.acceptedAt),
    modalidade: record.modalidade,
    empresa: record.empresa,
    semManifestacao: record.semManifestacao,
    querProposta: record.querProposta,
    termVersion: record.termVersion,
    termHash: record.termHash,
    originIp: record.originIp,
  }
}

// A via sai com o texto da versão aceita; remontá-la com o texto corrente atribuiria ao cliente um texto que ele não viu.
export function termCopyOf(record: AdhesionRecord | null): TermCopy {
  if (!record) return { ok: false, reason: 'not_found', message: NOT_FOUND_MESSAGE }
  const term = termFor(record.termVersion)
  if (!term) return { ok: false, reason: 'unknown_version', message: UNKNOWN_VERSION_MESSAGE(record.termVersion) }
  return { ok: true, term, adhesion: toReceipt(record) }
}
