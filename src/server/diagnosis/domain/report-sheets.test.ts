import { describe, expect, it } from 'vitest'
import { reportFileName } from './report-sheets'

describe('report file name', () => {
  it('follows the legacy pattern', () => {
    expect(reportFileName('Padaria São João & Filhos Ltda.')).toBe('Plano-De-Acao-SN-Padaria-Sao-Joao-Filhos-Ltda')
    expect(reportFileName('')).toBe('Plano-De-Acao-SN-Empresa')
    expect(reportFileName('***')).toBe('Plano-De-Acao-SN-Empresa')
  })
})
