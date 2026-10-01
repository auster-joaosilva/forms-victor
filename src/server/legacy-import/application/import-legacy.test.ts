import { describe, expect, it } from 'vitest'
import type { LegacyEvent, LegacyInvitation, LegacyResponse, LegacyUser } from '../domain/legacy-rows'
import type { ImportedAuditEntry, ImportedInvitation, ImportedResponse, ImportedUser } from '../domain/mapping'
import type { ImportTarget } from '../ports/import-target'
import { makeImportLegacy } from './import-legacy'

const response = (id: number, protocolo: string): LegacyResponse => ({
  id, protocolo, token_convite: null, recebido_em: '2026-09-15T12:00:00.000Z', nome_empresa: null, cnpj: null, solicitante: null, email: null,
  telefone: null, versao: null, saida: null, posicao: null, certeza: null, urgencia: null, confianca: null, solicitante_no_qsa: null,
  pacote: '{}', situacao: 'nova', nota_interna: null, tratado_por: null, tratado_em: null,
})

function memoryTarget(existingResponses: [number, string][] = []) {
  const users: ImportedUser[] = []
  const invitations: ImportedInvitation[] = []
  const responses = new Map<number, string>(existingResponses)
  const audit: ImportedAuditEntry[] = []
  const imports: Record<string, number>[] = []
  const target: ImportTarget = {
    existingUsernames: async () => new Map([['victor', 'v1'], ...users.map((u) => [u.username, u.id] as const)]),
    existingInvitationTokens: async () => new Set(invitations.map((i) => i.token)),
    existingResponses: async () => new Map(responses),
    existingProtocols: async () => new Map([...responses].map(([id, protocol]) => [protocol, id])),
    importedEventIds: async () => new Set(audit.map((entry) => Number(entry.detail.legacyEventId))),
    insertUsers: async (rows) => void users.push(...rows),
    insertInvitations: async (rows) => void invitations.push(...rows),
    insertResponses: async (rows: ImportedResponse[]) => rows.forEach((row) => responses.set(row.id, row.protocol)),
    insertAuditEntries: async (rows) => void audit.push(...rows),
    recordImport: async (detail) => void imports.push(detail),
  }
  return { target, users, invitations, responses, audit, imports }
}

const legacyUsers: LegacyUser[] = [
  { usuario: 'victor', nome: 'Victor', papel: 'admin', ativo: 1, criado_em: '2026-08-01T12:00:00.000Z', acesso_em: null },
  { usuario: 'maria', nome: 'Maria', papel: 'equipe', ativo: 1, criado_em: '2026-08-02T12:00:00.000Z', acesso_em: null },
]
const legacyInvitations: LegacyInvitation[] = [
  { token: 'ABCDEFGHJK', nome_empresa: 'Padaria', cnpj: null, email: null, observacao: null, criado_em: '2026-09-01T12:00:00.000Z', criado_por: 'maria', aberturas: 3, aberto_em: null },
]
const legacyEvents: LegacyEvent[] = [{ id: 1, quando: '2026-09-15T12:00:00.000Z', quem: 'maria', o_que: 'acesso_negado', referencia: 'maria', detalhe: '{"motivo":"senha incorreta"}' }]

const source = (responses: LegacyResponse[]) => ({
  users: async () => legacyUsers,
  invitations: async () => legacyInvitations,
  responses: async () => responses,
  events: async () => legacyEvents,
})

describe('importLegacy', () => {
  it('counts without writing on a dry run', async () => {
    const memory = memoryTarget()
    const report = await makeImportLegacy({ source: source([response(1, 'DS-1'), response(2, 'DS-1')]), target: memory.target, newUserId: () => 'new' })({ dryRun: true })
    expect(report).toMatchObject({ dryRun: true, users: { found: 2, imported: 1, skipped: 1 }, responses: { found: 2, imported: 2, skipped: 0 }, conflicts: [] })
    expect(report.notes).toContain('resposta 2: protocolo DS-1 gravado como DS-1-2')
    expect(memory.users).toHaveLength(0)
    expect(memory.imports).toHaveLength(0)
  })

  it('imports in order, links ids by username, and imports nothing new the second time', async () => {
    const memory = memoryTarget()
    let next = 0
    const run = makeImportLegacy({ source: source([response(1, 'DS-1')]), target: memory.target, newUserId: () => `u${++next}` })
    await run({ dryRun: false })
    expect(memory.users.map((u) => u.username)).toEqual(['maria'])
    expect(memory.invitations[0]?.createdById).toBe('u1')
    expect(memory.audit[0]).toMatchObject({ action: 'access_denied', actorId: 'u1', detail: { motivo: 'senha incorreta', legacyEventId: 1 } })
    const again = await run({ dryRun: false })
    expect(again).toMatchObject({ users: { imported: 0 }, invitations: { imported: 0 }, responses: { imported: 0, skipped: 1 }, audit: { imported: 0 } })
    expect(memory.imports).toHaveLength(2)
  })

  it('writes nothing while an id or a protocol conflicts with the new database', async () => {
    const memory = memoryTarget([[1, 'DS-OUTRO'], [50, 'DS-2']])
    const report = await makeImportLegacy({ source: source([response(1, 'DS-1'), response(2, 'DS-2')]), target: memory.target, newUserId: () => 'x' })({ dryRun: false })
    expect(report.conflicts).toEqual([
      'resposta 1: o id já existe no banco novo com o protocolo DS-OUTRO',
      'resposta 2: o protocolo DS-2 já é da resposta 50',
    ])
    expect(memory.users).toHaveLength(0)
    expect(memory.imports).toHaveLength(0)
  })
})
