import nodemailer, { type SendMailOptions } from 'nodemailer'
import type { MailSender } from '../ports/mail-sender'

export interface SmtpConnection {
  host: string
  port: number
  user: string
  password: string
}

export function createSmtpMailSender(
  connection: SmtpConnection,
  transporter: { sendMail(options: SendMailOptions): Promise<unknown> } = nodemailer.createTransport({
    host: connection.host,
    port: connection.port,
    secure: connection.port === 465,
    auth: { user: connection.user, pass: connection.password },
    // O padrão do Nodemailer espera até 2 minutos: um SMTP travado seguraria a requisição.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  }),
): MailSender {
  return {
    async send(message) {
      // A UOL Host recusa remetente diferente da caixa autenticada.
      await transporter.sendMail({ from: connection.user, ...message })
    },
  }
}

export const unconfiguredMailSender: MailSender = {
  async send() {
    throw new Error('SMTP não configurado: defina SMTP_USER e SMTP_PASSWORD')
  },
}
