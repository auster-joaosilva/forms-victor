import { deriveFirstName } from '../src/server/identity/domain/contact'
import { meetsPasswordRule } from '../src/server/identity/domain/user-rules'

export interface BatchPasswordPlan {
  username: string
  password: string
}

export function planBatchPasswords(users: { username: string; active: boolean }[], suffix: string): BatchPasswordPlan[] {
  return users
    .filter((u) => u.active && !u.username.startsWith('e2e-'))
    .map((u) => ({ username: u.username, password: `${deriveFirstName(u.username)}${suffix}` }))
}

async function main() {
  if (import.meta.url !== `file://${process.argv[1]}`) return
  const suffix = process.env.BATCH_PASSWORD_SUFFIX
  if (!suffix) throw new Error('defina BATCH_PASSWORD_SUFFIX no ambiente antes de rodar')

  const { auth } = await import('../src/server/shared/auth/auth')
  const { prisma } = await import('../src/server/shared/prisma/client')
  const { recordAudit } = await import('../src/server/audit/composition')

  const apply = process.argv.includes('--apply')
  const users = await prisma.user.findMany({ select: { id: true, username: true, banned: true } })
  const plan = planBatchPasswords(users.map((u) => ({ username: u.username ?? '', active: !u.banned })), suffix)

  const rejected = plan.filter((p) => !meetsPasswordRule(p.password))
  if (rejected.length) throw new Error(`a senha gerada não cumpre a regra para: ${rejected.map((r) => r.username).join(', ')}`)

  console.log(`${plan.length} usuário(s) a redefinir: ${plan.map((p) => p.username).join(', ')}`)
  if (!apply) {
    console.log('Só listando. Rode de novo com --apply para gravar. Nenhuma senha aparece neste log.')
    process.exit(0)
  }

  const context = await auth.$context
  const byUsername = new Map(users.map((u) => [u.username, u.id]))
  for (const { username, password } of plan) {
    const id = byUsername.get(username)
    if (!id) continue
    const hash = await context.password.hash(password)
    const updated = await prisma.account.updateMany({ where: { userId: id, providerId: 'credential' }, data: { password: hash } })
    if (updated.count === 0) await prisma.account.create({ data: { id: crypto.randomUUID(), accountId: id, providerId: 'credential', userId: id, password: hash } })
    await prisma.session.deleteMany({ where: { userId: id } })
  }
  await recordAudit({ action: 'passwords_set_in_batch', actorUsername: 'set-batch-passwords', reference: String(plan.length), detail: { count: plan.length } })
  console.log(`${plan.length} senha(s) gravada(s). Avise cada pessoa, individualmente, pelo canal de sempre — nunca em grupo.`)
  process.exit(0)
}

main()
