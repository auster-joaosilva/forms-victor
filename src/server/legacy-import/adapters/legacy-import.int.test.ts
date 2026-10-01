import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import { legacyImporter } from '../composition'

const LEGACY_SCHEMA = `
CREATE TABLE convites (token TEXT PRIMARY KEY, nome_empresa TEXT, cnpj TEXT, email TEXT, observacao TEXT, criado_em TEXT NOT NULL, criado_por TEXT, aberturas INTEGER NOT NULL DEFAULT 0, aberto_em TEXT);
CREATE TABLE respostas (id INTEGER PRIMARY KEY AUTOINCREMENT, protocolo TEXT NOT NULL, token_convite TEXT, recebido_em TEXT NOT NULL, nome_empresa TEXT, cnpj TEXT, solicitante TEXT, email TEXT, telefone TEXT, versao TEXT, saida TEXT, posicao TEXT, certeza TEXT, urgencia TEXT, confianca TEXT, solicitante_no_qsa TEXT, pacote TEXT NOT NULL, situacao TEXT NOT NULL DEFAULT 'nova', nota_interna TEXT, tratado_por TEXT, tratado_em TEXT);
CREATE TABLE usuarios (usuario TEXT PRIMARY KEY, nome TEXT, papel TEXT NOT NULL DEFAULT 'equipe', sal TEXT NOT NULL, resumo TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL, criado_por TEXT, alterado_em TEXT, alterado_por TEXT, acesso_em TEXT);
CREATE TABLE adesoes (id INTEGER PRIMARY KEY AUTOINCREMENT, protocolo TEXT NOT NULL, resposta_id INTEGER, token_convite TEXT, aceito_em TEXT NOT NULL, nome_empresa TEXT, cnpj TEXT, representante TEXT, cpf TEXT, cargo TEXT, email TEXT, telefone TEXT, modalidade TEXT NOT NULL, sem_manifestacao TEXT, quer_proposta INTEGER NOT NULL DEFAULT 0, versao_termo TEXT NOT NULL, resumo_termo TEXT NOT NULL, origem TEXT, agente TEXT, pacote TEXT NOT NULL, situacao TEXT NOT NULL DEFAULT 'recebida', nota_interna TEXT, tratado_por TEXT, tratado_em TEXT);
CREATE TABLE eventos (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT NOT NULL, quem TEXT, o_que TEXT NOT NULL, referencia TEXT, detalhe TEXT);
`

const path = join(tmpdir(), `portal-${randomUUID()}.db`)

