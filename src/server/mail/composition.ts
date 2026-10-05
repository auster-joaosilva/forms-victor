import { getEnv } from '@/server/shared/env'
import { createSmtpMailSender, unconfiguredMailSender } from './adapters/smtp-mail-sender'
import type { MailSender } from './ports/mail-sender'

const env = getEnv()

export const mailSender: MailSender =
  env.SMTP_USER && env.SMTP_PASSWORD
    ? createSmtpMailSender({ host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER, password: env.SMTP_PASSWORD })
    : unconfiguredMailSender

export type { MailMessage, MailSender } from './ports/mail-sender'
