import { auth } from '@/server/shared/auth/auth'
import { prisma } from '@/server/shared/prisma/client'
import { IdentityError, type UserAccount } from '../domain/user'
import type { UserAccounts } from '../ports/user-accounts'

type Row = { id: string; username: string | null; name: string; role: string; banned: boolean; lastLoginAt: Date | null; createdAt: Date }

const toAccount = (row: Row): UserAccount => ({
  id: row.id,
  username: row.username ?? '',
  name: row.name,
  role: row.role === 'admin' ? 'admin' : 'team',
  active: !row.banned,
  lastLoginAt: row.lastLoginAt,
  createdAt: row.createdAt,
})

const isDuplicate = (error: unknown): boolean => {
  const e = error as { code?: unknown; body?: { code?: unknown } } | null
  return e?.code === 'P2002' || (typeof e?.body?.code === 'string' && e.body.code.startsWith('USER_ALREADY_EXISTS'))
}

const select = { id: true, username: true, name: true, role: true, banned: true, lastLoginAt: true, createdAt: true } as const

export const betterAuthUserAccounts: UserAccounts = {
  list: async () => (await prisma.user.findMany({ select, orderBy: { username: 'asc' } })).map(toAccount),
  findByUsername: async (username) => {
    const row = await prisma.user.findUnique({ where: { username }, select })
    return row ? toAccount(row) : null
  },
  countActiveAdmins: () => prisma.user.count({ where: { role: 'admin', banned: false } }),
  async create({ username, name, password, role }) {
    try {
      await auth.api.createUser({ body: { email: `${username}@users.invalid`, password, name, ...(role === 'admin' ? { role: 'admin' as const } : {}), data: { username, displayUsername: username } } })
    } catch (error) {
      if (isDuplicate(error)) throw new IdentityError('username_taken')
      throw error
    }
    return toAccount((await prisma.user.findUniqueOrThrow({ where: { username }, select })))
  },
  rename: async (id, name) => void (await prisma.user.update({ where: { id }, data: { name } })),
  setRole: async (id, role) => void (await prisma.user.update({ where: { id }, data: { role } })),
  async setActive(id, active) {
    await prisma.user.update({ where: { id }, data: { banned: !active, banReason: active ? null : 'desativado' } })
    if (!active) await prisma.session.deleteMany({ where: { userId: id } })
  },
  async setPassword(id, password) {
    const context = await auth.$context
    await prisma.account.updateMany({ where: { userId: id, providerId: 'credential' }, data: { password: await context.password.hash(password) } })
    await prisma.session.deleteMany({ where: { userId: id } })
  },
}
