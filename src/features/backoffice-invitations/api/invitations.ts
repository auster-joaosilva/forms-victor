import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createInvitation, deleteInvitation, listInvitations } from '@/server/invitations/composition'
import { sessionMiddleware } from '@/server/shared/http/session-middleware'

export type { InvitationView } from '@/server/invitations/composition'

const actorOf = (user: { id: string; username: string }) => ({ id: user.id, username: user.username })

export const listInvitationsFn = createServerFn({ method: 'GET' })
  .middleware([sessionMiddleware])
  .handler(() => listInvitations())

export const createInvitationFn = createServerFn({ method: 'POST' })
  .middleware([sessionMiddleware])
  .inputValidator(z.object({ companyName: z.string().max(200), cnpj: z.string().max(32), email: z.string().max(254) }))
  .handler(({ data, context }) => createInvitation(actorOf(context.session.user), data))

export const deleteInvitationFn = createServerFn({ method: 'POST' })
  .middleware([sessionMiddleware])
  .inputValidator(z.object({ token: z.string().max(32) }))
  .handler(({ data, context }) => deleteInvitation(actorOf(context.session.user), data.token))
