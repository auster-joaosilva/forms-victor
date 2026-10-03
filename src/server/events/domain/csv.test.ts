import { describe, expect, it } from 'vitest'
import { toCsv } from '../../shared/domain/csv-format'
import { REGISTRATION_CSV_HEADER, registrationCsvFileName, registrationCsvRows, type CsvRegistration } from './csv'

const row = (overrides: Partial<CsvRegistration> = {}): CsvRegistration => ({
  protocol: 'INS-20261021-AB2C9', createdAt: new Date('2026-10-10T13:05:00Z'), status: 'registered',
  eventTitle: 'Conexão Tributária', sessionTitle: 'Encontro 1', sessionDate: '2026-10-21', sessionTime: '19:30', sessionFormat: 'in_person',
  name: 'Maria Souza', email: 'maria@exemplo.com.br', phone: '(34) 99999-0000', company: 'Padaria Exemplo',
  cnpj: '11.222.333/0001-81', jobTitle: 'Sócio', responseId: 12, originIp: '203.0.113.9', handledBy: 'victor', internalNote: null,
  ...overrides,
})

describe('planilha de inscritos (planilhaDeInscricoes da main)', () => {
  it('tem as 18 colunas da main, na ordem', () => {
    expect(REGISTRATION_CSV_HEADER).toEqual(['protocolo', 'inscrito em (Brasilia)', 'situacao', 'evento', 'encontro',
      'data do encontro', 'hora', 'formato', 'nome', 'e-mail', 'telefone', 'empresa', 'CNPJ',
      'cargo', 'diagnostico vinculado', 'origem do acesso', 'tratado por', 'nota interna'])
  })

  it('preenche cada coluna com o valor da main', () => {
    const [header, line] = registrationCsvRows([row()])
    expect(header).toEqual([...REGISTRATION_CSV_HEADER])
    expect(line).toEqual(['INS-20261021-AB2C9', '10/10/2026, 10:05:00', 'inscrita', 'Conexão Tributária', 'Encontro 1',
      '2026-10-21', '19:30', 'presencial', 'Maria Souza', 'maria@exemplo.com.br', '(34) 99999-0000', 'Padaria Exemplo',
      '11.222.333/0001-81', 'Sócio', 'resposta 12', '203.0.113.9', 'victor', ''])
  })

  it('campos opcionais ausentes viram vazio', () => {
    const line = registrationCsvRows([row({ phone: null, company: null, cnpj: null, jobTitle: null, responseId: null,
      originIp: null, handledBy: null, status: 'cancelled', sessionFormat: 'online' })])[1] ?? []
    expect(line[2]).toBe('cancelada')
    expect(line[7]).toBe('online')
    expect([line[10], line[11], line[12], line[13], line[14], line[15], line[16]]).toEqual(['', '', '', '', '', '', ''])
  })

  it('neutraliza fórmula digitada pelo visitante', () => {
    const csv = toCsv(registrationCsvRows([row({ name: '=HYPERLINK("http://x","clique")' })]))
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""clique"")"`)
    expect(csv.startsWith('﻿')).toBe(true)
  })

  it('nome do arquivo com a data de Brasília', () => {
    expect(registrationCsvFileName(new Date('2026-10-22T02:30:00Z'))).toBe('inscritos-2026-10-21.csv')
  })
})
