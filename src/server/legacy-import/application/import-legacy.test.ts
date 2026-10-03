import { describe, expect, it } from 'vitest'
import type { LegacyAdhesion, LegacyEvent, LegacyInvitation, LegacyResponse, LegacyUser } from '../domain/legacy-rows'
import type { ImportedAdhesion, ImportedAuditEntry, ImportedInvitation, ImportedResponse, ImportedUser } from '../domain/mapping'
import type { ImportActor, ImportTarget } from '../ports/import-target'
import { makeImportLegacy } from './import-legacy'

const response = (id: number, protocolo: string): LegacyResponse => ({
  id, protocolo, token_convite: null, recebido_em: '2026-09-15T12:00:00.000Z', nome_empresa: null, cnpj: null, solicitante: null, email: null,
  telefone: null, versao: null, saida: null, posicao: null, certeza: null, urgencia: null, confianca: null, solicitante_no_qsa: null,
  pacote: '{}', situacao: 'nova', nota_interna: null, tratado_por: null, tratado_em: null,
})

function memoryTarget(existingResponses: [number, string][] = [], existingAdhesions: [number, string][] = []) {
  const users: ImportedUser[] = []
  const invitations: ImportedInvitation[] = []
  const responses = new Map<number, string>(existingResponses)
  const adhesions = new Map<number, string>(existingAdhesions)
  const imported: ImportedAdhesion[] = []
  const audit: ImportedAuditEntry[] = []
  const imports: Record<string, number>[] = []
  const importers: (ImportActor | undefined)[] = []
  const target: ImportTarget = {
    existingUsernames: async () => new Map([['victor', 'v1'], ...users.map((u) => [u.username, u.id] as const)]),
    existingInvitationTokens: async () => new Set(invitations.map((i) => i.token)),
    existingResponses: async () => new Map(responses),
    existingProtocols: async () => new Map([...responses].map(([id, protocol]) => [protocol, id])),
    existingAdhesions: async () => new Map(adhesions),
    existingAdhesionProtocols: async () => new Map([...adhesions].map(([id, protocol]) => [protocol, id])),
    importedEventIds: async () => new Set(audit.map((entry) => Number(entry.detail.legacyEventId))),
    insertUsers: async (rows) => void users.push(...rows),
    insertInvitations: async (rows) => void invitations.push(...rows),
    insertResponses: async (rows: ImportedResponse[]) => rows.forEach((row) => responses.set(row.id, row.protocol)),
    insertAdhesions: async (rows) => rows.forEach((row) => (imported.push(row), adhesions.set(row.id, row.protocol))),
    insertAuditEntries: async (rows) => void audit.push(...rows),
    recordImport: async (detail, actor) => void (imports.push(detail), importers.push(actor)),
  }
  return { target, users, invitations, responses, imported, audit, imports, importers }
}

const legacyUsers: LegacyUser[] = [
  { usuario: 'victor', nome: 'Victor', papel: 'admin', ativo: 1, criado_em: '2026-08-01T12:00:00.000Z', acesso_em: null },
  { usuario: 'maria', nome: 'Maria', papel: 'equipe', ativo: 1, criado_em: '2026-08-02T12:00:00.000Z', acesso_em: null },
  { usuario: 'chico', nome: 'Chico', papel: 'chefe', ativo: 1, criado_em: '2026-08-03T12:00:00.000Z', acesso_em: null },
]
const legacyInvitations: LegacyInvitation[] = [
  { token: 'ABCDEFGHJK', nome_empresa: 'Padaria', cnpj: null, email: null, observacao: null, criado_em: '2026-09-01T12:00:00.000Z', criado_por: 'maria', aberturas: 3, aberto_em: null },
]
const legacyEvents: LegacyEvent[] = [{ id: 1, quando: '2026-09-15T12:00:00.000Z', quem: 'maria', o_que: 'acesso_negado', referencia: 'maria', detalhe: '{"motivo":"senha incorreta"}' }]

