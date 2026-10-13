import { EMAIL_RULE } from '../domain/contact'
import { IdentityError, type Actor } from '../domain/user'
import type { AccountEmailPort } from '../ports/user-accounts'

export type ImportUserEmailsResult = { ok: true; appliedUsernames: string[] } | { ok: false; errors: { line: number; reason: string }[] }

type AuditRecorder = (entry: { action: 'user_email_changed'; actorId: string; actorUsername: string; reference: string; detail: { usernames: string[] } }) => Promise<void>

type ParsedLine = { line: number; username: string; email: string }

export function makeImportUserEmails(deps: { accounts: Pick<AccountEmailPort, 'findByUsername' | 'setEmails'>; recordAudit: AuditRecorder }) {
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
    const pairs: { id: string; email: string }[] = []
    for (const { row, target } of targets) {
      if (!target) errors.push({ line: row.line, reason: 'usuário não encontrado' })
      else if (!EMAIL_RULE.test(row.email)) errors.push({ line: row.line, reason: 'e-mail inválido' })
      else pairs.push({ id: target.id, email: row.email })
    }
    const emailCounts = new Map<string, number>()
    for (const { email } of parsed) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1)
    for (const row of parsed) {
      if (EMAIL_RULE.test(row.email) && (emailCounts.get(row.email) ?? 0) > 1) errors.push({ line: row.line, reason: 'e-mail repetido na lista' })
    }
    if (errors.length > 0) return { ok: false, errors: errors.sort((a, b) => a.line - b.line) }

    try {
      await deps.accounts.setEmails(pairs)
    } catch (error) {
      // A duplicidade com quem já está cadastrado pode envolver mais de uma linha: vira um erro geral, sem linha.
      if (error instanceof IdentityError && error.reason === 'email_taken') return { ok: false, errors: [{ line: 0, reason: 'um dos e-mails já pertence a outro usuário' }] }
      throw error
    }
    const appliedUsernames = parsed.map((row) => row.username)
    await deps.recordAudit({ action: 'user_email_changed', actorId: actor.id, actorUsername: actor.username, reference: String(appliedUsernames.length), detail: { usernames: appliedUsernames } })
    return { ok: true, appliedUsernames }
  }
}
