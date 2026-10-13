import { deriveEmail } from '../src/server/identity/domain/contact'
import { isRunDirectly } from './is-run-directly'

export interface EmailFillPlan {
  derivable: { username: string; email: string }[]
  notDerivable: string[]
  collisions: string[]
}

const PLAIN_USERNAME = /^[a-z]+(\.[a-z]+)+$/

// "nome.sobrenome" dá para derivar com confiança; qualquer outro formato (admin, e2e-*, um nome só) entra à parte.
export function planEmailFill(usernames: string[], overrides: Record<string, string>): EmailFillPlan {
  const derivable: { username: string; email: string }[] = []
  const notDerivable: string[] = []
  for (const username of usernames) {
    if (overrides[username] || PLAIN_USERNAME.test(username)) derivable.push({ username, email: deriveEmail(username, overrides) })
    else notDerivable.push(username)
  }
  const seen = new Map<string, number>()
  for (const { email } of derivable) seen.set(email, (seen.get(email) ?? 0) + 1)
  const collisions = [...seen.entries()].filter(([, count]) => count > 1).map(([email]) => email)
  return { derivable, notDerivable, collisions }
}

async function main() {
  if (!isRunDirectly(import.meta.url)) return
  const { prisma } = await import('../src/server/shared/prisma/client')
  const { recordAudit } = await import('../src/server/audit/composition')

  const apply = process.argv.includes('--apply')
  const overrides: Record<string, string> = { 'victor.medeiros': 'victor@austercontabil.com.br' }

  const users = await prisma.user.findMany({ select: { id: true, username: true } })
  const plan = planEmailFill(users.map((u) => u.username ?? ''), overrides)

  console.log(`${plan.derivable.length} e-mail(s) a aplicar:`)
  for (const { username, email } of plan.derivable) console.log(`  ${username} -> ${email}`)
  if (plan.notDerivable.length) console.log(`\nSem derivação automática (informe à mão): ${plan.notDerivable.join(', ')}`)
  if (plan.collisions.length) {
    console.log(`\nColisão de e-mail, nada será gravado para os envolvidos: ${plan.collisions.join(', ')}`)
  }

  if (!apply) {
    console.log('\nSó listando. Rode de novo com --apply para gravar.')
    process.exit(0)
  }
  if (plan.collisions.length) {
    console.log('\nHá colisão: corrija e rode de novo antes de aplicar.')
    process.exit(1)
  }

  const byUsername = new Map(users.map((u) => [u.username, u.id]))
  for (const { username, email } of plan.derivable) {
    const id = byUsername.get(username)
    if (!id) continue
    await prisma.user.update({ where: { id }, data: { email } })
  }
  await recordAudit({ action: 'user_email_changed', actorUsername: 'fill-user-emails', reference: String(plan.derivable.length), detail: { usernames: plan.derivable.map((d) => d.username) } })
  console.log(`\n${plan.derivable.length} e-mail(s) gravado(s).`)
  process.exit(0)
}

main()
