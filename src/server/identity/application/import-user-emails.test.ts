import { describe, expect, it } from 'vitest'
import { IdentityError } from '../domain/user'
import { makeImportUserEmails } from './import-user-emails'

function setup(existingUsernames: string[], options: { takenEmails?: string[] } = {}) {
  const emails = new Map<string, string>()
  const writes: { id: string; email: string }[][] = []
  const accounts = {
    findByUsername: async (username: string) => (existingUsernames.includes(username) ? { id: username } : null),
    setEmails: async (pairs: { id: string; email: string }[]) => {
      writes.push(pairs)
      if (pairs.some(({ email }) => options.takenEmails?.includes(email))) throw new IdentityError('email_taken')
      for (const { id, email } of pairs) emails.set(id, email)
    },
  }
  const audit: unknown[] = []
  const importUserEmails = makeImportUserEmails({ accounts, recordAudit: async (entry) => void audit.push(entry) })
  return { importUserEmails, emails, writes, audit }
}

const admin = { id: 'a', username: 'ana', role: 'admin' as const }

describe('import user emails', () => {
  it('applies every valid line, all at once', async () => {
    const { importUserEmails, emails, writes, audit } = setup(['bia', 'caio'])
    const result = await importUserEmails(admin, 'bia;bia@austercontabil.com.br\ncaio;caio@austercontabil.com.br\n')
    expect(result).toEqual({ ok: true, appliedUsernames: ['bia', 'caio'] })
    expect(writes).toHaveLength(1)
    expect(emails).toEqual(new Map([['bia', 'bia@austercontabil.com.br'], ['caio', 'caio@austercontabil.com.br']]))
    expect(audit).toEqual([{ action: 'user_email_changed', actorId: 'a', actorUsername: 'ana', reference: '2', detail: { usernames: ['bia', 'caio'] } }])
  })

  it('applies nothing if any line is invalid, and reports every problem', async () => {
    const { importUserEmails, writes } = setup(['bia'])
    const result = await importUserEmails(admin, 'bia;bia@austercontabil.com.br\nninguem;x@austercontabil.com.br\nbia;não é email\n')
    expect(result).toEqual({
      ok: false,
      errors: [
        { line: 2, reason: 'usuário não encontrado' },
        { line: 3, reason: 'e-mail inválido' },
      ],
    })
    expect(writes).toEqual([])
  })

  it('applies nothing when the same email appears twice in the pasted list', async () => {
    const { importUserEmails, writes, audit } = setup(['bia', 'caio', 'davi'])
    const result = await importUserEmails(admin, 'bia;mesmo@austercontabil.com.br\ndavi;davi@austercontabil.com.br\ncaio;MESMO@austercontabil.com.br\n')
    expect(result).toEqual({
      ok: false,
      errors: [
        { line: 1, reason: 'e-mail repetido na lista' },
        { line: 3, reason: 'e-mail repetido na lista' },
      ],
    })
    expect(writes).toEqual([])
    expect(audit).toEqual([])
  })

  it('applies nothing, and says so, when one email already belongs to another user', async () => {
    const { importUserEmails, emails, audit } = setup(['bia', 'caio'], { takenEmails: ['caio@austercontabil.com.br'] })
    const result = await importUserEmails(admin, 'bia;bia@austercontabil.com.br\ncaio;caio@austercontabil.com.br\n')
    expect(result).toEqual({ ok: false, errors: [{ line: 0, reason: 'um dos e-mails já pertence a outro usuário' }] })
    expect(emails.size).toBe(0)
    expect(audit).toEqual([])
  })

  it('ignores blank lines', async () => {
    const { importUserEmails } = setup(['bia'])
    expect(await importUserEmails(admin, '\nbia;bia@austercontabil.com.br\n\n')).toEqual({ ok: true, appliedUsernames: ['bia'] })
  })

  it('only admins import emails', async () => {
    const { importUserEmails } = setup(['bia'])
    await expect(importUserEmails({ id: 'o', username: 'caio', role: 'operator' }, 'bia;bia@austercontabil.com.br')).rejects.toMatchObject({ reason: 'forbidden' })
  })
})
