import { IdentityError, type Actor } from '../domain/user'

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ImportUserEmailsResult = { ok: true; appliedUsernames: string[] } | { ok: false; errors: { line: number; reason: string }[] }

type AccountEmailPort = { findByUsername(username: string): Promise<{ id: string } | null>; setEmail(id: string, email: string): Promise<void> }
type AuditRecorder = (entry: { action: 'user_email_changed'; actorId: string; actorUsername: string; reference: string; detail: { usernames: string[] } }) => Promise<void>

type ParsedLine = { line: number; username: string; email: string }

export function makeImportUserEmails(deps: { accounts: AccountEmailPort; recordAudit: AuditRecorder }) {
  return async function importUserEmails(actor: Actor, rawText: string): Promise<ImportUserEmailsResult> {
    if (actor.role !== 'admin') throw new IdentityError('forbidden')

    const parsed: ParsedLine[] = rawText
      .split('\n')
      .map((text, index) => ({ text: text.trim(), line: index + 1 }))
      .filter(({ text }) => text.length > 0)
      .map(({ text, line }) => {
        const [username = '', email = ''] = text.split(';').map((part) => part.trim())
        return { line, username: username.toLowerCase(), email: email.toLowerCase() }
      })

    const targets = await Promise.all(parsed.map(async (row) => ({ row, target: await deps.accounts.findByUsername(row.username) })))

    const errors: { line: number; reason: string }[] = []
    for (const { row, target } of targets) {
      if (!target) errors.push({ line: row.line, reason: 'usuário não encontrado' })
      else if (!EMAIL_RULE.test(row.email)) errors.push({ line: row.line, reason: 'e-mail inválido' })
    }
    if (errors.length > 0) return { ok: false, errors }

    for (const { row, target } of targets) {
      if (!target) throw new Error(`usuário ${row.username} não encontrado após validação`)
      await deps.accounts.setEmail(target.id, row.email)
    }
    const appliedUsernames = parsed.map((row) => row.username)
    await deps.recordAudit({ action: 'user_email_changed', actorId: actor.id, actorUsername: actor.username, reference: String(appliedUsernames.length), detail: { usernames: appliedUsernames } })
    return { ok: true, appliedUsernames }
  }
}
