import { describe, expect, it } from 'vitest'
import { IdentityError } from '../domain/user'
import { makeSetUserEmail } from './set-user-email'

function setup() {
  const emails = new Map<string, string>([['u1', 'bia@users.invalid']])
  const accounts = {
    findByUsername: async (username: string) => (username === 'bia' ? { id: 'u1' } : null),
    setEmail: async (id: string, email: string) => void emails.set(id, email),
  }
  const audit: unknown[] = []
  const setUserEmail = makeSetUserEmail({ accounts, recordAudit: async (entry) => void audit.push(entry) })
  return { setUserEmail, emails, audit }
}

const admin = { id: 'a', username: 'ana', role: 'admin' as const }
const operator = { id: 'o', username: 'caio', role: 'operator' as const }

describe('set user email', () => {
  it('sets a valid email and audits it', async () => {
    const { setUserEmail, emails, audit } = setup()
    await setUserEmail(admin, 'bia', 'bia@austercontabil.com.br')
    expect(emails.get('u1')).toBe('bia@austercontabil.com.br')
    expect(audit).toEqual([{ action: 'user_email_changed', actorId: 'a', actorUsername: 'ana', reference: 'bia', detail: { email: 'bia@austercontabil.com.br' } }])
  })

  it('refuses a malformed email', async () => {
    const { setUserEmail } = setup()
    await expect(setUserEmail(admin, 'bia', 'não é email')).rejects.toBeInstanceOf(IdentityError)
  })

  it('refuses a user that does not exist', async () => {
    const { setUserEmail } = setup()
    await expect(setUserEmail(admin, 'ninguem', 'x@austercontabil.com.br')).rejects.toMatchObject({ reason: 'not_found' })
  })

  it('only admins change email', async () => {
    const { setUserEmail } = setup()
    await expect(setUserEmail(operator, 'bia', 'bia@austercontabil.com.br')).rejects.toMatchObject({ reason: 'forbidden' })
  })
})