const adhesion = (id: number, protocolo: string, over: Partial<LegacyAdhesion> = {}): LegacyAdhesion => ({
  id, protocolo, resposta_id: null, token_convite: null, aceito_em: '2026-09-25T13:00:00.000Z', nome_empresa: 'Padaria', cnpj: '11.222.333/0001-81',
  representante: 'Ana', cpf: '529.982.247-25', cargo: 'Sócio', email: 'ana@padaria.com', telefone: null, modalidade: 'hibrido',
  sem_manifestacao: 'manter', quer_proposta: 0, versao_termo: 'V4', resumo_termo: 'h', origem: null, agente: null, pacote: '{}',
  situacao: 'recebida', nota_interna: null, tratado_por: null, tratado_em: null, ...over,
})

const source = (responses: LegacyResponse[], adhesions: LegacyAdhesion[] = []) => ({
  users: async () => legacyUsers,
  invitations: async () => legacyInvitations,
  responses: async () => responses,
  adhesions: async () => adhesions,
  events: async () => legacyEvents,
})

const VERSIONS = new Set(['V4', 'V5'])

describe('importLegacy', () => {
  it('counts without writing on a dry run', async () => {
    const memory = memoryTarget()
    const report = await makeImportLegacy({ source: source([response(1, 'DS-1'), response(2, 'DS-1')]), target: memory.target, newUserId: () => 'new', knownTermVersions: VERSIONS })({ dryRun: true })
    expect(report).toMatchObject({ dryRun: true, users: { found: 3, imported: 2, skipped: 1 }, responses: { found: 2, imported: 2, skipped: 0 }, conflicts: [] })
    expect(report.notes).toContain('resposta 2: protocolo DS-1 gravado como DS-1-2')
    expect(memory.users).toHaveLength(0)
    expect(memory.imports).toHaveLength(0)
  })

  it('imports in order, links ids by username, and imports nothing new the second time', async () => {
    const memory = memoryTarget()
    let next = 0
    const run = makeImportLegacy({ source: source([response(1, 'DS-1')]), target: memory.target, newUserId: () => `u${++next}`, knownTermVersions: VERSIONS })
    await run({ dryRun: false })
    expect(memory.users.map((u) => u.username)).toEqual(['maria', 'chico'])
    expect(memory.invitations[0]?.createdById).toBe('u1')
    expect(memory.audit[0]).toMatchObject({ action: 'access_denied', actorId: 'u1', detail: { motivo: 'senha incorreta', legacyEventId: 1 } })
    const again = await run({ dryRun: false })
    expect(again).toMatchObject({ users: { imported: 0 }, invitations: { imported: 0 }, responses: { imported: 0, skipped: 1 }, audit: { imported: 0 } })
    expect(memory.imports).toHaveLength(2)
  })

  it('records who ran the import, and no one when it came from the script', async () => {
    const memory = memoryTarget()
    const run = makeImportLegacy({ source: source([response(1, 'DS-1')]), target: memory.target, newUserId: () => 'u', knownTermVersions: VERSIONS })
    await run({ dryRun: false, actor: { id: 'v1', username: 'victor' } })
    await run({ dryRun: false })
    expect(memory.importers).toEqual([{ id: 'v1', username: 'victor' }, undefined])
  })

  it('writes nothing while an id or a protocol conflicts with the new database', async () => {
    const memory = memoryTarget([[1, 'DS-OUTRO'], [50, 'DS-2']])
    const report = await makeImportLegacy({ source: source([response(1, 'DS-1'), response(2, 'DS-2')]), target: memory.target, newUserId: () => 'x', knownTermVersions: VERSIONS })({ dryRun: false })
    expect(report.conflicts).toEqual([
      'resposta 1: o id já existe no banco novo com o protocolo DS-OUTRO',
      'resposta 2: o protocolo DS-2 já é da resposta 50',
    ])
    expect(memory.users).toHaveLength(0)
    expect(memory.imports).toHaveLength(0)
  })

  it('imports adhesions after the responses they point to, with notes for what is left out', async () => {
    const memory = memoryTarget()
    const run = makeImportLegacy({
      source: source([response(1, 'DS-1')], [
        adhesion(1, 'ADS-1', { resposta_id: 1, token_convite: 'ABCDEFGHJK', tratado_por: 'maria', situacao: 'protocolada' }),
        adhesion(2, 'ADS-1', { resposta_id: 99, token_convite: 'ORFAOXXXXX', versao_termo: 'V3', cpf: null, tratado_por: 'fantasma' }),
      ]),
      target: memory.target, newUserId: () => 'u1', knownTermVersions: VERSIONS,
    })
    const report = await run({ dryRun: false })
    expect(report.adhesions).toEqual({ found: 2, imported: 2, skipped: 0 })
    expect(memory.imported.map((row) => [row.id, row.protocol, row.responseId, row.invitationToken, row.handledById, row.status])).toEqual([
      [1, 'ADS-1', 1, 'ABCDEFGHJK', 'u1', 'filed'],
      [2, 'ADS-1-2', null, null, null, 'received'],
    ])
    expect(report.notes).toEqual(expect.arrayContaining([
      'usuário chico: papel chefe sem equivalente; entra como operador',
      'adesão 2: protocolo ADS-1 gravado como ADS-1-2',
      'adesão 2: diagnóstico 99 não existe; fica sem diagnóstico',
      'adesão 2: convite ORFAOXXXXX não existe; fica sem convite',
      'adesão 2: tratada por fantasma, que não existe; fica sem autor',
      'adesão 2: CPF vazio no banco antigo; gravado em branco',
      'adesão 2: versão do termo V3 não está no sistema; a via vai responder que o texto não existe',
    ]))
    expect(memory.imports.at(-1)).toMatchObject({ adhesions: 2 })
    expect((await run({ dryRun: false })).adhesions).toEqual({ found: 2, imported: 0, skipped: 2 })
  })

  it('writes nothing while an adhesion id or protocol conflicts, or the modality has no equivalent', async () => {
    const memory = memoryTarget([], [[1, 'ADS-OUTRO'], [50, 'ADS-2']])
    const report = await makeImportLegacy({
      source: source([], [adhesion(1, 'ADS-1'), adhesion(2, 'ADS-2'), adhesion(3, 'ADS-3', { modalidade: 'outra' })]),
      target: memory.target, newUserId: () => 'x', knownTermVersions: VERSIONS,
    })({ dryRun: false })
    expect(report.conflicts).toEqual([
      'adesão 1: o id já existe no banco novo com o protocolo ADS-OUTRO',
      'adesão 2: o protocolo ADS-2 já é da adesão 50',
      'adesão 3: modalidade outra sem equivalente',
    ])
    expect(memory.imported).toHaveLength(0)
    expect(memory.users).toHaveLength(0)
  })

  it('stops on the dry run and on the real run, before writing any table, when an adhesion has a bad date or an unknown value', async () => {
    const rows = [
      adhesion(1, 'ADS-1', { aceito_em: 'ontem' }),
      adhesion(2, 'ADS-2', { situacao: 'constructor' }),
      adhesion(3, 'ADS-3', { sem_manifestacao: 'talvez', tratado_em: 'não sei' }),
    ]
    const expected = [
      'adesão 1: aceite em ontem não é uma data',
      'adesão 2: situação constructor sem equivalente',
      'adesão 3: sem manifestação talvez sem equivalente',
      'adesão 3: tratada em não sei não é uma data',
    ]
    for (const dryRun of [true, false]) {
      const memory = memoryTarget()
      const report = await makeImportLegacy({ source: source([response(1, 'DS-1')], rows), target: memory.target, newUserId: () => 'x', knownTermVersions: VERSIONS })({ dryRun })
      expect(report.conflicts).toEqual(expected)
      expect(report.adhesions).toMatchObject({ found: 3, imported: 0 })
      expect([memory.users, memory.invitations, memory.imported, memory.audit, memory.imports].map((rows) => rows.length)).toEqual([0, 0, 0, 0, 0])
      expect(memory.responses.size).toBe(0)
    }
  })
})
