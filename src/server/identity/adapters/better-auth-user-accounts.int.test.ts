import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../../../../tests/integration/db'
import { IdentityError } from '../domain/user'
import { betterAuthUserAccounts } from './better-auth-user-accounts'

const input = { username: 'bia', name: 'Bia', password: 'x'.repeat(12), role: 'team' as const }

describe('betterAuthUserAccounts.create', () => {
  beforeEach(resetDatabase)

  it('maps a duplicate username to username_taken', async () => {
    await betterAuthUserAccounts.create(input)
    await expect(betterAuthUserAccounts.create(input)).rejects.toMatchObject({ reason: 'username_taken' })
    await expect(betterAuthUserAccounts.create(input)).rejects.toBeInstanceOf(IdentityError)
  })

  it('maps a concurrent duplicate to username_taken', async () => {
    const results = await Promise.allSettled([betterAuthUserAccounts.create(input), betterAuthUserAccounts.create(input)])
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toMatchObject({ reason: { reason: 'username_taken' } })
  })
})
