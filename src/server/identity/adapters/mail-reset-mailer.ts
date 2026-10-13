import type { ResetMailer } from '../ports/reset-mailer'

// Tipado aqui, sem importar de server/mail: um adapter só importa porta do próprio módulo (fronteira do eslint).
// `mailSender`, de server/mail/composition, satisfaz essa forma estruturalmente — quem o entrega é o composition.ts.
interface SendableMail {
  send(message: { to: string; subject: string; text: string; html?: string }): Promise<void>
}

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const resetMailerOf = (sender: SendableMail): ResetMailer => ({
  async sendResetLink(to, resetUrl) {
    await sender.send({
      to,
      subject: 'Redefinição de senha — Auster',
      text: `Alguém pediu para redefinir a senha da sua conta no portal da Auster. Se foi você, abra o link abaixo nas próximas horas:\n\n${resetUrl}\n\nSe você não pediu isso, não precisa fazer nada: essa caixa não recebe resposta.`,
      html: `<p>Alguém pediu para redefinir a senha da sua conta no portal da Auster. Se foi você, abra o link abaixo nas próximas horas:</p><p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p><p>Se você não pediu isso, não precisa fazer nada: essa caixa não recebe resposta.</p>`,
    })
  },
})
