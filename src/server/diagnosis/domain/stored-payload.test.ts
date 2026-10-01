import { describe, expect, it } from 'vitest'
import { answerBlocks, readStoredPayload, responseProjections } from './stored-payload'

const legacyPacote = {
  protocolo: 'DS-260915-ABCD',
  versaoFormulario: 'sintetico',
  diagnostico: { saida: 'B', posicao: 'Simples híbrido', certeza: 'aberta', urgencia: 'ALTA', confianca: 'MÉDIA', lacunas: ['margemLiquida'], gatilhos: ['g1'], pontosEmAberto: ['p1'] },
  respostas: { nomeEmpresa: 'Empresa Antiga', cnpj: '11.222.333/0001-81', regimeAtual: 'simples', aceiteLgpd: 'sim', campoRemovido: 'x' },
  solicitanteNoQsa: false,
}

describe('stored payload', () => {
  it('reads the legacy pacote and the new payload the same way', () => {
    const legacy = readStoredPayload(legacyPacote)
    expect(legacy.answers.nomeEmpresa).toBe('Empresa Antiga')
    expect(legacy.engine).toEqual({ outcome: 'B', position: 'Simples híbrido', certainty: 'aberta', urgency: 'ALTA', confidence: 'MÉDIA', gaps: ['margemLiquida'], triggers: ['g1'], openPoints: ['p1'] })
    expect(legacy.requesterInQsa).toBe(false)
    expect(legacy.formVersion).toBe('sintetico')
    expect(readStoredPayload(legacy)).toEqual(legacy)
    expect(readStoredPayload(null).answers).toEqual({})
  })

  it('projects the columns used for search and listing', () => {
    expect(responseProjections(readStoredPayload(legacyPacote))).toMatchObject({
      companyName: 'Empresa Antiga', cnpj: '11.222.333/0001-81', cnpjDigits: '11222333000181', outcome: 'B', requesterInQsa: false, formVersion: 'sintetico',
    })
  })

  it('groups answers by block with labels and keeps keys the form no longer has', () => {
    const blocks = answerBlocks(legacyPacote.respostas)
    expect(blocks.total).toBe(4)
    expect(blocks.blocks[0]?.rows.find((row) => row.key === 'regimeAtual')?.value).toEqual({ kind: 'text', text: 'Simples Nacional' })
    expect(blocks.blocks.flatMap((block) => block.rows).some((row) => row.key === 'aceiteLgpd')).toBe(false)
    expect(blocks.outsideForm).toEqual([{ key: 'campoRemovido', value: { kind: 'text', text: 'x' } }])
  })
})
