import { describe, expect, it } from 'vitest'
import type { InvitationRecord, InvitationRepository } from '../ports/invitation-repository'
import { INVITATION_IN_USE } from '../domain/invitation'
import { makeInvitations } from './manage-invitations'

const actor = { id: 'u1', username: 'maria' }

function setup() {
  const rows = new Map<string, InvitationRecord>()
  const opened = new Set<string>()
  const audits: { action: string; reference: string }[] = []
  const repository: InvitationRepository = {
    exists: async (token) => rows.has(token),
    create: async (input) => {
      const record: InvitationRecord = { ...input, note: null, openCount: 0, lastOpenedAt: null, createdAt: new Date('2026-09-20T12:00:00Z'), createdBy: 'maria', responseCount: 0, adhesionCount: 0 }
      rows.set(input.token, record)
      return record
    },
    find: async (token) => rows.get(token) ?? null,
    list: async () => [...rows.values()],
    delete: async (token) => void rows.delete(token),
    registerOpening: async (token, draftId) => {
      const row = rows.get(token)
      if (!row || opened.has(draftId)) return false
      opened.add(draftId)
      row.openCount++
      return true
    },
  }
  const tokens = ['ABCDEFGHJK', 'ABCDEFGHJK', 'ZZZZZZZZZZ']
  const invitations = makeInvitations({
    repository,
    tokens: { next: () => tokens.shift() ?? 'YYYYYYYYYY' },
    recordAudit: async (entry) => void audits.push(entry),
    baseUrl: 'https://hml.example',
  })
  const row = (token: string) => {
    const found = rows.get(token)
    if (!found) throw new Error(`convite ${token} ausente`)
    return found
  }
  return { rows, row, audits, invitations }
}

describe('manage invitations', () => {
  it('creates with a fresh token, audits and returns the links', async () => {
    const { invitations, audits } = setup()
    const first = await invitations.createInvitation(actor, { companyName: 'Empresa', cnpj: '', email: '' })
    const second = await invitations.createInvitation(actor, { companyName: 'Outra', cnpj: '', email: '' })
    expect(first.ok && first.invitation.token).toBe('ABCDEFGHJK')
    expect(second.ok && second.invitation.token).toBe('ZZZZZZZZZZ')
    expect(second.ok && second.invitation.links.diagnosis).toBe('https://hml.example/diagnosis?invite=ZZZZZZZZZZ')
    expect(audits.map((a) => a.action)).toEqual(['invitation_created', 'invitation_created'])
  })

  it('refuses without name or CNPJ', async () => {
    const { invitations } = setup()
    expect((await invitations.createInvitation(actor, { companyName: '', cnpj: '', email: 'x@y.com' })).ok).toBe(false)
  })

  it('does not delete an invitation that brought a response or an adhesion', async () => {
    const { invitations, row, audits } = setup()
    await invitations.createInvitation(actor, { companyName: 'Empresa', cnpj: '', email: '' })
    row('ABCDEFGHJK').adhesionCount = 1
    expect(await invitations.deleteInvitation(actor, 'ABCDEFGHJK')).toEqual({ ok: false, message: INVITATION_IN_USE })
    row('ABCDEFGHJK').adhesionCount = 0
    expect(await invitations.deleteInvitation(actor, 'ABCDEFGHJK')).toEqual({ ok: true })
    expect(audits.at(-1)?.action).toBe('invitation_deleted')
  })

  it('counts one opening per draft and ignores malformed tokens', async () => {
    const { invitations, rows } = setup()
    await invitations.createInvitation(actor, { companyName: 'Empresa', cnpj: '', email: '' })
    expect(await invitations.openInvitation('ABCDEFGHJK', 'd1')).toBe(true)
    expect(await invitations.openInvitation('ABCDEFGHJK', 'd1')).toBe(false)
    expect(await invitations.openInvitation('ABCDEFGHJK', 'd2')).toBe(true)
    expect(await invitations.openInvitation('nada', 'd3')).toBe(false)
    expect(rows.get('ABCDEFGHJK')?.openCount).toBe(2)
  })

  it('prefills only company name and CNPJ of a known token', async () => {
    const { invitations } = setup()
    await invitations.createInvitation(actor, { companyName: 'Empresa', cnpj: '11222333000181', email: 'a@b.com' })
    expect(await invitations.invitationPrefill('ABCDEFGHJK')).toEqual({ token: 'ABCDEFGHJK', companyName: 'Empresa', cnpj: '11.222.333/0001-81' })
    expect(await invitations.invitationPrefill('QQQQQQQQQQ')).toBeNull()
  })
})
