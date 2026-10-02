import { describe, expect, it } from 'vitest'
import { LEGACY_STATUS, MODALITY_LONG, MODALITY_SHORT, STATUS_LABELS, WITHOUT_MANIFESTATION_CSV, WITHOUT_MANIFESTATION_SHORT, termFileName } from './labels'

describe('adhesion labels', () => {
  it('uses the old portal texts', () => {
    expect(STATUS_LABELS).toEqual({ received: 'Recebida', filed: 'Protocolada', cancelled: 'Cancelada' })
    expect(LEGACY_STATUS).toEqual({ received: 'recebida', filed: 'protocolada', cancelled: 'cancelada' })
    expect(MODALITY_SHORT).toEqual({ padrao: 'Simples Padrão', hibrido: 'Simples Híbrido' })
    expect(MODALITY_LONG).toEqual({
      padrao: 'Simples Nacional Puro (Padrão)', hibrido: 'Simples Nacional Híbrido (CBS fora do DAS)',
    })
    expect(WITHOUT_MANIFESTATION_SHORT).toEqual({ cancelar: 'cancela em 20/11', manter: 'mantém em 20/11' })
    expect(WITHOUT_MANIFESTATION_CSV).toEqual({ cancelar: 'autoriza cancelar, voltando ao Padrão', manter: 'mantém o Híbrido' })
  })

  it('names the PDF like the old baixarTermo', () => {
    expect(termFileName('Padaria São João Ltda.')).toBe('Termo-Opcao-SN-PADARIA-SAO-JOAO-LTDA')
    expect(termFileName('  --Ação & Cia--  ')).toBe('Termo-Opcao-SN-ACAO-CIA')
    expect(termFileName('')).toBe('Termo-Opcao-SN-EMPRESA')
    expect(termFileName('A'.repeat(80))).toBe(`Termo-Opcao-SN-${'A'.repeat(60)}`)
  })
})
