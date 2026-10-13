import { describe, expect, it } from 'vitest'
import { makeImportUserEmails } from './import-user-emails'

function setup(existingUsernames: string[]) {
  const emails = new Map<string, string>()
  const accounts = {
    findByUsername: async (username: string) => (existingUsernames.includes(username) ? { id: username } : null),
    setEmail: async (id: string, email: string) => void emails.set(id, email),
  }
  const audit: unknown[] = []
  const importUserEmails = makeImportUserEmails({ accounts, recordAudit: async (entry) => void audit.push(entry) })
  return { importUserEmails, emails, audit }
}

const admin = { id: 'a', username: 'ana', role: 'admin' as const }

describe('import user emails', () => {
  it('applies every valid line, all at once', async () => {
    const { importUserEmails, emails, audit } = setup(['bia', 'caio'])
    const result = await importUserEmails(admin, 'bia;bia@austercontabil.com.br\ncaio;caio@austercontabil.com.br\n')
    expect(result).toEqual({ ok: true, appliedUsernames: ['bia', 'caio'] })
    expect(emails).toEqual(new Map([['bia', 'bia@austercontabil.com.br'], ['caio', 'caio@austercontabil.com.br']]))
    expect(audit).toEqual([{ action: 'user_email_changed', actorId: 'a', actorUsername: 'ana', reference: '2', detail: { usernames: ['bia', 'caio'] } }])
  })

  it('applies nothing if any line is invalid, and reports every problem', async () => {
    const { importUserEmails, emails } = setup(['bia'])
    const result = await importUserEmails(admin, 'bia;bia@austercontabil.com.br\nninguem;x@austercontabil.com.br\nbia;não é email\n')
    expect(result).toEqual({
      ok: false,
      errors: [
        { line: 2, reason: 'usuário não encontrado' },
        { line: 3, reason: 'e-mail inválido' },
      ],
    })
    expect(emails.size).toBe(0)
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
