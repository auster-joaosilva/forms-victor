import { auth } from '../../src/server/shared/auth/auth'
import { prisma } from '../../src/server/shared/prisma/client'
import { E2E_OPERATOR, E2E_REGULARIZATION } from './users'

const context = await auth.$context
for (const user of [E2E_REGULARIZATION, E2E_OPERATOR]) {
  const existing = await prisma.user.findUnique({ where: { username: user.username } })
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: user.role, banned: false, banReason: null, banExpires: null } })
    await prisma.account.updateMany({ where: { userId: existing.id, providerId: 'credential' }, data: { password: await context.password.hash(user.password) } })
    await prisma.session.deleteMany({ where: { userId: existing.id } })
  } else {
    const created = await auth.api.createUser({
      body: { email: `${user.username}@users.invalid`, password: user.password, name: user.username, data: { username: user.username, displayUsername: user.username } },
    })
    await prisma.user.update({ where: { id: created.user.id }, data: { role: user.role } })
  }
  console.log(`usuário do ponta a ponta pronto: ${user.username} (${user.role})`)
}
process.exit(0)
