import { auth } from '@/server/shared/auth/auth'
import { DEFAULT_ROLE, toRole } from '@/server/shared/domain/permissions'
import { prisma } from '@/server/shared/prisma/client'
import { IdentityError, type UserAccount } from '../domain/user'
import type { UserAccounts } from '../ports/user-accounts'

type Row = { id: string; username: string | null; name: string; role: string; banned: boolean; lastLoginAt: Date | null; createdAt: Date; email: string }

const toAccount = (row: Row): UserAccount => ({
  id: row.id,
  username: row.username ?? '',
  name: row.name,
  role: toRole(row.role),
  active: !row.banned,
  lastLoginAt: row.lastLoginAt,
  createdAt: row.createdAt,
  email: row.email,
})

const isDuplicate = (error: unknown): boolean => {
  const e = error as { code?: unknown; body?: { code?: unknown } } | null
  return e?.code === 'P2002' || (typeof e?.body?.code === 'string' && e.body.code.startsWith('USER_ALREADY_EXISTS'))
}

// Com driver adapter, o P2002 do Prisma 7 não traz `meta.target`. Quem chama só altera a coluna `email`, então um P2002
// ali só pode ser dela.
const isDuplicateEmail = (error: unknown): boolean => {
  const e = error as { code?: unknown } | null
  return e?.code === 'P2002'
}

const select = { id: true, username: true, name: true, role: true, banned: true, lastLoginAt: true, createdAt: true, email: true } as const

export const betterAuthUserAccounts: UserAccounts = {
  list: async () => (await prisma.user.findMany({ select, orderBy: { username: 'asc' } })).map(toAccount),
  findByUsername: async (username) => {
    const row = await prisma.user.findUnique({ where: { username }, select })
    return row ? toAccount(row) : null
  },
  countActiveAdmins: () => prisma.user.count({ where: { role: 'admin', banned: false } }),
  async create({ username, name, password, role }) {
    try {
      // O better-auth cria com o defaultRole; o papel escolhido é gravado em seguida, sem depender de como o plugin valida papéis.
      await auth.api.createUser({ body: { email: `${username}@users.invalid`, password, name, data: { username, displayUsername: username } } })
    } catch (error) {
      if (isDuplicate(error)) throw new IdentityError('username_taken')
      throw error
    }
    if (role !== DEFAULT_ROLE) await prisma.user.update({ where: { username }, data: { role } })
    return toAccount(await prisma.user.findUniqueOrThrow({ where: { username }, select }))
  },
  rename: async (id, name) => void (await prisma.user.update({ where: { id }, data: { name } })),
  setRole: async (id, role) => void (await prisma.user.update({ where: { id }, data: { role } })),
  async setActive(id, active) {
    await prisma.user.update({ where: { id }, data: { banned: !active, banReason: active ? null : 'desativado' } })
    if (!active) await prisma.session.deleteMany({ where: { userId: id } })
  },
  async setPassword(id, password) {
    const context = await auth.$context
    const hash = await context.password.hash(password)
    const updated = await prisma.account.updateMany({ where: { userId: id, providerId: 'credential' }, data: { password: hash } })
    if (updated.count === 0) {
      await prisma.account.create({ data: { id: crypto.randomUUID(), accountId: id, providerId: 'credential', userId: id, password: hash } })
    }
    await prisma.session.deleteMany({ where: { userId: id } })
  },
  async setEmail(id, email) {
    try {
      await prisma.user.update({ where: { id }, data: { email } })
    } catch (error) {
      if (isDuplicateEmail(error)) throw new IdentityError('email_taken')
      throw error
    }
  },
  async setEmails(pairs) {
    try {
      // Uma transação só: ou todos os e-mails do lote entram, ou nenhum.
      await prisma.$transaction(pairs.map(({ id, email }) => prisma.user.update({ where: { id }, data: { email } })))
    } catch (error) {
      if (isDuplicateEmail(error)) throw new IdentityError('email_taken')
      throw error
    }
  },
}
