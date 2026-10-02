import type { AdhesionStatus, Modality, WithoutManifestationChoice } from './adhesion'

export const STATUS_LABELS: Record<AdhesionStatus, string> = { received: 'Recebida', filed: 'Protocolada', cancelled: 'Cancelada' }

// O valor que a planilha antiga trazia na coluna `situacao`; a equipe filtra por ele.
export const LEGACY_STATUS: Record<AdhesionStatus, string> = { received: 'recebida', filed: 'protocolada', cancelled: 'cancelada' }

export const MODALITY_SHORT: Record<Modality, string> = { padrao: 'Simples Padrão', hibrido: 'Simples Híbrido' }

export const MODALITY_LONG: Record<Modality, string> = {
  padrao: 'Simples Nacional Puro (Padrão)',
  hibrido: 'Simples Nacional Híbrido (CBS fora do DAS)',
}

// "20/11" é sobra da V4 na main; fica fiel até o Victor decidir (spec, seção 9).
export const WITHOUT_MANIFESTATION_SHORT: Record<WithoutManifestationChoice, string> = {
  cancelar: 'cancela em 20/11',
  manter: 'mantém em 20/11',
}

export const WITHOUT_MANIFESTATION_CSV: Record<WithoutManifestationChoice, string> = {
  cancelar: 'autoriza cancelar, voltando ao Padrão',
  manter: 'mantém o Híbrido',
}

// O navegador usa o título do documento como nome sugerido do PDF.
export function termFileName(companyName: string): string {
  const clean = String(companyName || 'Empresa')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `Termo-Opcao-SN-${clean || 'EMPRESA'}`
}