function buildLegacyDatabase() {
  const db = new DatabaseSync(path)
  db.exec(LEGACY_SCHEMA)
  const user = db.prepare('INSERT INTO usuarios (usuario, nome, papel, sal, resumo, ativo, criado_em, acesso_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  user.run('victor', 'Victor do SQLite', 'admin', 's', 'r', 1, '2026-08-01T12:00:00.000Z', null)
  user.run('maria', 'Maria', 'equipe', 's', 'r', 0, '2026-08-02T12:00:00.000Z', '2026-09-10T12:00:00.000Z')
  user.run('gestora', 'Gestora', 'gestor', 's', 'r', 1, '2026-08-03T12:00:00.000Z', null)
  user.run('regina', 'Regina', 'regularizacao', 's', 'r', 1, '2026-08-04T12:00:00.000Z', null)
  user.run('otavio', 'Otávio', 'operador', 's', 'r', 1, '2026-08-05T12:00:00.000Z', null)
  user.run('chico', 'Chico', 'chefe', 's', 'r', 1, '2026-08-06T12:00:00.000Z', null)
  db.prepare('INSERT INTO convites (token, nome_empresa, cnpj, criado_em, criado_por, aberturas, aberto_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('ABCDEFGHJK', 'Padaria Boa', '11.222.333/0001-81', '2026-09-01T12:00:00.000Z', 'maria', 3, '2026-09-02T12:00:00.000Z')
  const response = db.prepare(`INSERT INTO respostas (id, protocolo, token_convite, recebido_em, nome_empresa, cnpj, solicitante_no_qsa, pacote, situacao, tratado_por, tratado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const pacote = (nome: string) => JSON.stringify({ protocolo: 'x', respostas: { nomeEmpresa: nome }, diagnostico: { saida: 'B' } })
  response.run(1, 'DS-260915-ABCD', 'ABCDEFGHJK', '2026-09-15T12:00:00.000Z', 'Padaria Boa', '11.222.333/0001-81', 'sim', pacote('Padaria Boa'), 'validada', 'maria', '2026-09-16T12:00:00.000Z')
  response.run(2, 'DS-260915-ABCD', 'ORFAOXXXXX', '2026-09-15T13:00:00.000Z', 'Oficina', null, 'nao', pacote('Oficina'), 'em_analise', 'fantasma', '2026-09-16T13:00:00.000Z')
  response.run(3, '(sem protocolo)', null, '2026-09-15T14:00:00.000Z', 'Sem Protocolo', null, null, pacote('Sem Protocolo'), 'nova', null, null)
  response.run(7, 'DS-260916-WXYZ', null, '2026-09-16T12:00:00.000Z', 'Loja', null, null, pacote('Loja'), 'descartada', null, null)
  const adesao = db.prepare(`INSERT INTO adesoes (id, protocolo, resposta_id, token_convite, aceito_em, nome_empresa, cnpj, representante, cpf, cargo, email, telefone,
    modalidade, sem_manifestacao, quer_proposta, versao_termo, resumo_termo, origem, agente, pacote, situacao, nota_interna, tratado_por, tratado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const V4_HASH = '94667b1747b65c3e177416ee98e63a79b10599c1a5240b3a0836c094c0788441'
  const V5_HASH = '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004'
  adesao.run(1, 'ADS-20260925-AAAAA', 1, 'ABCDEFGHJK', '2026-09-25T13:00:00.000Z', 'Padaria Boa', '11.222.333/0001-81', 'Ana', '529.982.247-25', 'Sócio',
    'ana@padaria.com', '(34) 99999-9999', 'hibrido', 'cancelar', 1, 'V4', V4_HASH, '203.0.113.7', 'Mozilla/5.0',
    JSON.stringify({ comoObtido: 'cf-connecting-ip', cadeia: '203.0.113.7, 10.0.0.1', empresa: { nomeEmpresa: 'Padaria Boa' } }), 'protocolada', null, 'regina', '2026-09-26T12:00:00.000Z')
  adesao.run(2, 'ADS-20260925-AAAAA', 99, 'ORFAOXXXXX', '2026-09-25T14:00:00.000Z', 'Oficina', null, 'Beto', null, null,
    'beto@oficina.com', '', 'padrao', null, 0, 'V3', 'abc', null, null, '{}', 'recebida', null, null, null)
  adesao.run(4, 'ADS-20260926-BBBBB', null, null, '2026-09-26T13:00:00.000Z', 'Loja', '22.333.444/0001-90', 'Caio', '111.444.777-35', 'Diretor',
    'caio@loja.com', null, 'hibrido', 'manter', 0, 'V5', V5_HASH, '198.51.100.9', null, '{}', 'cancelada', 'desistiu', 'fantasma', '2026-09-27T12:00:00.000Z')
  const event = db.prepare('INSERT INTO eventos (quando, quem, o_que, referencia, detalhe) VALUES (?, ?, ?, ?, ?)')
  event.run('2026-09-10T12:00:00.000Z', 'maria', 'acesso_negado', 'maria', '{"motivo":"senha incorreta"}')
  event.run('2026-09-11T12:00:00.000Z', 'victor', 'planilha_exportada', '4', null)
  event.run('2026-09-12T12:00:00.000Z', null, 'resposta_recebida', 'DS-260915-ABCD', '{"id":1}')
  event.run('2026-09-13T12:00:00.000Z', 'victor', 'coisa_estranha', null, null)
  db.close()
}

describe('legacy import against a SQLite copy', () => {
  beforeAll(async () => {
    await resetDatabase()
    buildLegacyDatabase()
    await prisma.user.create({ data: { id: 'victor-novo', name: 'Victor', email: 'victor@users.invalid', username: 'victor', role: 'admin' } })
  })
  afterAll(() => rmSync(path, { force: true }))

  it('dry run counts and writes nothing', async () => {
    const importer = legacyImporter(path)
    const report = await importer.run({ dryRun: true })
    importer.close()
    expect(report).toMatchObject({
      users: { found: 6, imported: 5, skipped: 1 }, invitations: { imported: 1 }, responses: { found: 4, imported: 4 },
      adhesions: { found: 3, imported: 3, skipped: 0 }, audit: { imported: 4 }, conflicts: [],
    })
    expect(report.notes).toEqual(expect.arrayContaining([
      'usuário chico: papel chefe sem equivalente; entra como operador',
      'adesão 2: diagnóstico 99 não existe; fica sem diagnóstico',
      'adesão 2: versão do termo V3 não está no sistema; a via vai responder que o texto não existe',
    ]))
    expect(await prisma.adhesion.count()).toBe(0)
    expect(await prisma.response.count()).toBe(0)
  })

  it('imports everything once, twice in a row, with ids, protocols, links and the sequence', async () => {
    const reports = []
    for (let run = 0; run < 2; run++) {
      const importer = legacyImporter(path)
      reports.push(await importer.run({ dryRun: false }))
      importer.close()
    }
    expect(reports[1]?.adhesions).toEqual({ found: 3, imported: 0, skipped: 3 })
    const maria = await prisma.user.findUniqueOrThrow({ where: { username: 'maria' } })
    expect(maria).toMatchObject({ email: 'maria@users.invalid', role: 'operator', banned: true, lastLoginAt: new Date('2026-09-10T12:00:00.000Z') })
    expect((await prisma.user.findUniqueOrThrow({ where: { username: 'victor' } })).name).toBe('Victor')
    expect(await prisma.account.count({ where: { userId: maria.id } })).toBe(0)
    expect(await prisma.invitation.findUniqueOrThrow({ where: { token: 'ABCDEFGHJK' } })).toMatchObject({ createdById: maria.id, openCount: 3 })

    const responses = await prisma.response.findMany({ orderBy: { id: 'asc' } })
    expect(responses.map((r) => [r.id, r.protocol])).toEqual([[1, 'DS-260915-ABCD'], [2, 'DS-260915-ABCD-2'], [3, 'SEM-3'], [7, 'DS-260916-WXYZ']])
    expect(responses[0]).toMatchObject({ status: 'validated', handledById: maria.id, invitationToken: 'ABCDEFGHJK', requesterInQsa: true, cnpjDigits: '11222333000181' })
    expect(responses[1]).toMatchObject({ status: 'in_review', handledById: null, invitationToken: null, requesterInQsa: false })
    expect(responses[3]?.payload).toMatchObject({ respostas: { nomeEmpresa: 'Loja' } })
    expect((await prisma.response.create({ data: { protocol: 'DS-261001-NOVA', payload: {} } })).id).toBe(8)

    const roles = Object.fromEntries((await prisma.user.findMany({ select: { username: true, role: true } })).map((u) => [u.username, u.role]))
    expect(roles).toMatchObject({ victor: 'admin', maria: 'operator', gestora: 'manager', regina: 'regularization', otavio: 'operator', chico: 'operator' })
    const regina = await prisma.user.findUniqueOrThrow({ where: { username: 'regina' } })

    const adhesions = await prisma.adhesion.findMany({ orderBy: { id: 'asc' } })
    expect(adhesions.map((a) => [a.id, a.protocol])).toEqual([[1, 'ADS-20260925-AAAAA'], [2, 'ADS-20260925-AAAAA-2'], [4, 'ADS-20260926-BBBBB']])
    expect(adhesions[0]).toMatchObject({
      responseId: 1, invitationToken: 'ABCDEFGHJK', modality: 'hybrid', withoutManifestation: 'cancel', wantsProposal: true, status: 'filed',
      termVersion: 'V4', termHash: '94667b1747b65c3e177416ee98e63a79b10599c1a5240b3a0836c094c0788441', cnpjDigits: '11222333000181',
      originIp: '203.0.113.7', originSource: 'cf-connecting-ip', forwardedChain: '203.0.113.7, 10.0.0.1', userAgent: 'Mozilla/5.0',
      handledById: regina.id, receiptToken: null, acceptedAt: new Date('2026-09-25T13:00:00.000Z'),
    })
    expect(adhesions[1]).toMatchObject({ responseId: null, invitationToken: null, modality: 'standard', withoutManifestation: null, cnpj: '', cpf: '', representativeRole: '', termVersion: 'V3', phone: null })
    expect(adhesions[2]).toMatchObject({ status: 'cancelled', withoutManifestation: 'keep', internalNote: 'desistiu', handledById: null, termHash: '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004' })
    const next = await prisma.adhesion.create({ data: {
      protocol: 'ADS-20261001-NOVAA', acceptedAt: new Date(), companyName: 'x', cnpj: 'x', cnpjDigits: 'x', representative: 'x', cpf: 'x',
      representativeRole: 'x', email: 'x', modality: 'standard', termVersion: 'V5', termHash: 'x', payload: {},
    } })
    expect(next.id).toBe(5)

    const audit = await prisma.auditLog.findMany({ orderBy: { id: 'asc' } })
    const legacy = audit.filter((entry) => (entry.detail as { legacyEventId?: number } | null)?.legacyEventId)
    expect(legacy.map((entry) => entry.action)).toEqual(['access_denied', 'spreadsheet_exported', 'response_received', 'legacy_imported'])
    expect(legacy[0]).toMatchObject({ actorId: maria.id, actorUsername: 'maria', occurredAt: new Date('2026-09-10T12:00:00.000Z') })
    expect(legacy[1]?.detail).toMatchObject({ kind: 'responses' })
    expect(legacy[3]?.detail).toMatchObject({ legacyAction: 'coisa_estranha' })
    expect(audit.filter((entry) => entry.action === 'legacy_imported' && !(entry.detail as { legacyEventId?: number } | null)?.legacyEventId)).toHaveLength(2)
  })
})
