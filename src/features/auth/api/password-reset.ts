import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requestClientIp } from '@/server/shared/http/draft-cookie'
import { completePasswordReset, requestPasswordReset } from '@/server/identity/composition'

export const requestPasswordResetFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ username: z.string().max(64) }))
  .handler(({ data }) => requestPasswordReset({ username: data.username, origin: requestClientIp() }))

export const completePasswordResetFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ token: z.string().min(1).max(256), password: z.string().max(128) }))
  .handler(({ data }) => completePasswordReset(data))
