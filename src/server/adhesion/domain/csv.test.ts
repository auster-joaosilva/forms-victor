import { describe, expect, it } from 'vitest'
import { toCsv } from '../../shared/domain/csv-format'
import { ADHESION_CSV_HEADER, adhesionCsvFileName, adhesionCsvRows, type CsvAdhesion } from './csv'

const row = (overrides: Partial<CsvAdhesion> = {}): CsvAdhesion => ({
  protocol: 'ADS-20261015-AB2C9',
  acceptedAt: new Date('2026-10-15T15:04:05.000Z'),
  status: 'filed',
  modalidade: 'hibrido',
  semManifestacao: 'cancelar',
  empresa: {
    nomeEmpresa: 'Empresa "A"; Filial', cnpj: '11.222.333/0001-81', representante: 'Maria Souza',
    cpf: '529.982.247-25', cargo: 'Sócio', email: 'maria@exemplo.com.br', telefone: '',
  },
  querProposta: true,
  responseId: 12,
  invitationToken: 'ABCDEFGHJK',
  termVersion: 'V5',
  termHash: '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004',
  originIp: '203.0.113.9',
  originSource: 'cf-connecting-ip',
  forwardedChain: '203.0.113.9, 172.70.1.1',
  userAgent: 'Mozilla/5.0',
  handledBy: 'regina',
  handledAt: new Date('2026-10-16T10:00:00.000Z'),
  internalNote: null,
  ...overrides,
})

describe('adhesions spreadsheet', () => {
  it('has the 24 columns of the old portal, in order', () => {
    expect(ADHESION_CSV_HEADER).toEqual(['protocolo', 'aceito em', 'situacao', 'modalidade',
      'sem manifestacao ate 20/11', 'empresa', 'CNPJ', 'representante', 'CPF',
      'cargo', 'e-mail', 'telefone', 'quer proposta', 'diagnostico vinculado',
      'convite', 'versao do termo', 'resumo do termo', 'origem do acesso',
      'origem apurada por', 'cadeia de proxies', 'navegador',
      'tratado por', 'tratado em', 'nota interna'])
  })

  it('writes one line per adhesion with the old values', () => {
    const [header = [], line = []] = adhesionCsvRows([row()])
    expect(header).toEqual([...ADHESION_CSV_HEADER])
    expect(line).toEqual([
      'ADS-20261015-AB2C9', '2026-10-15T15:04:05.000Z', 'protocolada', 'Simples Nacional Híbrido (CBS fora do DAS)',
      'autoriza cancelar, voltando ao Padrão', 'Empresa "A"; Filial', '11.222.333/0001-81', 'Maria Souza', '529.982.247-25',
      'Sócio', 'maria@exemplo.com.br', '', 'sim', 'resposta 12',
      'ABCDEFGHJK', 'V5', '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004', '203.0.113.9',
      'cf-connecting-ip', '203.0.113.9, 172.70.1.1', 'Mozilla/5.0',
      'regina', '2026-10-16T10:00:00.000Z', '',
    ])
  })

  it('leaves optional columns empty', () => {
    const [, line = []] = adhesionCsvRows([row({
      modalidade: 'padrao', semManifestacao: null, querProposta: false, responseId: null, invitationToken: null,
      originIp: null, originSource: null, forwardedChain: null, userAgent: null, handledBy: null, handledAt: null, status: 'received',
    })])
    expect(line[2]).toBe('recebida')
    expect(line[3]).toBe('Simples Nacional Puro (Padrão)')
    expect(line[4]).toBe('')
    expect(line[12]).toBe('nao')
    expect(line.slice(13, 15)).toEqual(['', ''])
    expect(line.slice(17, 23)).toEqual(['', '', '', '', '', ''])
  })

  it('neutralises formulas typed by the client and quotes separators', () => {
    const csv = toCsv(adhesionCsvRows([row({
      empresa: { ...row().empresa, nomeEmpresa: '=HYPERLINK("http://x","clique")', representante: '+55 34 9999' },
    })]))
    expect(csv.startsWith('\uFEFFprotocolo;aceito em;')).toBe(true)
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""clique"")"`)
    expect(csv).toContain(`;'+55 34 9999;`)
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('names the file with the Brasília date', () => {
    expect(adhesionCsvFileName(new Date('2026-10-31T02:30:00Z'))).toBe('adesoes-simples-2026-10-30.csv')
  })
})
