import { describe, expect, it } from 'vitest'
import { csvFileName, csvRows, toCsv } from './csv'
import { readStoredPayload } from './stored-payload'

const matrixHeader = (row: string) => `3. Quanto do seu faturamento vai para cada tipo de cliente? — ${row}`

describe('responses spreadsheet', () => {
  const payload = readStoredPayload({
    answers: {
      nomeEmpresa: 'Empresa "A"; Filial', cnpj: '11.222.333/0001-81', regimeAtual: 'simples', aceiteLgpd: 'sim',
      receitaPorCliente: { pessoa_fisica: 'acima_80', simples_mei: 'nao_sei' },
    },
    engine: { outcome: 'B', position: 'Simples híbrido', certainty: 'aberta', urgency: 'ALTA', confidence: 'MÉDIA', gaps: ['a', 'b'], triggers: ['t'], openPoints: [] },
    requesterInQsa: false,
    formVersion: 'completo',
  })
  const rows = csvRows([{
    protocol: 'DS-260915-AB12', receivedAt: new Date('2026-09-15T13:00:00Z'), status: 'in_review', handledBy: 'maria',
    handledAt: null, invitationToken: 'ABCDEFGHJK', payload,
  }])
  const [header = [], line = []] = rows
  const at = (column: string) => line[header.indexOf(column)]

  it('has the legacy fixed columns, then one per question and one per matrix row', () => {
    expect(header.slice(0, 3)).toEqual(['protocolo', 'recebido em', 'situacao'])
    expect(header).toHaveLength(line.length)
    expect(at('situacao')).toBe('Em análise')
    expect(at('origem')).toBe('convite ABCDEFGHJK')
    expect(at('campos em nao sei')).toBe('a | b')
    expect(at('quem respondeu no QSA')).toBe('nao')
    expect(at('1. Regime tributário atual')).toBe('Simples Nacional')
    expect(at(matrixHeader('Pessoa física / consumidor final'))).toBe('acima de 80%')
    expect(at(matrixHeader('MEI ou empresa do Simples'))).toBe('não sei')
  })

  it('names the consent column by its prompt and writes the raw answer', () => {
    expect(header).toContain('1. Uso das suas informações')
    expect(at('1. Uso das suas informações')).toBe('sim')
  })

  it('writes BOM, semicolons, CRLF and quotes what needs quoting', () => {
    const csv = toCsv(rows)
    expect(csv.startsWith('﻿protocolo;recebido em;situacao;')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.split('\r\n')).toHaveLength(3)
    expect(csv).toContain(';"Empresa ""A""; Filial";')
  })

  it('names the file by the Brasília date', () => {
    expect(csvFileName(new Date('2026-10-01T02:00:00Z'))).toBe('respostas-simples-2026-09-30.csv')
  })
})
