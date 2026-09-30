import { auth, MINIMUM_PASSWORD, USERNAME_RULE } from '../src/server/shared/auth/auth'
import { prisma } from '../src/server/shared/prisma/client'
import { recordAudit } from '../src/server/audit/composition'

const username = (process.env.BOOTSTRAP_ADMIN_USERNAME ?? '').trim().toLowerCase()
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? ''

if (!USERNAME_RULE.test(username)) throw new Error('BOOTSTRAP_ADMIN_USERNAME inválido (a-z, 3 a 32, começa com letra)')
if (password.length < MINIMUM_PASSWORD) throw new Error(`BOOTSTRAP_ADMIN_PASSWORD precisa de ${MINIMUM_PASSWORD} caracteres ou mais`)

const existing = await prisma.user.findUnique({ where: { username } })
if (existing) {
  await prisma.user.update({ where: { id: existing.id }, data: { role: 'admin', banned: false, banReason: null, banExpires: null } })
  const context = await auth.$context
  const hash = await context.password.hash(password)
  await prisma.account.updateMany({ where: { userId: existing.id, providerId: 'credential' }, data: { password: hash } })
  await prisma.session.deleteMany({ where: { userId: existing.id } })
  await recordAudit({ action: 'admin_bootstrapped', actorUsername: 'bootstrap', reference: username, detail: { mode: 'reactivated' } })
  console.log(`admin reativado: ${username}`)
} else {
  await auth.api.createUser({
    body: { email: `${username}@users.invalid`, password, name: username, role: 'admin', data: { username, displayUsername: username } },
  })
  await recordAudit({ action: 'admin_bootstrapped', actorUsername: 'bootstrap', reference: username, detail: { mode: 'created' } })
  console.log(`admin criado: ${username}`)
}
process.exit(0)
