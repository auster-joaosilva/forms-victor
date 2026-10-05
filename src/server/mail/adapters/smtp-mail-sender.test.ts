import { describe, expect, it } from 'vitest'
import type { SendMailOptions } from 'nodemailer'
import { createSmtpMailSender, unconfiguredMailSender } from './smtp-mail-sender'

describe('createSmtpMailSender', () => {
  it('sends from the authenticated mailbox', async () => {
    const sent: SendMailOptions[] = []
    const sender = createSmtpMailSender(
      { host: 'smtps.uhserver.com', port: 465, user: 'no-reply@austercontabil.com.br', password: 'x' },
      { sendMail: async (options: SendMailOptions) => void sent.push(options) },
    )

    await sender.send({ to: 'cliente@exemplo.com.br', subject: 'Protocolo', text: 'Olá' })

    expect(sent).toEqual([{ from: 'no-reply@austercontabil.com.br', to: 'cliente@exemplo.com.br', subject: 'Protocolo', text: 'Olá' }])
  })
})

describe('unconfiguredMailSender', () => {
  it('fails on send', async () => {
    await expect(unconfiguredMailSender.send({ to: 'a@b.com', subject: 's', text: 't' })).rejects.toThrow(/SMTP não configurado/)
  })
})
