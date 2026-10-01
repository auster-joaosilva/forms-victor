import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'

const migrationDir = readdirSync('prisma/migrations').find((name) => name.endsWith('_four_roles'))
const dataFix = readFileSync(join('prisma/migrations', migrationDir ?? 'ausente', 'migration.sql'), 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('UPDATE '))
  .join('\n')

describe('four roles migration', () => {
  beforeEach(resetDatabase)

  it('creates users as operator by default', async () => {
    const user = await prisma.user.create({ data: { id: 'u1', name: 'Bia', email: 'bia@users.invalid', username: 'bia' } })
    expect(user.role).toBe('operator')
  })

  it('moves team and any unknown role down to operator and keeps the four roles', async () => {
    const roles = ['team', 'user', 'admin', 'manager', 'regularization', 'operator']
    for (const [index, role] of roles.entries()) {
      await prisma.user.create({ data: { id: `u${index}`, name: role, email: `${role}@users.invalid`, username: `u${index}${role}`, role } })
    }
    expect(dataFix).toContain("SET \"role\" = 'operator'")
    await prisma.$executeRawUnsafe(dataFix)
    const after = await prisma.user.findMany({ orderBy: { id: 'asc' }, select: { name: true, role: true } })
    expect(Object.fromEntries(after.map((user) => [user.name, user.role]))).toEqual({
      team: 'operator', user: 'operator', admin: 'admin', manager: 'manager', regularization: 'regularization', operator: 'operator',
    })
  })
})
